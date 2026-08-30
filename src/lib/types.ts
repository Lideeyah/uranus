export type RiskLevel = 'LOW' | 'MEDIUM' | 'CRITICAL';

export interface SettlementPayload {
  recipient_id: string;
  amount: number;
  currency: string;
  reason: string;
  idempotency_key: string;
}

export interface RiskAssessment {
  risk_level: RiskLevel;
  requires_auth: boolean;
  violation_codes: string[];
  safety_score: number;
}

export type ToolStatus =
  | 'AUTO_APPROVED'
  | 'AWAITING_HUMAN'
  | 'AUTHORIZED'
  | 'REJECTED'
  | 'BLOCKED';

export interface ToolExecutionResult {
  success: boolean;
  status: ToolStatus;
  tx_hash?: string;
  reason?: string;
  violation_codes?: string[];
  ledger_balance?: number;
  signature?: string;
  operator_pubkey_jwk?: JsonWebKey;
}

export interface SignedAuthorization {
  payload_hash: string;
  amount: number;
  timestamp: number;
  operator_pubkey: JsonWebKey;
  signature: string; // base64
  decision: 'AUTHORIZED' | 'REJECTED' | 'AUTO_APPROVED';
}

export interface PendingToolRequest {
  id: string;
  origin: 'browser-preset' | 'mcp-external' | 'llm-agent' | 'unknown';
  tool_name: string;
  payload: SettlementPayload;
  assessment: RiskAssessment;
  payload_hash: string;
  received_at: number;
}

export type LogLevel = 'info' | 'success' | 'warn' | 'error' | 'debug' | 'crypto' | 'network';

export interface LogEntry {
  id: string;
  ts: number;
  level: LogLevel;
  message: string;
  meta?: Record<string, unknown>;
}

export interface WebMCPToolDescriptor {
  name: string;
  description: string;
  schema: Record<string, string>;
}

export interface Policy {
  auto_approve_max_usd: number;
  velocity_max_calls: number;
  velocity_window_ms: number;
  supported_currencies: string[];
  recipient_denylist_pattern: string;
  updated_at: number;
}

export const DEFAULT_POLICY: Policy = {
  auto_approve_max_usd: 100,
  velocity_max_calls: 3,
  velocity_window_ms: 60_000,
  supported_currencies: ['USD', 'EUR', 'GBP', 'USDC'],
  recipient_denylist_pattern: '^hacker_|drain_|sanction_',
  updated_at: 0,
};

export interface LedgerTransaction {
  tx_hash: string;
  request_id: string;
  recipient_id: string;
  amount: number;
  currency: string;
  reason: string;
  status: ToolStatus;
  timestamp: number;
  signature_fingerprint?: string;
}

export interface LedgerState {
  initial_balance: number;
  balance: number;
  currency: 'USD';
  transactions: LedgerTransaction[];
}

export interface AuditBlock {
  index: number;
  timestamp: number;
  request_id: string;
  tool_name: string;
  payload_hash: string;
  status: ToolStatus;
  operator_fingerprint: string;
  signature: string;
  previous_hash: string;
  current_hash: string;
}

// -------- WebSocket bridge protocol --------
export type BridgeServerMessage =
  | { type: 'welcome'; session_id: string; ledger: LedgerState; policy: Policy }
  | { type: 'pending'; request: PendingToolRequest }
  | { type: 'policy'; policy: Policy }
  | { type: 'ledger'; ledger: LedgerState }
  | { type: 'resolved'; request_id: string; result: ToolExecutionResult }
  | { type: 'log'; entry: LogEntry };

export type BridgeClientMessage =
  | { type: 'hello'; operator_pubkey: JsonWebKey; fingerprint: string }
  | {
      type: 'resolve';
      request_id: string;
      decision: 'AUTHORIZED' | 'REJECTED' | 'AUTO_APPROVED' | 'BLOCKED';
      signed?: SignedAuthorization;
      violation_codes?: string[];
      reason?: string;
    };
