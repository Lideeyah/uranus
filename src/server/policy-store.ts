import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Policy } from '../lib/types';
import { DEFAULT_POLICY } from '../lib/types';

const DATA_DIR = path.join(process.cwd(), '.uranus');
const POLICY_PATH = path.join(DATA_DIR, 'policy.json');

let cached: Policy | null = null;

async function ensureDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function loadFromDisk(): Promise<Policy> {
  try {
    const raw = await fs.readFile(POLICY_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Policy;
    // Fill in defaults for any missing field so upgrades don't crash.
    return { ...DEFAULT_POLICY, ...parsed };
  } catch {
    return { ...DEFAULT_POLICY, updated_at: Date.now() };
  }
}

async function flush(policy: Policy): Promise<void> {
  await ensureDir();
  const tmp = POLICY_PATH + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(policy, null, 2), 'utf8');
  await fs.rename(tmp, POLICY_PATH);
}

export async function readPolicy(): Promise<Policy> {
  if (cached) return cached;
  cached = await loadFromDisk();
  return cached;
}

export async function updatePolicy(patch: Partial<Policy>): Promise<Policy> {
  const current = await readPolicy();
  const next: Policy = { ...current, ...patch, updated_at: Date.now() };
  // Clamp
  next.auto_approve_max_usd = Math.max(0, Math.min(10_000, Number(next.auto_approve_max_usd) || 0));
  next.velocity_max_calls = Math.max(1, Math.min(60, Math.floor(Number(next.velocity_max_calls) || 1)));
  next.velocity_window_ms = Math.max(1_000, Math.min(600_000, Math.floor(Number(next.velocity_window_ms) || 60_000)));
  if (!Array.isArray(next.supported_currencies) || next.supported_currencies.length === 0) {
    next.supported_currencies = DEFAULT_POLICY.supported_currencies.slice();
  }
  if (typeof next.recipient_denylist_pattern !== 'string') {
    next.recipient_denylist_pattern = '';
  }
  cached = next;
  await flush(next);
  return next;
}

export async function resetPolicy(): Promise<Policy> {
  cached = { ...DEFAULT_POLICY, updated_at: Date.now() };
  await flush(cached);
  return cached;
}
