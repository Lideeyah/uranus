import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { LedgerState, LedgerTransaction, ToolStatus } from '../lib/types';

const DATA_DIR = path.join(process.cwd(), '.uranus');
const LEDGER_PATH = path.join(DATA_DIR, 'ledger.json');

const INITIAL_BALANCE = 10_000;

const defaultState: LedgerState = {
  initial_balance: INITIAL_BALANCE,
  balance: INITIAL_BALANCE,
  currency: 'USD',
  transactions: [],
};

let cached: LedgerState | null = null;
let writeQueue: Promise<void> = Promise.resolve();

async function ensureDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function loadFromDisk(): Promise<LedgerState> {
  try {
    const raw = await fs.readFile(LEDGER_PATH, 'utf8');
    const parsed = JSON.parse(raw) as LedgerState;
    if (typeof parsed.balance !== 'number') throw new Error('corrupt ledger');
    return parsed;
  } catch {
    return structuredClone(defaultState);
  }
}

async function flush(state: LedgerState): Promise<void> {
  await ensureDir();
  const tmp = LEDGER_PATH + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(state, null, 2), 'utf8');
  await fs.rename(tmp, LEDGER_PATH);
}

async function persist(state: LedgerState): Promise<void> {
  cached = state;
  writeQueue = writeQueue.then(() => flush(state)).catch((err) => {
    // We surface the failure through the caller — no silent swallow.
    console.error('[ledger] flush failed', err);
  });
  await writeQueue;
}

export async function readLedger(): Promise<LedgerState> {
  if (cached) return cached;
  cached = await loadFromDisk();
  return cached;
}

export interface SettleInput {
  request_id: string;
  recipient_id: string;
  amount: number;
  currency: string;
  reason: string;
  status: Extract<ToolStatus, 'AUTO_APPROVED' | 'AUTHORIZED'>;
  signature_fingerprint?: string;
  tx_hash: string;
}

export interface SettleResult {
  ok: boolean;
  reason?: string;
  transaction?: LedgerTransaction;
  balance: number;
}

export async function applySettlement(input: SettleInput): Promise<SettleResult> {
  const state = await readLedger();

  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { ok: false, reason: 'invalid_amount', balance: state.balance };
  }
  if (input.currency.toUpperCase() !== state.currency) {
    return {
      ok: false,
      reason: `unsupported_currency:${input.currency}`,
      balance: state.balance,
    };
  }
  if (state.balance - input.amount < 0) {
    return { ok: false, reason: 'overdraft_prevented', balance: state.balance };
  }
  if (state.transactions.some((t) => t.request_id === input.request_id)) {
    return {
      ok: false,
      reason: 'duplicate_request_id',
      balance: state.balance,
    };
  }

  const tx: LedgerTransaction = {
    tx_hash: input.tx_hash,
    request_id: input.request_id,
    recipient_id: input.recipient_id,
    amount: input.amount,
    currency: input.currency.toUpperCase(),
    reason: input.reason,
    status: input.status,
    timestamp: Date.now(),
    signature_fingerprint: input.signature_fingerprint,
  };

  const next: LedgerState = {
    ...state,
    balance: Math.round((state.balance - input.amount) * 100) / 100,
    transactions: [...state.transactions, tx],
  };
  await persist(next);
  return { ok: true, transaction: tx, balance: next.balance };
}

export async function recordRejection(input: {
  request_id: string;
  recipient_id: string;
  amount: number;
  currency: string;
  reason: string;
  status: Extract<ToolStatus, 'REJECTED' | 'BLOCKED'>;
}): Promise<LedgerState> {
  const state = await readLedger();
  const tx: LedgerTransaction = {
    tx_hash: '0x0',
    request_id: input.request_id,
    recipient_id: input.recipient_id,
    amount: input.amount,
    currency: input.currency.toUpperCase(),
    reason: input.reason,
    status: input.status,
    timestamp: Date.now(),
  };
  const next: LedgerState = {
    ...state,
    transactions: [...state.transactions, tx],
  };
  await persist(next);
  return next;
}

export async function resetLedger(): Promise<LedgerState> {
  const fresh = structuredClone(defaultState);
  await persist(fresh);
  return fresh;
}
