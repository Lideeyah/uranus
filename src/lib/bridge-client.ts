import type {
  BridgeClientMessage,
  BridgeServerMessage,
  LedgerState,
  Policy,
  SettlementPayload,
  ToolExecutionResult,
} from './types';

export const BRIDGE_URL: string =
  process.env.NEXT_PUBLIC_URANUS_BRIDGE_URL?.replace(/\/$/, '') ??
  (typeof window !== 'undefined'
    ? `http://${window.location.hostname}:3223`
    : 'http://localhost:3223');

export const BRIDGE_WS_URL: string = BRIDGE_URL.replace(/^http/, 'ws') + '/ws';

export async function httpGetLedger(): Promise<LedgerState> {
  const r = await fetch(`${BRIDGE_URL}/ledger`);
  if (!r.ok) throw new Error(`ledger fetch failed: ${r.status}`);
  return r.json();
}

export async function httpGetPolicy(): Promise<Policy> {
  const r = await fetch(`${BRIDGE_URL}/policy`);
  if (!r.ok) throw new Error(`policy fetch failed: ${r.status}`);
  return r.json();
}

export async function httpPutPolicy(patch: Partial<Policy>): Promise<Policy> {
  const r = await fetch(`${BRIDGE_URL}/policy`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!r.ok) throw new Error(`policy update failed: ${r.status}`);
  return r.json();
}

export async function httpResetPolicy(): Promise<Policy> {
  const r = await fetch(`${BRIDGE_URL}/policy/reset`, { method: 'POST' });
  if (!r.ok) throw new Error(`policy reset failed: ${r.status}`);
  return r.json();
}

export async function httpResetLedger(): Promise<LedgerState> {
  const r = await fetch(`${BRIDGE_URL}/ledger/reset`, { method: 'POST' });
  if (!r.ok) throw new Error(`ledger reset failed: ${r.status}`);
  return r.json();
}

export async function httpSubmitPreset(
  payload: SettlementPayload,
  origin: 'browser-preset' | 'llm-agent' | 'mcp-external' | 'unknown' = 'browser-preset',
): Promise<ToolExecutionResult> {
  const r = await fetch(`${BRIDGE_URL}/submit`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tool_name: 'request_guarded_settlement', payload, origin }),
  });
  if (!r.ok) throw new Error(`submit failed: ${r.status}`);
  return r.json();
}

export async function httpAgentStatus(): Promise<{ configured: boolean }> {
  const r = await fetch(`${BRIDGE_URL}/agent/status`);
  if (!r.ok) throw new Error(`agent status failed: ${r.status}`);
  return r.json();
}

export interface AgentStreamHandlers {
  onTurn?: (turn: unknown) => void;
  onInvoke?: (inv: unknown) => void;
  onToolResult?: (res: unknown) => void;
  onDone?: (data: unknown) => void;
  onError?: (data: unknown) => void;
}

export async function streamAgent(
  body: { scenario: string; user: string; system?: string },
  handlers: AgentStreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${BRIDGE_URL}/agent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.body) throw new Error('no stream');
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `agent status ${res.status}` }));
    handlers.onError?.(err);
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf('\n\n')) >= 0) {
      const raw = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      handleSseFrame(raw, handlers);
    }
  }
}

function handleSseFrame(raw: string, handlers: AgentStreamHandlers): void {
  const lines = raw.split('\n');
  let event = 'message';
  let data = '';
  for (const line of lines) {
    if (line.startsWith('event: ')) event = line.slice(7).trim();
    else if (line.startsWith('data: ')) data += line.slice(6);
  }
  if (!data) return;
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return;
  }
  switch (event) {
    case 'turn':
      handlers.onTurn?.(parsed);
      break;
    case 'invoke':
      handlers.onInvoke?.(parsed);
      break;
    case 'tool_result':
      handlers.onToolResult?.(parsed);
      break;
    case 'done':
      handlers.onDone?.(parsed);
      break;
    case 'error':
      handlers.onError?.(parsed);
      break;
  }
}

// -------- WebSocket client with reconnect --------
export interface BridgeSocket {
  send: (msg: BridgeClientMessage) => void;
  close: () => void;
  isOpen: () => boolean;
}

export function connectBridge(handlers: {
  onOpen?: () => void;
  onMessage: (msg: BridgeServerMessage) => void;
  onClose?: () => void;
  onError?: (err: Event) => void;
}): BridgeSocket {
  let ws: WebSocket | null = null;
  let closed = false;
  let reconnectTimer: number | null = null;

  function open() {
    ws = new WebSocket(BRIDGE_WS_URL);
    ws.onopen = () => handlers.onOpen?.();
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as BridgeServerMessage;
        handlers.onMessage(msg);
      } catch {
        /* ignore */
      }
    };
    ws.onclose = () => {
      handlers.onClose?.();
      if (!closed) reconnect();
    };
    ws.onerror = (err) => handlers.onError?.(err);
  }

  function reconnect() {
    if (reconnectTimer !== null) return;
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null;
      open();
    }, 1200);
  }

  open();

  return {
    send: (msg) => {
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
    },
    close: () => {
      closed = true;
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      ws?.close();
    },
    isOpen: () => ws?.readyState === WebSocket.OPEN,
  };
}
