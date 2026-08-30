'use client';

import { Fragment } from 'react';
import { CheckCircle2, ChevronRight, Link as LinkIcon, RefreshCcw } from 'lucide-react';
import { useWebMCP } from '@/context/WebMCPContext';

export default function ChainRibbon() {
  const { chain, chainVerification, verifyChainNow } = useWebMCP();
  const valid = chainVerification?.valid ?? true;
  const shown = chain.slice(-8).reverse();

  return (
    <section className="mx-auto w-full max-w-[1600px] px-8 py-4">
      <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <div className="flex items-center gap-2 text-hi">
            <LinkIcon className="h-4 w-4 stroke-[1.5] text-muted" />
            <span className="text-sm font-semibold tracking-tight">Cryptographic Audit Chain</span>
            <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.18em] text-meta">
              SHA-256 hash-chained · signed with ECDSA P-256
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-md border border-tagborder bg-tagbg px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-tagtext">
              {valid && <span className="soft-pulse h-1.5 w-1.5 rounded-full bg-emerald" />}
              {valid ? `chain verified · ${chain.length} blocks` : `chain broken`}
            </span>
            <button
              type="button"
              onClick={verifyChainNow}
              className="flex items-center gap-1 rounded-md border border-tagborder bg-tagbg px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted transition hover:border-borderhover hover:text-hi"
            >
              <RefreshCcw className="h-3 w-3 stroke-[1.5]" />
              Verify
            </button>
          </div>
        </div>

        <div className="uranus-scroll overflow-x-auto">
          {shown.length === 0 ? (
            <p className="px-4 py-6 text-center font-mono text-[11px] text-meta">
              genesis · no blocks written yet
            </p>
          ) : (
            <div className="flex items-stretch gap-2 px-4 py-3">
              {shown.map((b, i) => (
                <Fragment key={b.index}>
                  {i > 0 && (
                    <div className="flex items-center text-meta">
                      <ChevronRight className="h-3 w-3 stroke-[1.5]" />
                    </div>
                  )}
                  <div className="flex min-w-[220px] flex-col gap-1 rounded-md border border-tagborder bg-base px-3 py-2 font-mono text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-meta">#{b.index}</span>
                      <span className="text-[10px] text-tagtext">{b.status}</span>
                    </div>
                    <p className="truncate text-hi">{b.current_hash.slice(0, 18)}…</p>
                    <p className="truncate text-[10px] text-meta">
                      prev {b.previous_hash.slice(0, 10)}…
                    </p>
                    <div className="mt-0.5 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 stroke-[1.5] text-muted" />
                      <span className="text-[10px] text-meta">
                        payload {b.payload_hash.slice(0, 10)}…
                      </span>
                    </div>
                  </div>
                </Fragment>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
