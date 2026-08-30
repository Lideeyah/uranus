'use client';

import { useEffect, useState } from 'react';
import { Ban, RefreshCcw, Sliders, Wallet } from 'lucide-react';
import { useWebMCP } from '@/context/WebMCPContext';

export default function PolicyEditor() {
  const { policy, updatePolicy, resetPolicyToDefaults, resetLedgerBalance } = useWebMCP();

  const [maxAmount, setMaxAmount] = useState(policy.auto_approve_max_usd);
  const [velocityMax, setVelocityMax] = useState(policy.velocity_max_calls);
  const [velocityWindow, setVelocityWindow] = useState(policy.velocity_window_ms);
  const [deny, setDeny] = useState(policy.recipient_denylist_pattern);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setMaxAmount(policy.auto_approve_max_usd);
    setVelocityMax(policy.velocity_max_calls);
    setVelocityWindow(policy.velocity_window_ms);
    setDeny(policy.recipient_denylist_pattern);
    setDirty(false);
  }, [policy]);

  async function apply() {
    setDirty(false);
    await updatePolicy({
      auto_approve_max_usd: maxAmount,
      velocity_max_calls: velocityMax,
      velocity_window_ms: velocityWindow,
      recipient_denylist_pattern: deny,
    });
  }

  return (
    <section className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2 text-hi">
          <Sliders className="h-4 w-4 stroke-[1.5] text-muted" />
          <span className="text-sm font-semibold tracking-tight">Dynamic Policy</span>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-meta">
          live · persisted
        </span>
      </div>
      <div className="space-y-4 p-4">
        <SliderField
          label="Auto-approval cap (USD)"
          min={0}
          max={1000}
          step={10}
          value={maxAmount}
          format={(v) => `$${v.toFixed(0)}`}
          onChange={(v) => {
            setMaxAmount(v);
            setDirty(true);
          }}
        />
        <SliderField
          label="Velocity limit (max requests / window)"
          min={1}
          max={10}
          step={1}
          value={velocityMax}
          format={(v) => `${v}`}
          onChange={(v) => {
            setVelocityMax(v);
            setDirty(true);
          }}
        />
        <SliderField
          label="Velocity window (seconds)"
          min={10}
          max={300}
          step={10}
          value={Math.round(velocityWindow / 1000)}
          format={(v) => `${v}s`}
          onChange={(v) => {
            setVelocityWindow(v * 1000);
            setDirty(true);
          }}
        />
        <div>
          <label className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-meta">
            <Ban className="h-3.5 w-3.5 stroke-[1.5]" />
            Recipient deny-list regex
          </label>
          <input
            value={deny}
            onChange={(e) => {
              setDeny(e.target.value);
              setDirty(true);
            }}
            spellCheck={false}
            className="mt-1 w-full rounded-md border border-tagborder bg-base px-3 py-2 font-mono text-xs text-hi outline-none transition focus:border-borderhover"
            placeholder="^hacker_|drain_|sanction_"
          />
          <p className="mt-1 font-mono text-[10px] text-meta">
            matches on <code className="text-muted">recipient_id</code> → CRITICAL, no
            authorization allowed
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={apply}
            disabled={!dirty}
            className="flex items-center gap-2 rounded-md bg-hi px-3 py-2 text-xs font-medium text-base transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Sliders className="h-4 w-4 stroke-[1.5]" />
            Apply policy
          </button>
          <button
            type="button"
            onClick={resetPolicyToDefaults}
            className="flex items-center gap-2 rounded-md border border-tagborder bg-surface px-3 py-2 text-xs text-muted transition hover:border-borderhover hover:text-hi"
          >
            <RefreshCcw className="h-4 w-4 stroke-[1.5]" />
            Reset defaults
          </button>
          <button
            type="button"
            onClick={resetLedgerBalance}
            className="flex items-center gap-2 rounded-md border border-tagborder bg-surface px-3 py-2 text-xs text-muted transition hover:border-borderhover hover:text-hi"
            title="Restore treasury to $10,000 and clear transactions"
          >
            <Wallet className="h-4 w-4 stroke-[1.5]" />
            Reset treasury
          </button>
        </div>
      </div>
    </section>
  );
}

function SliderField({
  label,
  min,
  max,
  step,
  value,
  onChange,
  format,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-meta">
          {label}
        </label>
        <span className="font-mono text-xs text-hi">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 h-1 w-full cursor-pointer appearance-none rounded-full bg-tagborder accent-white"
      />
      <div className="mt-0.5 flex justify-between font-mono text-[9px] text-meta">
        <span>{format(min)}</span>
        <span>{format(max)}</span>
      </div>
    </div>
  );
}
