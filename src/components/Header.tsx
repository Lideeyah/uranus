'use client';

import { KeyRound, Link as LinkIcon, WifiOff } from 'lucide-react';
import { useWebMCP } from '@/context/WebMCPContext';
import UranusLogo from './UranusLogo';

function formatUSD(n: number | undefined | null): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Header() {
  const { ledger, linkStatus, chainVerification, chain, fingerprint } = useWebMCP();
  const chainOk = chainVerification?.valid ?? true;
  const online = linkStatus === 'online';

  return (
    <header className="border-b border-border bg-surface/50 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-6 px-8 py-3.5">
        <div className="flex items-center gap-3">
          <UranusLogo size={32} />
          <div className="flex flex-col leading-tight">
            <span className="text-xl font-semibold tracking-tight text-hi">Uranus</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-meta">
              WebMCP Security Gateway &amp; Cryptographic Proxy
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-5">
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
          <Divider />
          <Chip
            label="Operator Key"
            value={
              fingerprint ? `${fingerprint.slice(0, 8)}··${fingerprint.slice(-6)}` : 'generating…'
            }
            mono
            leading={<KeyRound className="h-3.5 w-3.5 stroke-[1.5] text-muted" />}
          />
        </div>
      </div>
    </header>
  );
}

function StatusDot() {
  return <span className="soft-pulse h-1.5 w-1.5 rounded-full bg-emerald" />;
}

function Divider() {
  return <div className="h-6 w-px bg-border" aria-hidden />;
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
    <div className="flex items-center gap-2.5">
      {leading && <span className="flex items-center">{leading}</span>}
      <div className="flex flex-col leading-tight">
        <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-meta">{label}</span>
        <span
          className={`text-hi ${
            emphasized ? 'text-lg font-semibold tracking-tight' : 'text-sm font-medium'
          } ${mono ? 'font-mono text-xs' : ''}`}
        >
          {value}
        </span>
      </div>
    </div>
  );
}
