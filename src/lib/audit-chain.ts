import { get, set } from 'idb-keyval';
import type { AuditBlock, ToolStatus } from './types';
import { sha256Hex } from './crypto';

const IDB_KEY = 'uranus:audit-chain:v1';
const GENESIS_HASH = '0x' + '0'.repeat(64);

async function loadChain(): Promise<AuditBlock[]> {
  return (await get<AuditBlock[]>(IDB_KEY)) ?? [];
}

async function saveChain(chain: AuditBlock[]): Promise<void> {
  await set(IDB_KEY, chain);
}

async function blockHash(input: Omit<AuditBlock, 'current_hash'>): Promise<string> {
  const canonical = JSON.stringify({
    index: input.index,
    timestamp: input.timestamp,
    request_id: input.request_id,
    tool_name: input.tool_name,
    payload_hash: input.payload_hash,
    status: input.status,
    operator_fingerprint: input.operator_fingerprint,
    signature: input.signature,
    previous_hash: input.previous_hash,
  });
  return '0x' + (await sha256Hex(canonical));
}

// Serialize all writes through a single promise chain so concurrent
// appends (e.g. reject() racing with an incoming resolve message) can't
// clobber each other's chain state via interleaved IDB reads.
let writeQueue: Promise<unknown> = Promise.resolve();

export async function appendBlock(entry: {
  request_id: string;
  tool_name: string;
  payload_hash: string;
  status: ToolStatus;
  operator_fingerprint: string;
  signature: string;
}): Promise<AuditBlock> {
  const task = writeQueue.then(async () => {
    const chain = await loadChain();
    const previous_hash =
      chain.length > 0 ? chain[chain.length - 1].current_hash : GENESIS_HASH;
    const draft = {
      index: chain.length,
      timestamp: Date.now(),
      request_id: entry.request_id,
      tool_name: entry.tool_name,
      payload_hash: entry.payload_hash,
      status: entry.status,
      operator_fingerprint: entry.operator_fingerprint,
      signature: entry.signature,
      previous_hash,
    };
    const current_hash = await blockHash(draft);
    const block: AuditBlock = { ...draft, current_hash };
    chain.push(block);
    await saveChain(chain);
    return block;
  });
  writeQueue = task.catch(() => undefined);
  return task;
}

export async function readChain(): Promise<AuditBlock[]> {
  return loadChain();
}

export interface ChainVerification {
  valid: boolean;
  length: number;
  broken_at?: number;
  reason?: string;
  head_hash: string;
}

export async function verifyChain(): Promise<ChainVerification> {
  const chain = await loadChain();
  let previous_hash = GENESIS_HASH;
  for (let i = 0; i < chain.length; i++) {
    const b = chain[i];
    if (b.index !== i) {
      return {
        valid: false,
        length: chain.length,
        broken_at: i,
        reason: `index mismatch at ${i}`,
        head_hash: previous_hash,
      };
    }
    if (b.previous_hash !== previous_hash) {
      return {
        valid: false,
        length: chain.length,
        broken_at: i,
        reason: `previous_hash mismatch at ${i}`,
        head_hash: previous_hash,
      };
    }
    const { current_hash: _c, ...rest } = b;
    const recomputed = await blockHash(rest);
    if (recomputed !== b.current_hash) {
      return {
        valid: false,
        length: chain.length,
        broken_at: i,
        reason: `current_hash mismatch at ${i}`,
        head_hash: previous_hash,
      };
    }
    previous_hash = b.current_hash;
  }
  return {
    valid: true,
    length: chain.length,
    head_hash: previous_hash,
  };
}

export async function resetChain(): Promise<void> {
  await saveChain([]);
}
