'use client';

import { useEffect } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  Hash,
  KeyRound,
  Link as LinkIcon,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { AuditBlock, ToolStatus } from '@/lib/types';
import type { ChainVerification } from '@/lib/audit-chain';

interface Props {
  open: boolean;
  onClose: () => void;
  chain: AuditBlock[];
  verification: ChainVerification | null;
}

function formatTs(ts: number) {
  const d = new Date(ts);
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function statusLabel(status: ToolStatus): string {
  return status.replace(/_/g, ' ');
}

export default function ChainModal({ open, onClose, chain, verification }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const valid = verification?.valid ?? true;
  const head = verification?.head_hash ?? '0x' + '0'.repeat(64);
  const blocks = chain.slice().reverse();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="fade-in-up flex max-h-[85vh] w-[min(920px,92vw)] flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-2 text-hi">
            <LinkIcon className="h-4 w-4 stroke-[1.5] text-muted" />
            <span className="text-sm font-semibold tracking-tight">
              Cryptographic Audit Chain · Full View
            </span>
            <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.18em] text-meta">
              SHA-256 hash-chained · ECDSA P-256 signed
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`flex items-center gap-1 rounded-md border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] ${
                valid
                  ? 'border-tagborder bg-tagbg text-tagtext'
                  : 'border-rose-950/50 bg-rose/5 text-rose'
              }`}
            >
              {valid ? (
                <ShieldCheck className="h-3.5 w-3.5 stroke-[1.5]" />
              ) : (
                <ShieldAlert className="h-3.5 w-3.5 stroke-[1.5]" />
              )}
              {valid ? `verified · ${chain.length} blocks` : `broken at #${verification?.broken_at ?? '?'}`}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-tagborder bg-tagbg text-muted transition hover:border-borderhover hover:text-hi"
              aria-label="Close"
            >
              <X className="h-4 w-4 stroke-[1.5]" />
            </button>
          </div>
        </div>

        <div className="border-b border-border px-5 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-meta">
            Head hash · genesis-anchored
          </p>
          <p className="mt-1 truncate font-mono text-[12px] text-hi">{head}</p>
        </div>

        <div className="uranus-scroll flex-1 overflow-y-auto p-5">
          {blocks.length === 0 ? (
            <p className="py-8 text-center font-mono text-[11px] text-meta">
              genesis · no blocks written yet
            </p>
          ) : (
            <ol className="space-y-3">
              {blocks.map((b, i) => (
                <li
                  key={b.index}
                  className="rounded-md border border-border bg-base p-4 font-mono text-[11px]"
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="rounded-md border border-tagborder bg-tagbg px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-tagtext">
                        #{b.index}
                      </span>
                      <span className="text-muted">{formatTs(b.timestamp)}</span>
                      <span className="text-tagtext">{statusLabel(b.status)}</span>
                    </div>
                    <span className="text-meta">tool · {b.tool_name}</span>
                  </div>

                  <BlockField
                    icon={<Hash className="h-3 w-3 stroke-[1.5]" />}
                    label="Current hash"
                    value={b.current_hash}
                    tone="hi"
                  />
                  <BlockField
                    icon={<ChevronDown className="h-3 w-3 stroke-[1.5] rotate-180" />}
                    label="Previous hash"
                    value={b.previous_hash}
                  />
                  <BlockField
                    icon={<Hash className="h-3 w-3 stroke-[1.5]" />}
                    label="Payload hash"
                    value={b.payload_hash}
                  />
                  <BlockField
                    icon={<KeyRound className="h-3 w-3 stroke-[1.5]" />}
                    label="Signature (ECDSA P-256)"
                    value={b.signature}
                  />
                  <BlockField
                    icon={<KeyRound className="h-3 w-3 stroke-[1.5]" />}
                    label="Operator fingerprint"
                    value={b.operator_fingerprint}
                  />
                  <BlockField
                    icon={<Hash className="h-3 w-3 stroke-[1.5]" />}
                    label="Request ID"
                    value={b.request_id}
                  />

                  {i < blocks.length - 1 && (
                    <div className="mt-3 flex items-center gap-2 border-t border-border pt-3 text-meta">
                      <CheckCircle2 className="h-3 w-3 stroke-[1.5] text-muted" />
                      <span className="text-[10px] uppercase tracking-[0.16em]">
                        links to block #{blocks[i + 1].index}
                      </span>
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="border-t border-border px-5 py-3 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-meta">
          Press Esc or click outside to close
        </div>
      </div>
    </div>
  );
}

function BlockField({
  icon,
  label,
  value,
  tone = 'muted',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: 'hi' | 'muted';
}) {
  const toneCls = tone === 'hi' ? 'text-hi' : 'text-muted';
  return (
    <div className="mt-1.5 grid grid-cols-[180px_1fr] items-start gap-3">
      <div className="flex items-center gap-1.5 text-meta">
        {icon}
        <span className="text-[10px] uppercase tracking-[0.16em]">{label}</span>
      </div>
      <p className={`break-all text-[11px] ${toneCls}`}>{value}</p>
    </div>
  );
}
