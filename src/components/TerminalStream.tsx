'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ChevronRight,
  CircleDot,
  Hash,
  Terminal,
  Trash2,
} from 'lucide-react';
import { useWebMCP } from '@/context/WebMCPContext';
import type { LogEntry, LogLevel } from '@/lib/types';

function formatTs(ts: number) {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${ms}`;
}

// Uniform two-tone icons. Errors get a single subtle marker.
function LevelIcon({ level }: { level: LogLevel }) {
  const cls = 'h-3.5 w-3.5 stroke-[1.5]';
  if (level === 'error') return <AlertCircle className={`${cls} text-muted`} />;
  return <ChevronRight className={`${cls} text-meta`} />;
}

function extractTags(entry: LogEntry): {
  status?: string;
  hash?: string;
  tx?: string;
  signature?: string;
  balance?: number;
  violations?: string[];
} {
  const meta = entry.meta ?? {};
  const status = detectStatus(entry.message);
  const hash =
    typeof meta.hash === 'string'
      ? meta.hash
      : typeof (meta as { payload_hash?: string }).payload_hash === 'string'
        ? (meta as { payload_hash: string }).payload_hash
        : undefined;
  const tx =
    typeof meta.tx === 'string'
      ? meta.tx
      : typeof (meta as { tx_hash?: string }).tx_hash === 'string'
        ? (meta as { tx_hash: string }).tx_hash
        : undefined;
  const signature =
    typeof (meta as { signature_head?: string }).signature_head === 'string'
      ? (meta as { signature_head: string }).signature_head
      : undefined;
  const balance =
    typeof (meta as { balance?: number }).balance === 'number'
      ? (meta as { balance: number }).balance
      : undefined;
  const violations = Array.isArray((meta as { violations?: string[] }).violations)
    ? (meta as { violations: string[] }).violations
    : undefined;
  return { status, hash, tx, signature, balance, violations };
}

function detectStatus(msg: string): string | undefined {
  const keywords = [
    'AUTO_APPROVED',
    'AUTHORIZED',
    'REJECTED',
    'BLOCKED',
    'AWAITING_HUMAN',
    'STEP_UP_REQUIRED',
    'ECDSA_SIGNED',
  ];
  for (const k of keywords) if (msg.includes(k)) return k;
  return undefined;
}

// -------------------------------------------------------------
export default function TerminalStream() {
  const { logs, clearLogs } = useWebMCP();
  const scroller = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(0);

  // Paced reveal: dequeue one log at a time so the stream reads like a
  // live console. If a burst pushes the backlog higher, tick faster
  // so we never stall visibly behind reality.
  useEffect(() => {
    if (revealed >= logs.length) return;
    const backlog = logs.length - revealed;
    const delay =
      backlog > 25 ? 30 : backlog > 12 ? 70 : backlog > 5 ? 110 : 160;
    const id = window.setTimeout(
      () => setRevealed((c) => Math.min(c + 1, logs.length)),
      delay,
    );
    return () => window.clearTimeout(id);
  }, [logs.length, revealed]);

  // Reset when logs are cleared or shrunk (e.g. Clear button).
  useEffect(() => {
    if (logs.length < revealed) setRevealed(logs.length);
  }, [logs.length, revealed]);

  useEffect(() => {
    if (!scroller.current) return;
    scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [revealed]);

  const rendered = useMemo(() => logs.slice(0, revealed).slice(-200), [logs, revealed]);

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2 text-hi">
          <Terminal className="h-4 w-4 stroke-[1.5] text-muted" />
          <span className="text-sm font-semibold tracking-tight">
            Live Execution Stream &amp; Proof Engine
          </span>
        </div>
        <div className="flex items-center gap-3 text-meta">
          <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.18em]">
            <CircleDot className="h-3 w-3 stroke-[1.5]" />
            {logs.length} events
          </span>
          <button
            type="button"
            onClick={clearLogs}
            className="flex items-center gap-1 rounded-md border border-tagborder bg-tagbg px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted transition hover:border-borderhover hover:text-hi"
          >
            <Trash2 className="h-3 w-3 stroke-[1.5]" />
            Clear
          </button>
        </div>
      </div>
      <div
        ref={scroller}
        className="uranus-scroll flex-1 overflow-y-auto px-3 py-3 font-mono text-[12px] leading-relaxed"
      >
        {rendered.length === 0 ? (
          <div className="flex h-full items-center justify-center text-meta">
            waiting for first tool invocation…
          </div>
        ) : (
          <ul className="space-y-1.5">
            {rendered.map((entry) => (
              <LogRow key={entry.id} entry={entry} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function LogRow({ entry }: { entry: LogEntry }) {
  const tags = extractTags(entry);
  const hasRich =
    tags.status ||
    tags.hash ||
    tags.tx ||
    tags.signature ||
    tags.balance !== undefined ||
    tags.violations;

  return (
    <li className="fade-in-up grid grid-cols-[80px_16px_1fr] items-start gap-2 rounded-md px-2 py-1 hover:bg-base/50">
      <span className="pt-0.5 text-[11px] text-[#52525B]">{formatTs(entry.ts)}</span>
      <span className="pt-1">
        <LevelIcon level={entry.level} />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[#D4D4D8]">{entry.message}</p>
        {hasRich && (
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {tags.status && <NeutralTag>{tags.status}</NeutralTag>}
            {tags.hash && (
              <ProofChip icon={<Hash className="h-3 w-3 stroke-[1.5]" />} label="PAYLOAD" value={tags.hash} />
            )}
            {tags.tx && <ProofChip icon={<Hash className="h-3 w-3 stroke-[1.5]" />} label="TX" value={tags.tx} />}
            {tags.signature && (
              <ProofChip icon={<Hash className="h-3 w-3 stroke-[1.5]" />} label="SIG" value={tags.signature} />
            )}
            {tags.balance !== undefined && (
              <ProofChip
                icon={<Hash className="h-3 w-3 stroke-[1.5]" />}
                label="BAL"
                value={`$${tags.balance.toFixed(2)}`}
                truncate={false}
              />
            )}
          </div>
        )}
        {tags.violations && tags.violations.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {tags.violations.map((v) => (
              <span
                key={v}
                className="rounded-sm border border-tagborder bg-tagbg px-1.5 py-[1px] font-mono text-[9px] text-tagtext"
              >
                {v}
              </span>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

function NeutralTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md border border-tagborder bg-tagbg px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-tagtext">
      {children}
    </span>
  );
}

function ProofChip({
  icon,
  label,
  value,
  truncate = true,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  truncate?: boolean;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md border border-tagborder bg-base px-1.5 py-0.5 font-mono text-[11px] text-muted"
      title={value}
    >
      <span className="text-meta">{icon}</span>
      <span className="text-[9px] uppercase tracking-[0.14em] text-meta">{label}</span>
      <span className={`${truncate ? 'max-w-[220px] truncate' : ''} text-[11px] text-muted`}>
        {value}
      </span>
    </span>
  );
}
