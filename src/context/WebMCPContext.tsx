'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  AuditBlock,
  BridgeServerMessage,
  LedgerState,
  LogEntry,
  LogLevel,
  PendingToolRequest,
  Policy,
  SignedAuthorization,
} from '@/lib/types';
import { DEFAULT_POLICY } from '@/lib/types';
import { evaluate, humanizeViolation, isHardBlock } from '@/lib/guardrails';
import {
  BRIDGE_URL,
  connectBridge,
  httpGetLedger,
  httpGetPolicy,
  httpPutPolicy,
  httpResetLedger,
  httpResetPolicy,
} from '@/lib/bridge-client';
import {
  getOrCreateOperatorIdentity,
  type OperatorIdentity,
  signAuthorization,
} from '@/lib/crypto';
import {
  appendBlock,
  readChain,
  resetChain,
  verifyChain,
  type ChainVerification,
} from '@/lib/audit-chain';
import { registerWebMCPTools, TOOL_DESCRIPTORS } from '@/lib/webmcp';

type TransportKind = 'navigator.modelContext' | 'polyfill' | 'pending';
type LinkStatus = 'connecting' | 'online' | 'offline';

export interface StageResolution {
  status: 'AUTO_APPROVED' | 'AUTHORIZED' | 'REJECTED' | 'BLOCKED';
  message: string;
  amount?: number;
  ts: number;
}

export interface ActiveScenario {
  key: string;
  label: string;
  narrative: string;
  startedAt: number;
}

interface WebMCPContextValue {
  identity: OperatorIdentity | null;
  identityReady: boolean;
  fingerprint: string;
  logs: LogEntry[];
  pending: PendingToolRequest[];
  ledger: LedgerState | null;
  policy: Policy;
  transport: TransportKind;
  linkStatus: LinkStatus;
  toolsRegistered: number;
  chain: AuditBlock[];
  chainVerification: ChainVerification | null;
  activeScenario: ActiveScenario | null;
  lastResolution: StageResolution | null;
  setActiveScenario: (s: ActiveScenario | null) => void;
  setLastResolution: (r: StageResolution | null) => void;
  authorize: (id: string) => Promise<void>;
  reject: (id: string, reason?: string) => Promise<void>;
  updatePolicy: (patch: Partial<Policy>) => Promise<void>;
  resetPolicyToDefaults: () => Promise<void>;
  resetLedgerBalance: () => Promise<void>;
  resetChainNow: () => Promise<void>;
  verifyChainNow: () => Promise<ChainVerification>;
  clearLogs: () => void;
  addLog: (level: LogLevel, message: string, meta?: Record<string, unknown>) => void;
}

const Ctx = createContext<WebMCPContextValue | null>(null);

export function useWebMCP(): WebMCPContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useWebMCP must be used inside <WebMCPProvider>');
  return v;
}

const LOG_LIMIT = 400;

export function WebMCPProvider({ children }: { children: React.ReactNode }) {
  const [identity, setIdentity] = useState<OperatorIdentity | null>(null);
  const [identityReady, setIdentityReady] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [pending, setPending] = useState<PendingToolRequest[]>([]);
  const [ledger, setLedger] = useState<LedgerState | null>(null);
  const [policy, setPolicy] = useState<Policy>(DEFAULT_POLICY);
  const [transport, setTransport] = useState<TransportKind>('pending');
  const [linkStatus, setLinkStatus] = useState<LinkStatus>('connecting');
  const [chain, setChain] = useState<AuditBlock[]>([]);
  const [chainVerification, setChainVerification] = useState<ChainVerification | null>(null);
  const [activeScenario, setActiveScenario] = useState<ActiveScenario | null>(null);
  const [lastResolution, setLastResolution] = useState<StageResolution | null>(null);

  const identityRef = useRef<OperatorIdentity | null>(null);
  const policyRef = useRef<Policy>(DEFAULT_POLICY);
  const pendingRef = useRef<PendingToolRequest[]>([]);
  const socketRef = useRef<ReturnType<typeof connectBridge> | null>(null);

  identityRef.current = identity;
  policyRef.current = policy;
  pendingRef.current = pending;

  const addLog = useCallback((level: LogLevel, message: string, meta?: Record<string, unknown>) => {
    setLogs((prev) => {
      const entry: LogEntry = {
        id: 'log_' + Math.random().toString(36).slice(2, 9),
        ts: Date.now(),
        level,
        message,
        meta,
      };
      const next = [...prev, entry];
      return next.length > LOG_LIMIT ? next.slice(next.length - LOG_LIMIT) : next;
    });
  }, []);

  const clearLogs = useCallback(() => setLogs([]), []);

  const refreshChain = useCallback(async () => {
    const c = await readChain();
    setChain(c);
    const v = await verifyChain();
    setChainVerification(v);
  }, []);

  const appendChain = useCallback(
    async (input: {
      request_id: string;
      tool_name: string;
      payload_hash: string;
      status: AuditBlock['status'];
      signature: string;
      operator_fingerprint: string;
    }) => {
      try {
        const block = await appendBlock(input);
        setChain((prev) => [...prev, block]);
        const v = await verifyChain();
        setChainVerification(v);
        addLog('crypto', `⛓  chain block #${block.index} → ${block.current_hash.slice(0, 18)}…`, {
          previous_hash: block.previous_hash.slice(0, 12) + '…',
          verified: v.valid,
        });
      } catch (err) {
        addLog('error', 'chain append failed', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
    [addLog],
  );

  const buildSignedAuthorization = useCallback(
    async (
      req: PendingToolRequest,
      decision: SignedAuthorization['decision'],
    ): Promise<SignedAuthorization | null> => {
      const id = identityRef.current;
      if (!id) return null;
      const timestamp = Date.now();
      const signature = await signAuthorization(id, {
        payload_hash: req.payload_hash,
        amount: req.payload.amount,
        timestamp,
        decision,
      });
      return {
        payload_hash: req.payload_hash,
        amount: req.payload.amount,
        timestamp,
        operator_pubkey: id.publicJwk,
        signature,
        decision,
      };
    },
    [],
  );

  const authorize = useCallback(
    async (requestId: string) => {
      const req = pendingRef.current.find((p) => p.id === requestId);
      if (!req) return;
      const signed = await buildSignedAuthorization(req, 'AUTHORIZED');
      if (!signed) {
        addLog('error', 'cannot authorize — operator identity not ready');
        return;
      }
      socketRef.current?.send({
        type: 'resolve',
        request_id: requestId,
        decision: 'AUTHORIZED',
        signed,
      });
      addLog('crypto', `signed AUTHORIZED for ${requestId}`, {
        signature_head: signed.signature.slice(0, 20) + '…',
      });
    },
    [addLog, buildSignedAuthorization],
  );

  const reject = useCallback(
    async (requestId: string, reason = 'rejected by operator') => {
      // Chain write is centralised in handleResolved; here we only fire the
      // WS resolve so the server tears down the pending promise and echoes
      // a `resolved` event back.
      socketRef.current?.send({
        type: 'resolve',
        request_id: requestId,
        decision: 'REJECTED',
        reason,
      });
      addLog('warn', `REJECTED ${requestId}`, { reason });
    },
    [addLog],
  );

  const handleIncomingPending = useCallback(
    async (req: PendingToolRequest) => {
      const currentPolicy = policyRef.current;

      // Re-evaluate with the live browser-side policy view so the operator
      // sees the same verdict as the server (and can react to velocity that
      // is still ticking down).
      const assessment = evaluate(req.payload, { policy: currentPolicy, velocityCount: 0 });
      // Merge server-side and browser-side violations (server has velocity ground truth).
      const mergedViolations = Array.from(
        new Set([...req.assessment.violation_codes, ...assessment.violation_codes]),
      );
      const requires_auth = req.assessment.requires_auth || assessment.requires_auth;
      const risk_level = req.assessment.risk_level;
      const merged = {
        ...req,
        assessment: {
          ...req.assessment,
          violation_codes: mergedViolations,
          requires_auth,
          risk_level,
        },
      };

      const hard = isHardBlock(merged.assessment);
      if (hard) {
        socketRef.current?.send({
          type: 'resolve',
          request_id: req.id,
          decision: 'BLOCKED',
          violation_codes: mergedViolations,
          reason: mergedViolations
            .filter((c) => c === 'VELOCITY_LIMIT_EXCEEDED' || c === 'NEGATIVE_AMOUNT' || c === 'RECIPIENT_DENYLISTED')
            .map(humanizeViolation)
            .join('; '),
        });
        const id = identityRef.current;
        await appendChain({
          request_id: req.id,
          tool_name: req.tool_name,
          payload_hash: req.payload_hash,
          status: 'BLOCKED',
          signature: '(blocked-no-signature)',
          operator_fingerprint: id?.fingerprint ?? 'anonymous',
        });
        return;
      }

      if (!requires_auth) {
        // Auto-approve path — sign it anyway and resolve.
        const signed = await buildSignedAuthorization(merged, 'AUTO_APPROVED');
        if (!signed) return;
        socketRef.current?.send({
          type: 'resolve',
          request_id: req.id,
          decision: 'AUTO_APPROVED',
          signed,
        });
        return;
      }

      // Human-in-the-loop path — surface the card.
      setPending((prev) => (prev.some((p) => p.id === req.id) ? prev : [...prev, merged]));
      addLog(
        'warn',
        `⚑ AWAITING_HUMAN · ${req.tool_name} · ${req.payload.currency} ${req.payload.amount.toFixed(2)}`,
        { violations: mergedViolations, request_id: req.id },
      );
    },
    [addLog, appendChain, buildSignedAuthorization],
  );

  const handleResolved = useCallback(
    async (requestId: string, result: import('@/lib/types').ToolExecutionResult) => {
      setPending((prev) => prev.filter((p) => p.id !== requestId));

      const original = pendingRef.current.find((p) => p.id === requestId);
      if (!original) {
        // May have been auto-approved before entering pending state — still record on chain.
      }

      const id = identityRef.current;
      const status = result.status;
      const signature = result.signature ?? '(none)';
      // Prefer the server-supplied hash (present for AUTO_APPROVED / AUTHORIZED)
      // since auto-approved requests never enter the browser's pending queue,
      // making the `original` fallback unreliable for those.
      const payload_hash = result.payload_hash ?? original?.payload_hash ?? '0x0';
      const tool_name = result.tool_name ?? original?.tool_name ?? 'request_guarded_settlement';

      // Single chain-write path: append for every human-decided outcome.
      // BLOCKED calls (velocity / negative amount) are automated safety
      // rejections without operator input and are intentionally omitted
      // from the audit chain per the script's semantics.
      if (status === 'AUTO_APPROVED' || status === 'AUTHORIZED' || status === 'REJECTED') {
        const chainSig =
          status === 'REJECTED' && signature === '(none)'
            ? '(rejected-by-operator)'
            : signature;
        await appendChain({
          request_id: requestId,
          tool_name,
          payload_hash,
          status,
          signature: chainSig,
          operator_fingerprint: id?.fingerprint ?? 'anonymous',
        });
      }

      if (result.success) {
        addLog(
          'success',
          `✓ ${status} · tx=${result.tx_hash?.slice(0, 20)}… · balance=${result.ledger_balance?.toFixed(2)}`,
          {
            request_id: requestId,
          },
        );
      } else {
        addLog('error', `✗ ${status} · ${result.reason ?? 'unknown'}`, {
          request_id: requestId,
        });
      }

      if (
        status === 'AUTO_APPROVED' ||
        status === 'AUTHORIZED' ||
        status === 'REJECTED' ||
        status === 'BLOCKED'
      ) {
        setLastResolution({
          status,
          message: result.reason ?? '',
          amount: original?.payload.amount,
          ts: Date.now(),
        });
      }
    },
    [addLog, appendChain],
  );

  // Bootstrap: identity → chain → WebMCP registration → WebSocket → initial fetches.
  useEffect(() => {
    let disposed = false;
    (async () => {
      try {
        const id = await getOrCreateOperatorIdentity();
        if (disposed) return;
        setIdentity(id);
        setIdentityReady(true);
        addLog('crypto', `operator identity ready · ${id.fingerprint.slice(0, 16)}…`, {
          curve: 'P-256',
        });
      } catch (err) {
        addLog('error', 'failed to initialize operator identity', {
          error: err instanceof Error ? err.message : String(err),
        });
      }

      try {
        const { transport: tx } = registerWebMCPTools();
        setTransport(tx);
        addLog(
          'success',
          `WebMCP transport online (${tx}) · ${TOOL_DESCRIPTORS.length} tools registered on DOM`,
          { tools: TOOL_DESCRIPTORS.map((t) => t.name) },
        );
      } catch (err) {
        addLog('error', 'WebMCP registration failed', {
          error: err instanceof Error ? err.message : String(err),
        });
      }

      await refreshChain();
    })();
    return () => {
      disposed = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bootstrap WS + poll initial state; run after identity is ready so we can send `hello`.
  useEffect(() => {
    if (!identityReady || !identity) return;
    const socket = connectBridge({
      onOpen: () => {
        setLinkStatus('online');
        addLog('network', `WebSocket link online · ${BRIDGE_URL.replace(/^https?:\/\//, '')}`);
        socket.send({
          type: 'hello',
          operator_pubkey: identity.publicJwk,
          fingerprint: identity.fingerprint,
        });
      },
      onClose: () => {
        setLinkStatus('offline');
        addLog('warn', 'WebSocket link closed · reconnecting…');
      },
      onError: () => {
        setLinkStatus('offline');
      },
      onMessage: async (msg: BridgeServerMessage) => {
        switch (msg.type) {
          case 'welcome':
            setLedger(msg.ledger);
            setPolicy(msg.policy);
            addLog('network', `bridge welcome · session=${msg.session_id}`);
            break;
          case 'ledger':
            setLedger(msg.ledger);
            break;
          case 'policy':
            setPolicy(msg.policy);
            addLog('info', 'policy updated', {
              auto_approve_max_usd: msg.policy.auto_approve_max_usd,
              velocity_max_calls: msg.policy.velocity_max_calls,
            });
            break;
          case 'pending':
            await handleIncomingPending(msg.request);
            break;
          case 'resolved':
            await handleResolved(msg.request_id, msg.result);
            break;
          case 'log':
            setLogs((prev) => {
              const entry = msg.entry;
              const next = [...prev, entry];
              return next.length > LOG_LIMIT ? next.slice(next.length - LOG_LIMIT) : next;
            });
            break;
        }
      },
    });
    socketRef.current = socket;

    // Initial HTTP snapshot (in case a message races the WS handshake).
    Promise.all([httpGetLedger().catch(() => null), httpGetPolicy().catch(() => null)]).then(
      ([l, p]) => {
        if (l) setLedger(l);
        if (p) setPolicy(p);
      },
    );

    return () => socket.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identityReady, identity]);

  const updatePolicyRemote = useCallback(async (patch: Partial<Policy>) => {
    const next = await httpPutPolicy(patch);
    setPolicy(next);
  }, []);

  const resetPolicyToDefaults = useCallback(async () => {
    const next = await httpResetPolicy();
    setPolicy(next);
  }, []);

  const resetLedgerBalance = useCallback(async () => {
    const next = await httpResetLedger();
    setLedger(next);
  }, []);

  const resetChainNow = useCallback(async () => {
    await resetChain();
    await refreshChain();
    addLog('warn', 'audit chain reset · genesis re-anchored');
  }, [addLog, refreshChain]);

  const verifyChainNow = useCallback(async () => {
    const v = await verifyChain();
    setChainVerification(v);
    addLog(v.valid ? 'crypto' : 'error', `chain verify · ${v.valid ? 'INTACT' : 'BROKEN'} · length=${v.length}`, {
      head: v.head_hash.slice(0, 18) + '…',
      reason: v.reason,
    });
    return v;
  }, [addLog]);

  const value = useMemo<WebMCPContextValue>(
    () => ({
      identity,
      identityReady,
      fingerprint: identity?.fingerprint ?? '',
      logs,
      pending,
      ledger,
      policy,
      transport,
      linkStatus,
      toolsRegistered: TOOL_DESCRIPTORS.length,
      chain,
      chainVerification,
      activeScenario,
      lastResolution,
      setActiveScenario,
      setLastResolution,
      authorize,
      reject,
      updatePolicy: updatePolicyRemote,
      resetPolicyToDefaults,
      resetLedgerBalance,
      resetChainNow,
      verifyChainNow,
      clearLogs,
      addLog,
    }),
    [
      identity,
      identityReady,
      logs,
      pending,
      ledger,
      policy,
      transport,
      linkStatus,
      chain,
      chainVerification,
      activeScenario,
      lastResolution,
      authorize,
      reject,
      updatePolicyRemote,
      resetPolicyToDefaults,
      resetLedgerBalance,
      resetChainNow,
      verifyChainNow,
      clearLogs,
      addLog,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
