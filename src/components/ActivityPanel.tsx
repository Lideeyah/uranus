'use client';

import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  Ban,
  Hash,
  KeyRound,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Timer,
  UserRound,
} from 'lucide-react';
import { useWebMCP } from '@/context/WebMCPContext';
import { humanizeViolation } from '@/lib/guardrails';
import type { PendingToolRequest } from '@/lib/types';
import GatewayArmed from './GatewayArmed';

export default function ActivityPanel() {
  const { pending, activeScenario } = useWebMCP();
  const active = pending[0];

  if (active) return <InterceptCard req={active} />;
  if (activeScenario)
    return <RunningState label={activeScenario.label} narrative={activeScenario.narrative} />;
  return <GatewayArmed />;
}

// -------------------------------------------------------------
function RunningState({ label, narrative }: { label: string; narrative: string }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-2 text-hi">
          <Loader2 className="h-4 w-4 animate-spin stroke-[1.5]" />
          <span className="text-sm font-semibold tracking-tight">Scenario in flight</span>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-meta">
          waiting for LLM
        </span>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-base">
          <Loader2 className="h-5 w-5 animate-spin stroke-[1.5] text-hi" />
        </div>
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-meta">running</p>
          <p className="mt-1 text-sm font-medium text-hi">{label}</p>
          <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-muted">{narrative}</p>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
function InterceptCard({ req }: { req: PendingToolRequest }) {
  const { authorize, reject } = useWebMCP();
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - req.received_at) / 1000));
    }, 500);
    return () => window.clearInterval(id);
  }, [req.received_at]);

  const hardBlock =
    req.assessment.violation_codes.includes('VELOCITY_LIMIT_EXCEEDED') ||
    req.assessment.violation_codes.includes('RECIPIENT_DENYLISTED');

  return (
    <div className="fade-in-up flex flex-col overflow-hidden rounded-xl border border-rose-950/40 bg-surface shadow-panel">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-2 text-hi">
          <ShieldAlert className="h-4 w-4 stroke-[1.5] text-muted" />
          <span className="text-sm font-semibold tracking-tight">
            Uranus intercepted this request
          </span>
        </div>
        <NeutralTag>{req.assessment.risk_level}</NeutralTag>
      </div>

      <div className="uranus-scroll max-h-[520px] overflow-y-auto">
        <div className="grid grid-cols-2 gap-3 border-b border-border px-5 py-5">
          <Field
            label="Recipient"
            icon={<UserRound className="h-4 w-4 stroke-[1.5]" />}
            value={req.payload.recipient_id}
          />
          <Field
            label="Amount"
            icon={<ArrowUpRight className="h-4 w-4 stroke-[1.5]" />}
            value={`${req.payload.currency} ${req.payload.amount.toFixed(2)}`}
          />
          <Field
            label="Origin"
            icon={<KeyRound className="h-4 w-4 stroke-[1.5]" />}
            value={req.origin}
            mono
          />
          <Field
            label="Received"
            icon={<Timer className="h-4 w-4 stroke-[1.5]" />}
            value={`${elapsed}s ago`}
          />
        </div>

        <div className="border-b border-border px-5 py-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-meta">
            Stated reason
          </p>
          <p className="mt-1 text-sm text-hi">{req.payload.reason}</p>
        </div>

        <div className="border-b border-border px-5 py-4">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-meta">
            Triggered policy violations
          </p>
          <ul className="space-y-1.5">
            {req.assessment.violation_codes.length === 0 ? (
              <li className="text-xs text-muted">clear</li>
            ) : (
              req.assessment.violation_codes.map((code) => (
                <li key={code} className="flex items-start gap-2 text-xs text-hi">
                  <ShieldAlert className="mt-0.5 h-3.5 w-3.5 stroke-[1.5] text-muted" />
                  <span>{humanizeViolation(code)}</span>
                  <span className="ml-auto font-mono text-[10px] text-meta">{code}</span>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="px-5 py-3">
          <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-meta">
            <Hash className="h-3.5 w-3.5 stroke-[1.5]" />
            Payload hash · SHA-256
          </p>
          <p className="mt-1 truncate font-mono text-[11px] text-muted">{req.payload_hash}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-border px-5 py-4">
        <button
          type="button"
          onClick={() => authorize(req.id)}
          disabled={hardBlock}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-medium transition ${
            hardBlock
              ? 'cursor-not-allowed border border-tagborder bg-tagbg text-meta'
              : 'bg-hi text-base hover:bg-white'
          }`}
        >
          <ShieldCheck className="h-4 w-4 stroke-[1.5]" />
          Authorize &amp; Sign
        </button>
        <button
          type="button"
          onClick={() => reject(req.id)}
          className="flex flex-1 items-center justify-center gap-2 rounded-md border border-tagborder bg-surface px-4 py-3 text-sm font-medium text-muted transition hover:border-borderhover hover:text-hi"
        >
          <Ban className="h-4 w-4 stroke-[1.5]" />
          Reject &amp; Abort
        </button>
      </div>
      {hardBlock && (
        <p className="border-t border-border px-5 pb-4 pt-2 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
          Hard-block engaged — this request cannot be authorized
        </p>
      )}
    </div>
  );
}

function NeutralTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md border border-tagborder bg-tagbg px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-tagtext">
      {children}
    </span>
  );
}

function Field({
  label,
  icon,
  value,
  mono = false,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-md border border-border bg-base p-3">
      <div className="flex items-center gap-2 text-meta">
        {icon}
        <span className="font-mono text-[10px] uppercase tracking-[0.16em]">{label}</span>
      </div>
      <p className={`mt-1 truncate text-sm text-hi ${mono ? 'font-mono text-xs' : 'font-medium'}`}>
        {value}
      </p>
    </div>
  );
}
