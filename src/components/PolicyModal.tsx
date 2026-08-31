'use client';

import { useEffect } from 'react';
import { Sliders, X } from 'lucide-react';
import PolicyEditor from './PolicyEditor';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function PolicyModal({ open, onClose }: Props) {
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-3 backdrop-blur-sm sm:p-6 md:p-8"
      onClick={onClose}
    >
      <div
        className="fade-in-up flex max-h-[92vh] w-full max-w-[560px] flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-panel sm:max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-2 text-hi">
            <Sliders className="h-4 w-4 stroke-[1.5] text-muted" />
            <span className="text-sm font-semibold tracking-tight">Adjust dynamic policy</span>
            <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.18em] text-meta">
              live · zero restart
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-tagborder bg-tagbg text-muted transition hover:border-borderhover hover:text-hi"
            aria-label="Close"
          >
            <X className="h-4 w-4 stroke-[1.5]" />
          </button>
        </div>
        <div className="uranus-scroll flex-1 overflow-y-auto">
          <PolicyEditor />
        </div>
        <div className="border-t border-border px-5 py-2 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-meta">
          Press Esc or click outside to close · changes broadcast to every connected client instantly
        </div>
      </div>
    </div>
  );
}
