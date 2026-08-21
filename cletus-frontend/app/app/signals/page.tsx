'use client';

/**
 * Signals page — CoinGecko terminal style, USDC only (not USDT)
 * Black background, logo on every page.
 * Route: /app/signals or /signals
 */

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';

type Signal = {
  id: string;
  pair: string;
  base: string;
  quote: 'USDC';
  side: 'LONG' | 'SHORT';
  score: number;
  priceUsd: number;
  change24h: number;
  volume24h: number;
  mcap: number;
  signals: string[];
  updatedAt: string;
};

function formatUsd(n: number) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function formatPrice(n: number) {
  if (n < 0.0001) return n.toExponential(2);
  if (n < 0.01) return n.toFixed(6);
  if (n < 1) return n.toFixed(4);
  return n.toFixed(2);
}

export default function SignalsPage() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'LONG' | 'SHORT'>('ALL');

  const fetchSignals = useCallback(async () => {
    try {
      const res = await fetch('/api/signals?quote=USDC');
      if (res.ok) {
        const data = await res.json();
        setSignals(data.signals ?? []);
      }
    } catch {
      // keep previous
    } finally {
      setLoading(false);
      setLastUpdated(new Date().toLocaleTimeString());
    }
  }, []);

  useEffect(() => {
    fetchSignals();
    const t = setInterval(fetchSignals, 20_000);
    return () => clearInterval(t);
  }, [fetchSignals]);

  const visible = signals.filter((s) =>
    filter === 'ALL' ? true : s.side === filter
  );

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
              <div className="text-xs text-white/50 mt-0.5">Signals · USDC</div>
            </div>
          </Link>
          <div className="flex items-center gap-3 text-xs font-mono text-white/50">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              LIVE
            </span>
            <span>CoinGecko terminal</span>
            {lastUpdated && <span>Updated {lastUpdated}</span>}
          </div>
        </div>
      </header>

      <main className="flex-1 px-6 py-8">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Market Signals</h1>
              <p className="text-sm text-white/50 mt-1">
                Quote currency:{' '}
                <span className="text-emerald-400 font-mono">USDC</span> only · Terminal-style
                feed
              </p>
            </div>
            <div className="flex items-center gap-2">
              {(['ALL', 'LONG', 'SHORT'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-all ${
                    filter === f
                      ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10'
                      : 'border-white/10 text-white/50 hover:border-white/30'
                  }`}
                >
                  {f}
                </button>
              ))}
              <button
                onClick={fetchSignals}
                className="px-3 py-1.5 rounded-lg text-xs font-mono border border-white/10 text-white/60 hover:text-white hover:border-white/30"
              >
                ↻ Refresh
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 overflow-hidden bg-[#0a0a0a]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm font-mono">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.03] text-white/40 text-xs uppercase tracking-wider">
                    <th className="text-left py-3 px-4">Pair</th>
                    <th className="text-left py-3 px-4">Side</th>
                    <th className="text-right py-3 px-4">Price (USDC)</th>
                    <th className="text-right py-3 px-4">24h</th>
                    <th className="text-right py-3 px-4">Vol 24h</th>
                    <th className="text-right py-3 px-4">Mcap</th>
                    <th className="text-right py-3 px-4">Score</th>
                    <th className="text-left py-3 px-4">Signals</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {loading && visible.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-white/30">
                        Loading terminal feed…
                      </td>
                    </tr>
                  )}
                  {!loading && visible.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-white/30">
                        No USDC signals yet
                      </td>
                    </tr>
                  )}
                  {visible.map((s) => (
                    <tr key={s.id} className="hover:bg-white/[0.03] transition-colors">
                      <td className="py-3 px-4">
                        <span className="text-white font-semibold">{s.base}</span>
                        <span className="text-white/40">/USDC</span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-xs px-2 py-0.5 rounded font-semibold ${
                            s.side === 'LONG'
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : 'bg-red-500/15 text-red-400'
                          }`}
                        >
                          {s.side}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-white">
                        {formatPrice(s.priceUsd)}
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-semibold ${
                          s.change24h >= 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {s.change24h >= 0 ? '+' : ''}
                        {s.change24h.toFixed(2)}%
                      </td>
                      <td className="py-3 px-4 text-right text-white/70">
                        {formatUsd(s.volume24h)}
                      </td>
                      <td className="py-3 px-4 text-right text-white/70">
                        {formatUsd(s.mcap)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span
                          className={`px-2 py-0.5 rounded text-xs ${
                            s.score >= 80
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : s.score >= 60
                              ? 'bg-yellow-500/15 text-yellow-400'
                              : 'bg-white/5 text-white/50'
                          }`}
                        >
                          {s.score}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-white/50">
                        {s.signals.join(' · ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-white/10 px-4 py-2 flex justify-between text-xs text-white/30 font-mono">
              <span>Quote: USDC · Source style: CoinGecko terminal</span>
              <span>{visible.length} rows</span>
            </div>
          </div>

          <p className="text-xs text-white/30 text-center">
            Signals are informational only. Not financial advice. Trading involves risk of
            loss.
          </p>
        </div>
      </main>
    </div>
  );
}
