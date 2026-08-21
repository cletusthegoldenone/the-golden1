'use client';

/**
 * Landing page — first public face of Cletus
 * Black, logo, bold, then CTA into legal gate.
 * Route: /  (or /home — wire root to this)
 */

import Image from 'next/image';
import Link from 'next/link';

const FEATURES = [
  {
    icon: '⚡',
    title: 'Autonomous signals',
    body: 'Cletus scans Solana markets in USDC, scores setups, and surfaces what matters.',
  },
  {
    icon: '🤖',
    title: 'Talk to Cletus',
    body: 'Text chat and Cletus Live voice. Ask about risk, tokens, and your setup.',
  },
  {
    icon: '📊',
    title: 'Your PnL only',
    body: 'Personal dashboard tracks your gains, losses, win rate, and open trades.',
  },
  {
    icon: '🛡️',
    title: 'Policy-gated trading',
    body: 'Hours, size, stops, daily profit and loss limits. You set the rules.',
  },
  {
    icon: '🔍',
    title: 'Dev wallet audit',
    body: 'Paste a developer address. Community sees the risk signal.',
  },
  {
    icon: '🪙',
    title: 'Stake tiers · $CLETUS soon',
    body: 'Monthly profit caps by tier. Token staking coming soon.',
  },
];

const STEPS = [
  { n: '01', title: 'Accept the risk', desc: 'Legal gate. Own volition. Clear eyes.' },
  { n: '02', title: 'Register · free trial', desc: 'Tax Center + 30-day trial. Unlock your wallet.' },
  { n: '03', title: 'Configure & run', desc: 'Aggression, hours, limits. Start paper or live.' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      {/* Nav */}
      <header className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-black/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/cletus-logo.png"
              alt="Cletus"
              width={40}
              height={40}
              className="object-contain"
              priority
            />
            <div className="flex items-baseline gap-1.5">
              <span className="font-bold text-lg tracking-tight">Cletus</span>
              <span className="text-emerald-400 text-[10px] font-mono tracking-[3px]">
                PRO
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/legal"
              className="hidden sm:inline text-sm text-white/50 hover:text-white transition-colors"
            >
              Enter app
            </Link>
            <Link
              href="/legal"
              className="px-4 py-2 rounded-full text-sm font-semibold bg-emerald-500 text-black hover:bg-emerald-400 transition-colors"
            >
              Start free trial
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative pt-28 pb-20 px-6">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-emerald-500/10 blur-[120px]" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-yellow-500/5 blur-[100px]" />
        </div>

        <div className="relative max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-semibold tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              30-DAY FREE TRIAL · NO STAKE REQUIRED
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05]">
              Autonomous trading.
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-yellow-300 to-emerald-400">
                On your terms.
              </span>
            </h1>

            <p className="text-lg text-white/55 max-w-lg leading-relaxed">
              Cletus is an AI-assisted Solana trading system. Signals in USDC. Policy gates.
              Personal PnL. Community audits. You set the limits — he runs the scan.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/legal"
                className="px-8 py-4 rounded-full text-base font-bold bg-white text-black hover:bg-white/90 transition-colors text-center"
              >
                Enter Cletus →
              </Link>
              <Link
                href="/legal"
                className="px-8 py-4 rounded-full text-base font-semibold border border-white/20 text-white/80 hover:bg-white/5 transition-colors text-center"
              >
                Read the risk first
              </Link>
            </div>

            <p className="text-xs text-white/30 max-w-md">
              Educational software. Not financial advice. Crypto trading can result in total
              loss of capital. You enter on your own volition.
            </p>
          </div>

          <div className="relative flex justify-center lg:justify-end">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-yellow-500/10 blur-3xl rounded-full scale-110" />
              <Image
                src="/cletus-logo.png"
                alt="Cletus"
                width={320}
                height={320}
                className="relative object-contain drop-shadow-[0_0_60px_rgba(16,185,129,0.35)]"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="border-y border-white/10 bg-white/[0.02]">
        <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { k: 'Quote', v: 'USDC' },
            { k: 'Trial', v: '30 days' },
            { k: 'Chain', v: 'Solana' },
            { k: 'Mode', v: 'Policy-gated' },
          ].map((s) => (
            <div key={s.k}>
              <div className="text-2xl font-bold font-mono text-emerald-400">{s.v}</div>
              <div className="text-xs text-white/40 uppercase tracking-wider mt-1">{s.k}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight">Built for the whole stack</h2>
          <p className="text-white/45 mt-2 max-w-xl mx-auto text-sm">
            Multi-page app — not a single scroll of tabs. Legal gate, tax center, wallet,
            signals, chart, community, AI, config, live trade.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-white/10 bg-[#0c0c0c] p-6 hover:border-emerald-500/30 transition-colors"
            >
              <div className="text-2xl mb-3">{f.icon}</div>
              <h3 className="font-semibold text-lg">{f.title}</h3>
              <p className="text-sm text-white/45 mt-2 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-white/10 bg-white/[0.02]">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <h2 className="text-3xl font-bold tracking-tight text-center mb-12">
            How you get in
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {STEPS.map((s) => (
              <div
                key={s.n}
                className="rounded-2xl border border-white/10 bg-black p-6 relative"
              >
                <div className="text-4xl font-black text-white/10 absolute top-4 right-5">
                  {s.n}
                </div>
                <h3 className="font-bold text-lg relative">{s.title}</h3>
                <p className="text-sm text-white/45 mt-2 relative">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-6xl mx-auto px-6 py-24 text-center">
        <Image
          src="/cletus-logo.png"
          alt="Cletus"
          width={80}
          height={80}
          className="mx-auto object-contain mb-6"
        />
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
          Ready when you are.
        </h2>
        <p className="text-white/50 max-w-md mx-auto mb-8 text-sm">
          Accept the disclaimer. Start the trial. Configure the machine. Track only your PnL.
        </p>
        <Link
          href="/legal"
          className="inline-block px-10 py-4 rounded-full text-base font-bold bg-emerald-500 text-black hover:bg-emerald-400 transition-colors"
        >
          I understand the risks — Enter Cletus
        </Link>
        <p className="mt-6 text-xs text-white/25">
          Not a broker. Not advice. High risk of loss.
        </p>
      </section>

      <footer className="border-t border-white/10 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/30">
          <div className="flex items-center gap-2">
            <Image
              src="/cletus-logo.png"
              alt=""
              width={24}
              height={24}
              className="object-contain opacity-70"
            />
            <span>Cletus · Autonomous trading system</span>
          </div>
          <div className="flex gap-4">
            <Link href="/legal" className="hover:text-white/60">
              Legal
            </Link>
            <span>·</span>
            <span>Educational only</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
