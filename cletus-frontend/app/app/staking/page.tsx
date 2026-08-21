'use client';

/**
 * Staking page — tier levels (stake amount → monthly profit cap)
 * + stake UI for Coming Soon $CLETUS token
 * Black background, logo on every page.
 * Route: /app/staking
 */

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

type Tier = {
  id: string;
  label: string;
  stakeLabel: string;
  stakeMin: number;
  profitCap: string;
  profitSub: string;
  icon: string;
  accent: string;
  border: string;
  featured?: boolean;
};

const TIERS: Tier[] = [
  {
    id: 'starter',
    label: 'Starter',
    stakeLabel: '500K',
    stakeMin: 500_000,
    profitCap: '$750',
    profitSub: 'monthly profit cap from Cletus trading',
    icon: '🌱',
    accent: 'text-emerald-400',
    border: 'border-emerald-500/40',
  },
  {
    id: 'growth',
    label: 'Growth',
    stakeLabel: '2M',
    stakeMin: 2_000_000,
    profitCap: '$1,500',
    profitSub: 'monthly profit cap from Cletus trading',
    icon: '📈',
    accent: 'text-blue-400',
    border: 'border-blue-500/40',
  },
  {
    id: 'pro',
    label: 'Pro',
    stakeLabel: '5M',
    stakeMin: 5_000_000,
    profitCap: '$3,000',
    profitSub: 'monthly profit cap from Cletus trading',
    icon: '⚡',
    accent: 'text-emerald-400',
    border: 'border-emerald-500',
    featured: true,
  },
  {
    id: 'elite',
    label: 'Elite',
    stakeLabel: '10M',
    stakeMin: 10_000_000,
    profitCap: '$10,000',
    profitSub: 'monthly profit cap from Cletus trading',
    icon: '👑',
    accent: 'text-yellow-400',
    border: 'border-yellow-500/40',
  },
  {
    id: 'whale',
    label: 'Whale',
    stakeLabel: '25M+',
    stakeMin: 25_000_000,
    profitCap: 'Unlimited',
    profitSub: 'profit from Cletus trading',
    icon: '🐋',
    accent: 'text-purple-400',
    border: 'border-purple-500/40',
  },
];

function tierForAmount(amount: number): Tier | null {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  let matched: Tier | null = null;
  for (const t of TIERS) {
    if (amount >= t.stakeMin) matched = t;
  }
  return matched;
}

export default function StakingPage() {
  const [stakeAmount, setStakeAmount] = useState('');
  const [agreed, setAgreed] = useState(false);
  const parsed = Number(stakeAmount.replace(/,/g, ''));
  const previewTier = tierForAmount(parsed);

  const handleStake = (e: React.FormEvent) => {
    e.preventDefault();
    // Coming soon — no on-chain stake yet
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Logo on every page */}
      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <Link href="/app" className="flex items-center gap-3">
            <Image
              src="/cletus-logo.png"
              alt="Cletus"
              width={40}
              height={40}
              className="object-contain"
              priority
            />
            <div>
              <div className="font-bold text-lg tracking-tight leading-none">Cletus</div>
              <div className="text-xs text-white/50 mt-0.5">Staking</div>
            </div>
          </Link>
          <nav className="flex items-center gap-3 text-xs">
            <Link href="/app/wallet" className="text-white/50 hover:text-white transition-colors">
              Wallet
            </Link>
            <Link href="/app/ai" className="text-white/50 hover:text-white transition-colors">
              Talk to Cletus
            </Link>
            <Link href="/app/signals" className="text-white/50 hover:text-white transition-colors">
              Signals
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 px-6 py-8">
        <div className="max-w-5xl mx-auto space-y-10">
          <div className="text-center max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-yellow-500/40 bg-yellow-500/10 text-yellow-400 text-xs font-semibold tracking-wider mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
              $CLETUS TOKEN · COMING SOON
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Staking</h1>
            <p className="text-sm text-white/50 mt-2">
              How much you stake sets your <strong className="text-white/70">monthly profit cap</strong> from
              Cletus trading on your behalf. Stake the Coming Soon <strong className="text-yellow-400">$CLETUS</strong> token when it launches.
            </p>
          </div>

          {/* Tier levels — same model as other dashboard */}
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-4 text-center">
              Tier levels · stake → monthly profit cap
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {TIERS.map((t) => (
                <div
                  key={t.id}
                  className={`rounded-2xl border-2 ${t.border} bg-white/5 p-5 flex flex-col items-center text-center relative ${
                    t.featured ? 'bg-emerald-500/5 shadow-lg shadow-emerald-500/10' : ''
                  }`}
                >
                  {t.featured && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2.5 py-0.5 bg-emerald-500 rounded-full text-[10px] font-bold text-black whitespace-nowrap">
                      MOST POPULAR
                    </div>
                  )}
                  <div className="text-2xl mb-2">{t.icon}</div>
                  <div className={`text-xs font-semibold tracking-widest ${t.accent}`}>
                    {t.label.toUpperCase()}
                  </div>
                  <div className="font-bold text-lg mt-1">
                    <span className={t.accent}>{t.stakeLabel}</span>
                    <span className="text-white/40 text-xs font-normal ml-1">$CLETUS</span>
                  </div>
                  <div className="text-[11px] text-white/35 mb-3">staked</div>
                  <div className={`w-full rounded-xl p-3 mb-2 bg-black/40`}>
                    <div className={`text-xl font-bold tracking-tight ${t.accent}`}>
                      {t.profitCap}
                    </div>
                    <div className="text-[11px] text-white/45 mt-0.5">{t.profitSub}</div>
                  </div>
                  <ul className="text-[11px] text-white/45 space-y-1 w-full text-left mt-1">
                    {['Full platform access', 'Live signals', 'AI chat', 'Community'].map((f) => (
                      <li key={f} className="flex items-center gap-1.5">
                        <span className={t.accent}>✓</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-white/30 text-center max-w-2xl mx-auto">
              Profit figures are <strong className="text-white/40">caps</strong> on what you can earn from Cletus
              trading for you — not guarantees. Actual results depend on markets and performance. Unstake
              rules will apply when the token is live.
            </p>
          </section>

          {/* Stake Coming Soon $CLETUS */}
          <section className="max-w-lg mx-auto">
            <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/5 p-6 sm:p-8 space-y-5">
              <div className="text-center">
                <div className="text-3xl mb-2">🪙</div>
                <h2 className="text-lg font-bold">Stake $CLETUS</h2>
                <p className="text-xs text-white/50 mt-1">
                  Token is <strong className="text-yellow-400">Coming Soon</strong>. Preview your tier
                  below — staking opens at public launch.
                </p>
              </div>

              <form onSubmit={handleStake} className="space-y-4">
                <div>
                  <label className="block text-xs text-white/45 mb-1.5">
                    Amount to stake ($CLETUS)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={stakeAmount}
                    onChange={(e) => setStakeAmount(e.target.value.replace(/[^0-9.,]/g, ''))}
                    placeholder="e.g. 5000000"
                    className="w-full border border-white/15 rounded-xl px-4 py-3 text-sm bg-black text-white font-mono focus:outline-none focus:border-yellow-500/50 placeholder:text-white/25"
                  />
                </div>

                {previewTier && (
                  <div className={`rounded-xl border ${previewTier.border} bg-black/40 p-4`}>
                    <div className="text-xs text-white/45 uppercase tracking-wider">Your tier preview</div>
                    <div className="flex items-center justify-between mt-1">
                      <span className={`font-bold ${previewTier.accent}`}>
                        {previewTier.icon} {previewTier.label}
                      </span>
                      <span className={`font-mono font-bold ${previewTier.accent}`}>
                        {previewTier.profitCap}
                        <span className="text-white/40 font-normal text-xs"> / mo cap</span>
                      </span>
                    </div>
                  </div>
                )}

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="mt-1 h-4 w-4 accent-yellow-500"
                  />
                  <span className="text-xs text-white/60">
                    I understand $CLETUS staking is Coming Soon, profit caps are not guaranteed returns,
                    and I will only stake what I can afford to lock under final token terms.
                  </span>
                </label>

                <button
                  type="submit"
                  disabled
                  className="w-full py-3.5 rounded-xl text-sm font-semibold bg-white/10 text-white/35 cursor-not-allowed"
                >
                  Stake $CLETUS — Coming Soon
                </button>
              </form>

              <p className="text-[11px] text-white/30 text-center">
                Contract address and stake program will be published at token launch. Educational
                product only — not financial advice.
              </p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
