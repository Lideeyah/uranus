import ActivityPanel from '@/components/ActivityPanel';
import ChainRibbon from '@/components/ChainRibbon';
import Header from '@/components/Header';
import Playground from '@/components/Playground';
import Scenarios from '@/components/Scenarios';
import TerminalStream from '@/components/TerminalStream';

export default function Page() {
  return (
    <main className="flex min-h-screen flex-col bg-base text-hi">
      <Header />
      <Scenarios />
      <Playground />

      <section className="mx-auto grid w-full max-w-[1600px] flex-1 items-start gap-4 px-8 py-4 lg:grid-cols-2">
        <div className="flex min-h-[560px] flex-col">
          <TerminalStream />
        </div>
        <div className="flex flex-col gap-4">
          <ActivityPanel />
        </div>
      </section>

      <ChainRibbon />

      <footer className="border-t border-border bg-surface/60 px-8 py-2">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-meta">
          <span>uranus · webmcp gateway · v0.1.0 · P-256 signed</span>
          <span>openai webmcp challenge</span>
        </div>
      </footer>
    </main>
  );
}
