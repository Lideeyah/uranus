import type { Policy, RiskAssessment, SettlementPayload } from './types';
import { DEFAULT_POLICY } from './types';

interface EvaluateOptions {
  now?: number;
  policy?: Policy;
  velocityCount?: number; // if provided, uses this instead of local window
}

const executionWindow: number[] = [];

export function recordExecution(now: number = Date.now()): void {
  executionWindow.push(now);
  pruneWindow(now, DEFAULT_POLICY.velocity_window_ms);
}

export function resetVelocityWindow(): void {
  executionWindow.length = 0;
}

function pruneWindow(now: number, windowMs: number): void {
  const cutoff = now - windowMs;
  while (executionWindow.length && executionWindow[0] < cutoff) {
    executionWindow.shift();
  }
}

export function getVelocityCount(now: number = Date.now(), windowMs: number = DEFAULT_POLICY.velocity_window_ms): number {
  pruneWindow(now, windowMs);
  return executionWindow.length;
}

function hasField(
  payload: Partial<SettlementPayload>,
  key: keyof SettlementPayload,
  type: 'string' | 'number',
): boolean {
  const v = payload[key];
  if (type === 'string') return typeof v === 'string' && v.trim().length > 0;
  return typeof v === 'number' && Number.isFinite(v);
}

export function evaluate(
  payload: Partial<SettlementPayload>,
  options: EvaluateOptions = {},
): RiskAssessment {
  const policy = options.policy ?? DEFAULT_POLICY;
  const now = options.now ?? Date.now();
  const violations: string[] = [];
  let score = 100;

  if (!hasField(payload, 'recipient_id', 'string')) {
    violations.push('SCHEMA_MISSING_RECIPIENT');
    score -= 25;
  }
  if (!hasField(payload, 'amount', 'number')) {
    violations.push('SCHEMA_MISSING_AMOUNT');
    score -= 25;
  }
  if (!hasField(payload, 'currency', 'string')) {
    violations.push('SCHEMA_MISSING_CURRENCY');
    score -= 10;
  }
  if (!hasField(payload, 'reason', 'string')) {
    violations.push('SCHEMA_MISSING_REASON');
    score -= 5;
  }
  if (!hasField(payload, 'idempotency_key', 'string')) {
    violations.push('SCHEMA_MISSING_IDEMPOTENCY_KEY');
    score -= 5;
  }

  const amount = typeof payload.amount === 'number' ? payload.amount : NaN;
  const currency = typeof payload.currency === 'string' ? payload.currency.toUpperCase() : '';
  const recipient = typeof payload.recipient_id === 'string' ? payload.recipient_id : '';

  if (Number.isFinite(amount) && amount < 0) {
    violations.push('NEGATIVE_AMOUNT');
    score -= 30;
  }
  if (Number.isFinite(amount) && amount === 0) {
    violations.push('ZERO_AMOUNT');
    score -= 10;
  }

  if (currency && !policy.supported_currencies.map((c) => c.toUpperCase()).includes(currency)) {
    violations.push('UNSUPPORTED_CURRENCY');
    score -= 15;
  }

  const overThreshold =
    Number.isFinite(amount) && amount > policy.auto_approve_max_usd;
  if (overThreshold) {
    violations.push('STEP_UP_REQUIRED');
    score -= 20;
  }

  let denyMatch = false;
  if (recipient && policy.recipient_denylist_pattern.trim().length > 0) {
    try {
      const re = new RegExp(policy.recipient_denylist_pattern);
      if (re.test(recipient)) {
        violations.push('RECIPIENT_DENYLISTED');
        score -= 35;
        denyMatch = true;
      }
    } catch {
      // ignore invalid regex — treated as no rule
    }
  }

  const velocity =
    typeof options.velocityCount === 'number'
      ? options.velocityCount
      : getVelocityCount(now, policy.velocity_window_ms);
  const overVelocity = velocity >= policy.velocity_max_calls;
  if (overVelocity) {
    violations.push('VELOCITY_LIMIT_EXCEEDED');
    score -= 40;
  }

  const requires_auth =
    overThreshold ||
    overVelocity ||
    denyMatch ||
    violations.some(
      (v) =>
        v.startsWith('SCHEMA_') || v === 'NEGATIVE_AMOUNT' || v === 'UNSUPPORTED_CURRENCY',
    );

  let risk_level: RiskAssessment['risk_level'] = 'LOW';
  if (overVelocity || violations.includes('NEGATIVE_AMOUNT') || denyMatch) {
    risk_level = 'CRITICAL';
  } else if (
    overThreshold ||
    violations.some((v) => v.startsWith('SCHEMA_') || v === 'UNSUPPORTED_CURRENCY')
  ) {
    risk_level = 'MEDIUM';
  }

  return {
    risk_level,
    requires_auth,
    violation_codes: violations,
    safety_score: Math.max(0, Math.min(100, score)),
  };
}

export function isHardBlock(assessment: RiskAssessment): boolean {
  // Automated hard blocks — never routed to the operator; no chain entry.
  // Denylisted recipients are surfaced on the intercept card (with the
  // Authorize button disabled) so the operator can explicitly reject and
  // the rejection is recorded on the audit chain.
  return (
    assessment.violation_codes.includes('VELOCITY_LIMIT_EXCEEDED') ||
    assessment.violation_codes.includes('NEGATIVE_AMOUNT')
  );
}

export function humanizeViolation(code: string): string {
  const map: Record<string, string> = {
    STEP_UP_REQUIRED: 'Exceeds auto-approval cap',
    VELOCITY_LIMIT_EXCEEDED: 'Anti-loop velocity limit',
    NEGATIVE_AMOUNT: 'Negative amount rejected',
    ZERO_AMOUNT: 'Zero amount',
    UNSUPPORTED_CURRENCY: 'Unsupported currency',
    RECIPIENT_DENYLISTED: 'Recipient on deny-list',
    SCHEMA_MISSING_RECIPIENT: 'Missing recipient_id',
    SCHEMA_MISSING_AMOUNT: 'Missing amount',
    SCHEMA_MISSING_CURRENCY: 'Missing currency',
    SCHEMA_MISSING_REASON: 'Missing reason',
    SCHEMA_MISSING_IDEMPOTENCY_KEY: 'Missing idempotency_key',
  };
  return map[code] ?? code;
}
