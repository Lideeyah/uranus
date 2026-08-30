'use client';

import { KeyRound, Radar, ShieldCheck, Sliders, Timer, Wallet } from 'lucide-react';
import { useWebMCP } from '@/context/WebMCPContext';

export default function GatewayArmed() {
  const { policy, ledger, fingerprint } = useWebMCP();

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-2 text-hi">
          <ShieldCheck className="h-4 w-4 stroke-[1.5] text-muted" />
          <span className="text-sm font-semibold tracking-tight">Gateway Armed</span>
        </div>
        <span className="flex items-center gap-1.5 rounded-md border border-tagborder bg-tagbg px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-tagtext">
          <span className="soft-pulse h-1.5 w-1.5 rounded-full bg-emerald" />
          listening
        </span>
      </div>

      <div className="flex flex-col items-center justify-center gap-5 px-6 py-6">
        <Radars />

        <div className="text-center">
          <p className="text-sm font-medium text-hi">Uranus is intercepting every tool call</p>
          <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-muted">
            Guardrails evaluate every invocation. Low-risk calls settle instantly with an ECDSA
            signature. High-risk calls will pause the agent here until you review and sign.
          </p>
        </div>

        <div className="grid w-full max-w-md grid-cols-2 gap-2">
          <PolicyStat
            icon={<Sliders className="h-3.5 w-3.5 stroke-[1.5]" />}
            label="Auto-approve cap"
            value={`$${policy.auto_approve_max_usd.toFixed(2)}`}
          />
          <PolicyStat
            icon={<Timer className="h-3.5 w-3.5 stroke-[1.5]" />}
            label="Velocity limit"
            value={`${policy.velocity_max_calls} / ${Math.round(policy.velocity_window_ms / 1000)}s`}
          />
          <PolicyStat
            icon={<Wallet className="h-3.5 w-3.5 stroke-[1.5]" />}
            label="Treasury pool"
            value={
              ledger
                ? `$${ledger.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : '—'
            }
          />
          <PolicyStat
            icon={<KeyRound className="h-3.5 w-3.5 stroke-[1.5]" />}
            label="Operator identity"
            value={
              fingerprint ? `${fingerprint.slice(0, 8)}··${fingerprint.slice(-6)}` : 'generating…'
            }
            mono
          />
        </div>

        <div className="w-full max-w-md rounded-md border border-border bg-base p-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-meta">
            Recipient deny-list
          </p>
          <p className="mt-1 truncate font-mono text-[11px] text-muted">
            {policy.recipient_denylist_pattern || '—'}
          </p>
        </div>
      </div>
    </div>
  );
}

function PolicyStat({
  icon,
  label,
  value,
  mono = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-base p-2.5">
      <span className="text-meta">{icon}</span>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-meta">{label}</p>
        <p className={`mt-0.5 truncate text-xs text-hi ${mono ? 'font-mono' : 'font-medium'}`}>
          {value}
        </p>
      </div>
    </div>
  );
}

function Radars() {
  return (
    <div className="relative flex h-32 w-32 items-center justify-center">
      <div className="absolute inset-0 rounded-full border border-tagborder" />
      <div className="absolute inset-3 rounded-full border border-tagborder/70" />
      <div className="absolute inset-6 rounded-full border border-tagborder/50" />
      <div className="absolute inset-10 rounded-full border border-tagborder/30" />
      <div className="relative flex h-8 w-8 items-center justify-center rounded-full border border-border bg-base">
        <Radar className="h-4 w-4 stroke-[1.5] text-muted" />
      </div>
    </div>
  );
}
