'use client';

import { useState } from 'react';
import { KeyRound, Link as LinkIcon, Sliders, WifiOff } from 'lucide-react';
import { useWebMCP } from '@/context/WebMCPContext';
import PolicyModal from './PolicyModal';
import UranusLogo from './UranusLogo';

function formatUSD(n: number | undefined | null): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Header() {
  const { ledger, linkStatus, chainVerification, chain, fingerprint } = useWebMCP();
  const chainOk = chainVerification?.valid ?? true;
  const online = linkStatus === 'online';
  const [policyOpen, setPolicyOpen] = useState(false);

  return (
    <>
      <header className="border-b border-border bg-surface/50 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4 px-4 py-3 sm:gap-6 sm:px-6 md:px-8 md:py-3.5">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <UranusLogo size={28} className="sm:hidden" />
            <UranusLogo size={32} className="hidden sm:inline-flex" />
            <div className="flex flex-col leading-tight">
              <span className="text-lg font-semibold tracking-tight text-hi sm:text-xl">
                Uranus
              </span>
              <span className="hidden font-mono text-[10px] uppercase tracking-[0.18em] text-meta sm:inline">
                WebMCP Security Gateway &amp; Cryptographic Proxy
              </span>
              <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-meta sm:hidden">
                WebMCP Security Gateway
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-3 sm:gap-x-5">
            <Chip label="Treasury" value={formatUSD(ledger?.balance)} emphasized />
            <Divider />
            <Chip
              label="Bridge"
              value={online ? 'Online' : 'Offline'}
              leading={
                online ? (
                  <StatusDot />
                ) : (
                  <WifiOff className="h-3.5 w-3.5 stroke-[1.5] text-muted" />
                )
              }
            />
            <Divider />
            <Chip
              label="Chain"
              value={`${chain.length} · ${chainOk ? 'verified' : 'broken'}`}
              leading={<LinkIcon className="h-3.5 w-3.5 stroke-[1.5] text-muted" />}
            />
            <Divider className="hidden md:block" />
            <Chip
              label="Operator Key"
              value={
                fingerprint
                  ? `${fingerprint.slice(0, 6)}··${fingerprint.slice(-4)}`
                  : 'generating…'
              }
              mono
              leading={<KeyRound className="h-3.5 w-3.5 stroke-[1.5] text-muted" />}
            />
            <Divider className="hidden sm:block" />
            <button
              type="button"
              onClick={() => setPolicyOpen(true)}
              className="flex min-h-[38px] items-center justify-center gap-1.5 rounded-md border border-tagborder bg-tagbg px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted transition hover:border-borderhover hover:text-hi"
              title="Adjust dynamic policy (auto-approval cap, velocity, deny-list)"
              aria-label="Adjust dynamic policy"
            >
              <Sliders className="h-3.5 w-3.5 stroke-[1.5]" />
              <span className="hidden sm:inline">Adjust Policy</span>
              <span className="sm:hidden">Policy</span>
            </button>
          </div>
        </div>
      </header>
      <PolicyModal open={policyOpen} onClose={() => setPolicyOpen(false)} />
    </>
  );
}

function StatusDot() {
  return <span className="soft-pulse h-1.5 w-1.5 rounded-full bg-emerald" />;
}

function Divider({ className = '' }: { className?: string }) {
  return <div className={`h-6 w-px bg-border ${className}`} aria-hidden />;
}

function Chip({
  label,
  value,
  emphasized = false,
  mono = false,
  leading,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
  mono?: boolean;
  leading?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 sm:gap-2.5">
      {leading && <span className="flex items-center">{leading}</span>}
      <div className="flex flex-col leading-tight">
        <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-meta">{label}</span>
        <span
          className={`text-hi ${
            emphasized
              ? 'text-base font-semibold tracking-tight sm:text-lg'
              : 'text-xs font-medium sm:text-sm'
          } ${mono ? 'font-mono text-[11px] sm:text-xs' : ''}`}
        >
          {value}
        </span>
      </div>
    </div>
  );
}
