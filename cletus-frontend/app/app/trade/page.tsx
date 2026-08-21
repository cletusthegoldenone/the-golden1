'use client';

/**
 * Active Trading / live trade section
 * Daily PnL limits, open positions Cletus is in, unrealized + realized PnL.
 * On-chain verification note. Driven by Trading Configuration.
 * Route: /app/trade
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';

type Position = {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  sizeUsd: number;
  entry: number;
  current: number;
  pnlUsd: number;
  pnlPercent: number;
  stopLoss: number;
  takeProfit: number;
  openedAt: string;
};

type TradeSession = {
  running: boolean;
  paused: boolean;
  pauseReason?: string;
  mode: 'paper' | 'live';
  capital: number;
  available: number;
  dailyRealizedPnl: number;
  dailyProfitTarget: number;
  dailyMaxLoss: number;
  openPositions: Position[];
  aggression: string;
  positionSizePercent: number;
  stopLossPercent: number;
  takeProfitPercent: number;
  maxPositions: number;
  withinHours: boolean;
};

const EMPTY: TradeSession = {
  running: false,
  paused: false,
  mode: 'paper',
  capital: 0,
  available: 0,
  dailyRealizedPnl: 0,
  dailyProfitTarget: 500,
  dailyMaxLoss: 50,
  openPositions: [],
  aggression: '—',
  positionSizePercent: 0,
  stopLossPercent: 0,
  takeProfitPercent: 0,
  maxPositions: 9,
  withinHours: true,
};

function formatUsd(n: number, showSign = false) {
  const abs = Math.abs(n);
  const s = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(abs);
  if (!showSign) return n < 0 ? `-${s}` : s;
  return `${n >= 0 ? '+' : '-'}${s}`;
}

function formatPrice(p: number) {
  if (p < 0.0001) return p.toExponential(2);
  if (p < 0.01) return p.toFixed(6);
  if (p < 1) return p.toFixed(4);
  return p.toFixed(2);
}

export default function ActiveTradingPage() {
  const [session, setSession] = useState<TradeSession>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/protected/trade/session', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setSession({
          running: !!data.running,
          paused: !!data.paused,
          pauseReason: data.pauseReason,
          mode: data.mode === 'live' ? 'live' : 'paper',
          capital: Number(data.capital) || 0,
          available: Number(data.available) || 0,
          dailyRealizedPnl: Number(data.dailyRealizedPnl) || 0,
          dailyProfitTarget: Number(data.dailyProfitTarget) ?? 500,
          dailyMaxLoss: Number(data.dailyMaxLoss) ?? 50,
          openPositions: Array.isArray(data.openPositions) ? data.openPositions : [],
          aggression: data.aggression ?? '—',
          positionSizePercent: Number(data.positionSizePercent) || 0,
          stopLossPercent: Number(data.stopLossPercent) || 0,
          takeProfitPercent: Number(data.takeProfitPercent) || 0,
          maxPositions: Number(data.maxPositions) || 9,
          withinHours: data.withinHours !== false,
        });
      }
    } catch {
      // keep previous
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 8_000);
    return () => clearInterval(t);
  }, [load]);

  const post = async (path: string) => {
    setBusy(true);
    try {
      await fetch(path, { method: 'POST', credentials: 'include' });
      await load();
    } finally {
      setBusy(false);
    }
  };

  // Unrealized PnL from open positions + realized = session view
  const unrealizedPnl = useMemo(
    () => session.openPositions.reduce((sum, p) => sum + (p.pnlUsd || 0), 0),
    [session.openPositions]
  );
  const totalSessionPnl = session.dailyRealizedPnl + unrealizedPnl;

  const profitPct =
    session.dailyProfitTarget > 0
      ? Math.min(
          100,
          Math.max(0, (session.dailyRealizedPnl / session.dailyProfitTarget) * 100)
        )
      : 0;
  const lossPct =
    session.dailyMaxLoss > 0
      ? Math.min(
          100,
          Math.max(
            0,
            (Math.abs(Math.min(0, session.dailyRealizedPnl)) / session.dailyMaxLoss) * 100
          )
        )
      : 0;

  const emptyReason = !session.running
    ? 'Engine stopped — start from Config or here'
    : session.paused
    ? `Paused${session.pauseReason ? `: ${session.pauseReason}` : ''}`
    : !session.withinHours
    ? 'Outside trading hours'
    : 'Waiting for qualifying signals…';

  return (
    <div className="min-h-screen bg-black text-white flex flex-col pb-20">
      <header className="border-b border-white/10 px-4 sm:px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <Link href="/app" className="flex items-center gap-2.5">
            <Image
              src="/cletus-logo.png"
              alt="Cletus"
              width={36}
              height={36}
              className="object-contain"
              priority
            />
            <div>
              <div className="font-bold text-lg tracking-tight leading-none">Cletus</div>
              <div className="text-xs text-white/50 mt-0.5">Live trade</div>
            </div>
          </Link>
          <Link
            href="/app/config"
            className="text-xs px-3 py-1.5 rounded-full border border-white/15 text-white/70 hover:text-white"
          >
            Configuration
          </Link>
        </div>
      </header>

      <main className="flex-1 px-4 sm:px-6 py-6">
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Status + controls */}
          <section className="rounded-2xl border border-white/10 bg-[#121212] p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    session.running && !session.paused
                      ? 'bg-emerald-400 animate-pulse'
                      : session.paused
                      ? 'bg-yellow-400'
                      : 'bg-white/30'
                  }`}
                />
                <span className="text-sm font-semibold">
                  {session.running
                    ? session.paused
                      ? 'Paused'
                      : 'Live'
                    : 'Stopped'}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/50 font-mono">
                  {session.mode.toUpperCase()}
                </span>
                {loading && <span className="text-xs text-white/30">…</span>}
              </div>
              <div className="flex gap-2">
                {!session.running ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => post('/api/protected/trade/start')}
                    className="px-4 py-2 rounded-full text-sm font-semibold bg-emerald-500 text-black"
                  >
                    ▶ Start
                  </button>
                ) : session.paused ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => post('/api/protected/trade/resume')}
                    className="px-4 py-2 rounded-full text-sm font-semibold bg-emerald-500 text-black"
                  >
                    ▶ Resume
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => post('/api/protected/trade/pause')}
                    className="px-4 py-2 rounded-full text-sm font-semibold border border-yellow-500/40 text-yellow-400"
                  >
                    ⏸ Pause
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => post('/api/protected/trade/stop')}
                  className="px-4 py-2 rounded-full text-sm border border-white/15 text-white/60"
                >
                  Stop
                </button>
              </div>
            </div>

            {/* Session PnL strip — what he's in + total */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="rounded-xl bg-black/40 border border-white/10 p-3 text-center">
                <div className="text-[10px] text-white/40 uppercase">Realized</div>
                <div
                  className={`text-sm font-mono font-bold mt-0.5 ${
                    session.dailyRealizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {formatUsd(session.dailyRealizedPnl, true)}
                </div>
              </div>
              <div className="rounded-xl bg-black/40 border border-white/10 p-3 text-center">
                <div className="text-[10px] text-white/40 uppercase">Unrealized</div>
                <div
                  className={`text-sm font-mono font-bold mt-0.5 ${
                    unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {formatUsd(unrealizedPnl, true)}
                </div>
              </div>
              <div className="rounded-xl bg-black/40 border border-white/10 p-3 text-center">
                <div className="text-[10px] text-white/40 uppercase">Session</div>
                <div
                  className={`text-sm font-mono font-bold mt-0.5 ${
                    totalSessionPnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {formatUsd(totalSessionPnl, true)}
                </div>
              </div>
            </div>
          </section>

          {/* On-chain verification */}
          <section className="rounded-2xl border border-white/10 bg-[#121212] p-4">
            <div className="flex gap-3">
              <span className="text-lg">🔍</span>
              <div>
                <h2 className="text-sm font-semibold">On-Chain Verification</h2>
                <p className="text-xs text-white/50 mt-1 leading-relaxed">
                  All fee distributions are executed on-chain and can be verified using{' '}
                  <a
                    href="https://explorer.solana.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-sky-400 hover:underline"
                  >
                    Solana Explorer
                  </a>{' '}
                  or{' '}
                  <a
                    href="https://solscan.io"
                    target="_blank"
                    rel="noreferrer"
                    className="text-sky-400 hover:underline"
                  >
                    Solscan
                  </a>
                  . See FEE_DISTRIBUTION.md for complete details.
                </p>
              </div>
            </div>
          </section>

          {/* Daily PnL limits — matches screenshot */}
          <section className="rounded-2xl border border-white/10 bg-[#121212] p-4 space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-white/40">
              Daily PnL Limits
            </h2>
            <div>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-white/60">Profit Target</span>
                <span className="font-mono text-emerald-400">
                  {formatUsd(session.dailyRealizedPnl, true)} / $
                  {session.dailyProfitTarget.toLocaleString()}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${profitPct}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-white/60">Max Loss Guard</span>
                <span className="font-mono text-red-400">
                  {formatUsd(Math.min(0, session.dailyRealizedPnl), true)} / -$
                  {session.dailyMaxLoss.toLocaleString()}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-red-500 rounded-full transition-all"
                  style={{ width: `${lossPct}%` }}
                />
              </div>
            </div>
          </section>

          {/* Open positions — trades Cletus is in + each position PnL */}
          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-white/40">
              Open Positions ({session.openPositions.length}
              {session.maxPositions ? ` / ${session.maxPositions}` : ''})
            </h2>

            {session.openPositions.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-[#121212] p-10 text-center">
                <div className="text-4xl mb-3">📭</div>
                <div className="text-sm text-white/50">No open positions</div>
                <div className="text-xs text-white/30 mt-1">{emptyReason}</div>
              </div>
            ) : (
              <div className="space-y-2">
                {session.openPositions.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-2xl border border-white/10 bg-[#121212] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{p.symbol}</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                              p.side === 'LONG'
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : 'bg-red-500/15 text-red-400'
                            }`}
                          >
                            {p.side}
                          </span>
                        </div>
                        <div className="text-[11px] text-white/40 font-mono mt-1">
                          Entry ${formatPrice(p.entry)} · Now ${formatPrice(p.current)}
                        </div>
                        <div className="text-[11px] text-white/35 mt-0.5">
                          SL ${formatPrice(p.stopLoss)} · TP ${formatPrice(p.takeProfit)} ·{' '}
                          {formatUsd(p.sizeUsd)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className={`font-mono font-bold ${
                            p.pnlUsd >= 0 ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {formatUsd(p.pnlUsd, true)}
                        </div>
                        <div
                          className={`text-xs font-mono ${
                            p.pnlPercent >= 0 ? 'text-emerald-400/70' : 'text-red-400/70'
                          }`}
                        >
                          {p.pnlPercent >= 0 ? '+' : ''}
                          {p.pnlPercent.toFixed(2)}%
                        </div>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            post(
                              `/api/protected/trade/close?id=${encodeURIComponent(p.id)}`
                            )
                          }
                          className="mt-2 text-[11px] px-2.5 py-1 rounded-lg border border-white/15 text-white/50 hover:text-red-400"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Simulation / live notice */}
          <section className="rounded-2xl border border-white/10 bg-[#121212] p-4 text-xs text-white/50 leading-relaxed">
            {session.mode === 'paper' ? (
              <>
                🎮 <strong className="text-white/70">Simulation mode:</strong> All trades are
                paper trades using simulated prices. No real funds are used or at risk. For
                beta testing only.
              </>
            ) : (
              <>
                ⚡ <strong className="text-white/70">Live mode:</strong> Orders may execute
                under your wallet and policy rules. Real capital is at risk.
              </>
            )}
          </section>
        </div>
      </main>

      <nav className="fixed bottom-0 inset-x-0 border-t border-white/10 bg-black/95 backdrop-blur z-50 md:hidden">
        <div className="flex overflow-x-auto justify-around px-1 py-2">
          {[
            { href: '/app', label: 'Dashboard', icon: '📊' },
            { href: '/app/trade', label: 'Trade', icon: '▶' },
            { href: '/app/config', label: 'Config', icon: '⚙️' },
            { href: '/app/signals', label: 'Signals', icon: '⚡' },
            { href: '/app/ai', label: 'AI', icon: '🤖' },
            { href: '/app/community', label: 'Community', icon: '🪿' },
          ].map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={`flex flex-col items-center gap-0.5 min-w-[52px] text-[10px] ${
                t.href === '/app/trade' ? 'text-emerald-400' : 'text-white/50'
              }`}
            >
              <span className="text-base">{t.icon}</span>
              <span>{t.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
