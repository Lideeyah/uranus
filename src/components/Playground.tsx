'use client';

import { useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { useWebMCP } from '@/context/WebMCPContext';
import { httpSubmitPreset } from '@/lib/bridge-client';
import { generateIdempotencyKey } from '@/lib/crypto';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'USDC'];

export default function Playground() {
  const { addLog, pending } = useWebMCP();
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<string>('USD');
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const parsedAmount = Number(amount);
  const canSubmit =
    recipient.trim().length > 0 &&
    amount.trim().length > 0 &&
    Number.isFinite(parsedAmount) &&
    reason.trim().length > 0 &&
    !sending;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSending(true);
    setLastResult(null);
    const key = generateIdempotencyKey();
    addLog(
      'info',
      `→ playground · ${currency} ${parsedAmount.toFixed(2)} to ${recipient.trim()}`,
    );
    try {
      const result = await httpSubmitPreset(
        {
          recipient_id: recipient.trim(),
          amount: parsedAmount,
          currency,
          reason: reason.trim(),
          idempotency_key: key,
        },
        'unknown',
      );
      const line = `${result.status}${result.reason ? ' · ' + result.reason : ''}`;
      setLastResult(line);
      addLog(
        result.status === 'BLOCKED'
          ? 'error'
          : result.status === 'REJECTED'
            ? 'warn'
            : 'success',
        `playground → ${result.status}`,
        result.reason ? { reason: result.reason } : undefined,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setLastResult(`error · ${msg}`);
      addLog('error', 'playground submit failed', { error: msg });
    } finally {
      setSending(false);
    }
  }

  const awaitingOperator = sending && pending.length > 0;

  return (
    <section className="mx-auto w-full max-w-[1600px] px-4 pt-4 sm:px-6 md:px-8">
      <div className="rounded-lg border border-border bg-surface p-3 sm:p-4">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-hi">Send a custom settlement</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-muted">
            Try any recipient, amount, or currency — Uranus evaluates against your live policy in real
            time. Small amounts sign-and-settle automatically; larger ones or denylisted recipients open
            the authorization card in the workspace on the right.
          </p>
        </div>
        <form
          onSubmit={submit}
          className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 md:grid-cols-[1.4fr_0.7fr_0.6fr_1.5fr_auto]"
        >
          <Field label="Recipient">
            <input
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="cust_alice · hacker_0x99"
              spellCheck={false}
              className="w-full rounded-md border border-tagborder bg-base px-3 py-2 font-mono text-xs text-hi outline-none transition placeholder:text-meta focus:border-borderhover"
            />
          </Field>
          <Field label="Amount">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="50"
              type="number"
              inputMode="decimal"
              step="0.01"
              min={0}
              className="w-full rounded-md border border-tagborder bg-base px-3 py-2 font-mono text-xs text-hi outline-none transition placeholder:text-meta focus:border-borderhover"
            />
          </Field>
          <Field label="Currency">
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full appearance-none rounded-md border border-tagborder bg-base px-3 py-2 font-mono text-xs text-hi outline-none transition focus:border-borderhover"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Reason">
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Duplicate charge refund"
              className="w-full rounded-md border border-tagborder bg-base px-3 py-2 text-xs text-hi outline-none transition placeholder:text-meta focus:border-borderhover"
            />
          </Field>
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex h-[40px] w-full items-center justify-center gap-2 rounded-md bg-hi px-4 text-xs font-semibold text-base transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 sm:col-span-2 md:col-span-1 md:w-auto"
          >
            {sending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin stroke-[1.5]" />
            ) : (
              <>
                <Send className="h-3.5 w-3.5 stroke-[1.5]" />
                Send
              </>
            )}
          </button>
        </form>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-[0.14em] text-meta">
          {awaitingOperator && (
            <span className="text-hi">
              intercepted — resolve in the authorization card on the right
            </span>
          )}
          {lastResult && !awaitingOperator && (
            <span>
              last result → <span className="text-hi">{lastResult}</span>
            </span>
          )}
          {!lastResult && !awaitingOperator && (
            <span>
              tip: try <span className="text-hi">$50</span> for auto-approve,{' '}
              <span className="text-hi">$5000</span> for step-up authorization,{' '}
              <span className="text-hi">hacker_0x99</span> for a deny-list hit
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="font-mono text-[9px] uppercase tracking-[0.18em] text-meta">{label}</label>
      {children}
    </div>
  );
}
