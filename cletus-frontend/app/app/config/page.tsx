'use client';

/**
 * Trading Configuration — main control panel
 * Starting capital, trading hours, aggression, SL/TP, daily PnL limits.
 * Paper simulation start/reset. Black background, logo on every page.
 * Route: /app/config
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';

type Aggression = 'conservative' | 'moderate' | 'aggressive' | 'max';

const AGGRESSION_PRESETS: Record<
  Aggression,
  { label: string; size: number; sl: number; tp: number; blurb: string }
> = {
  conservative: {
    label: 'Conservative',
    size: 1,
    sl: 5,
    tp: 10,
    blurb: '1% size · 5% SL · 10% TP · high threshold',
  },
  moderate: {
    label: 'Moderate',
    size: 3,
    sl: 8,
    tp: 20,
    blurb: '3% size · 8% SL · 20% TP · balanced',
  },
  aggressive: {
    label: 'Aggressive',
    size: 7,
    sl: 12,
    tp: 35,
    blurb: '7% size · 12% SL · 35% TP · wide stops',
  },
  max: {
    label: 'Max Risk',
    size: 15,
    sl: 20,
    tp: 60,
    blurb: '15% size · 20% SL · 60% TP · degen mode',
  },
};

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const CAPITAL_PRESETS = [500, 1000, 5000, 10000];

const TIME_OPTIONS = Array.from({ length: 24 * 2 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? '00' : '30';
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${ampm}`;
});

export default function TradingConfigPage() {
  const [capital, setCapital] = useState(1000);
  const [activeDays, setActiveDays] = useState<Set<string>>(
    () => new Set(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])
  );
  const [startTime, setStartTime] = useState('9:00 AM');
  const [endTime, setEndTime] = useState('9:00 PM');
  const [aggression, setAggression] = useState<Aggression>('conservative');
  const [positionSize, setPositionSize] = useState(10);
  const [stopLoss, setStopLoss] = useState(5);
  const [takeProfit, setTakeProfit] = useState(10);
  const [dailyProfitTarget, setDailyProfitTarget] = useState(500);
  const [dailyMaxLoss, setDailyMaxLoss] = useState(50);
  const [maxPositions, setMaxPositions] = useState(20);
  const [running, setRunning] = useState(false);
  const [saved, setSaved] = useState(false);
  const [livePnl, setLivePnl] = useState({
    realized: 0,
    unrealized: 0,
    openCount: 0,
    maxPositions: 9,
  });

  const refreshLive = useCallback(async () => {
    try {
      const res = await fetch('/api/protected/trade/session', {
        credentials: 'include',
      });
      if (!res.ok) return;
      const data = await res.json();
      const positions = Array.isArray(data.openPositions) ? data.openPositions : [];
      const unrealized = positions.reduce(
        (s: number, p: { pnlUsd?: number }) => s + (Number(p.pnlUsd) || 0),
        0
      );
      setLivePnl({
        realized: Number(data.dailyRealizedPnl) || 0,
        unrealized,
        openCount: positions.length,
        maxPositions: Number(data.maxPositions) || maxPositions,
      });
      if (data.running) setRunning(true);
    } catch {
      // ignore
    }
  }, [maxPositions]);

  useEffect(() => {
    refreshLive();
    const t = setInterval(refreshLive, 10_000);
    return () => clearInterval(t);
  }, [refreshLive]);

  const applyAggression = (key: Aggression) => {
    setAggression(key);
    const p = AGGRESSION_PRESETS[key];
    setPositionSize(p.size);
    setStopLoss(p.sl);
    setTakeProfit(p.tp);
  };

  const toggleDay = (day: string) => {
    setActiveDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  };

  const summary = useMemo(
    () => ({
      capital,
      aggression: AGGRESSION_PRESETS[aggression].label,
      positionSize,
      stopLoss,
      takeProfit,
      dailyProfitTarget,
      dailyMaxLoss,
      maxPositions,
    }),
    [
      capital,
      aggression,
      positionSize,
      stopLoss,
      takeProfit,
      dailyProfitTarget,
      dailyMaxLoss,
      maxPositions,
    ]
  );

  const saveConfig = async () => {
    try {
      await fetch('/api/protected/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          capital,
          activeDays: Array.from(activeDays),
          startTime,
          endTime,
          aggression,
          positionSizePercent: positionSize,
          stopLossPercent: stopLoss,
          takeProfitPercent: takeProfit,
          dailyProfitTarget,
          dailyMaxLoss,
          maxPositions,
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // keep local state
    }
  };

  const startSimulation = async () => {
    await saveConfig();
    setRunning(true);
    try {
      await fetch('/api/protected/simulate/start', {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // local flag only
    }
  };

  const resetSimulation = async () => {
    setRunning(false);
    try {
      await fetch('/api/protected/simulate/reset', {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col pb-20">
      {/* Logo on every page */}
      <header className="border-b border-white/10 px-4 sm:px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <Link href="/app" className="flex items-center gap-2.5 min-w-0">
            <Image
              src="/cletus-logo.png"
              alt="Cletus"
              width={36}
              height={36}
              className="object-contain shrink-0"
              priority
            />
            <div className="flex items-baseline gap-1 min-w-0">
              <span className="font-bold text-lg tracking-tight">Cletus</span>
              <span className="text-emerald-400 text-[10px] font-mono tracking-[2px]">
                PRO
              </span>
            </div>
          </Link>
          <Link
            href="/app/wallet"
            className="shrink-0 px-4 py-2 rounded-full text-xs font-semibold bg-emerald-500 text-black hover:bg-emerald-400 transition-colors"
          >
            Connect Wallet
          </Link>
        </div>
      </header>

      <main className="flex-1 px-4 sm:px-6 py-6">
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Hero card */}
          <section className="rounded-2xl border border-white/10 bg-[#161d24] p-5 space-y-4">
            <div>
              <h1 className="text-xl font-bold tracking-tight">Trading Configuration</h1>
              <p className="text-sm text-white/50 mt-1.5 leading-relaxed">
                Set your trading hours, aggression level, and PnL limits. Cletus will simulate
                trades automatically within these parameters.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
              <button
                type="button"
                onClick={startSimulation}
                className="px-5 py-3 rounded-2xl text-sm font-semibold bg-emerald-500 text-black hover:bg-emerald-400 transition-colors"
              >
                ▶ {running ? 'Running…' : 'Start Simulation'}
              </button>
              <button
                type="button"
                onClick={resetSimulation}
                className="px-5 py-3 rounded-2xl text-sm font-semibold border border-white/10 bg-black/20 text-white/70 hover:bg-white/5 transition-colors"
              >
                ↺ Reset
              </button>
              <button
                type="button"
                onClick={saveConfig}
                className="col-span-2 sm:col-span-1 px-5 py-3 rounded-2xl text-sm font-medium border border-white/15 text-white/70 hover:bg-white/5 transition-colors"
              >
                {saved ? 'Saved' : 'Save'}
              </button>
            </div>
            {running && (
              <p className="text-xs text-emerald-400 font-mono">
                Simulation active · paper trades only
              </p>
            )}
          </section>

          {/* Starting capital */}
          <section className="rounded-2xl border border-white/10 bg-[#161d24] p-5 space-y-3">
            <div className="flex items-center gap-2">
              <span>💰</span>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-white/50">
                Starting Capital
              </h2>
            </div>
            <p className="text-xs text-white/40">
              Paper balance used for all simulated trades. Resets when you click Reset.
            </p>
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
              <span className="text-white/40">$</span>
              <input
                type="number"
                min={1}
                value={capital}
                onChange={(e) => setCapital(Math.max(1, Number(e.target.value) || 0))}
                className="flex-1 bg-transparent text-white font-mono text-sm focus:outline-none"
              />
              <span className="text-xs text-white/40">USD</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {CAPITAL_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCapital(c)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-colors ${
                     capital === c
                      ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/15'
                      : 'border-white/10 text-white/50 hover:border-white/25'
                  }`}
                >
                  ${c.toLocaleString()}
                </button>
              ))}
            </div>
          </section>

          {/* Trading hours */}
          <section className="rounded-2xl border border-white/10 bg-[#161d24] p-5 space-y-4">
            <div className="flex items-center gap-2">
              <span>🕐</span>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-white/50">
                Trading Hours
              </h2>
            </div>
            <p className="text-xs text-white/40">
              Cletus only opens new trades within these hours. Existing positions continue
              running outside the window.
            </p>
            <div>
              <div className="text-xs text-white/45 mb-2">Active Days</div>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDay(d)}
                    className={`px-5 py-2 rounded-2xl text-base sm:text-sm font-semibold border transition-colors ${
                      activeDays.has(d)
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                        : 'bg-black/20 text-white/40 border-white/10'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/45 block mb-1.5">Start Time</label>
                <select
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black px-3 py-2.5 text-sm text-white focus:outline-none"
                >
                  {TIME_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-white/45 block mb-1.5">End Time</label>
                <select
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black px-3 py-2.5 text-sm text-white focus:outline-none"
                >
                  {TIME_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-[11px] text-white/30">Times are in your local timezone.</p>
          </section>

          {/* Aggression */}
          <section className="rounded-2xl border border-white/10 bg-[#121212] p-5 space-y-4">
            <div className="flex items-center gap-2">
              <span>⚡</span>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-white/50">
                Aggression Level
              </h2>
            </div>
            <p className="text-xs text-white/40">
              Sets default position size, stop loss width, and take profit. Fine-tune below
              overrides the preset.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(AGGRESSION_PRESETS) as Aggression[]).map((key) => {
                const p = AGGRESSION_PRESETS[key];
                const selected = aggression === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => applyAggression(key)}
                    className={`text-left rounded-xl border p-3 transition-colors ${
                      selected
                        ? 'border-sky-500/60 bg-sky-500/10'
                        : 'border-white/10 bg-black/40 hover:border-white/25'
                    }`}
                  >
                    <div
                      className={`text-sm font-semibold ${
                        selected ? 'text-sky-300' : 'text-white'
                      }`}
                    >
                      {p.label}
                    </div>
                    <div className="text-[11px] text-white/45 mt-1 leading-snug">
                      {p.blurb}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="space-y-4 pt-2 border-t border-white/10">
              <p className="text-xs text-white/40">Fine-tune (overrides preset)</p>
              {[
                {
                  label: 'Position Size %',
                  value: positionSize,
                  set: setPositionSize,
                  min: 1,
                  max: 25,
                },
                {
                  label: 'Stop Loss %',
                  value: stopLoss,
                  set: setStopLoss,
                  min: 1,
                  max: 50,
                },
                {
                  label: 'Take Profit %',
                  value: takeProfit,
                  set: setTakeProfit,
                  min: 1,
                  max: 100,
                },
              ].map((row) => (
                <div key={row.label}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-white/60">{row.label}</span>
                    <span className="font-mono text-emerald-400">{row.value}%</span>
                  </div>
                  <input
                    type="range"
                    min={row.min}
                    max={row.max}
                    value={row.value}
                    onChange={(e) => row.set(Number(e.target.value))}
                    className="w-full accent-emerald-500"
                  />
                </div>
              ))}
            </div>
          </section>

          {/* PnL margins */}
          <section className="rounded-2xl border border-white/10 bg-[#121212] p-5 space-y-4">
            <div className="flex items-center gap-2">
              <span>📊</span>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-white/50">
                PnL Margins
              </h2>
            </div>
            <p className="text-xs text-white/40">
              Cletus auto-pauses when these daily limits are hit. Set to 0 to disable.
            </p>
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-white/60">Daily Profit Target</span>
                <span className="font-mono text-emerald-400">
                  ${dailyProfitTarget.toLocaleString()}
                </span>
              </div>
              <input
                type="number"
                min={0}
                value={dailyProfitTarget}
                onChange={(e) =>
                  setDailyProfitTarget(Math.max(0, Number(e.target.value) || 0))
                }
                className="w-full rounded-xl border border-white/10 bg-black px-3 py-2.5 text-sm font-mono text-white focus:outline-none"
              />
              <p className="text-[11px] text-white/30 mt-1">
                Stop trading when daily profit reaches this amount.
              </p>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-white/60">Daily Max Loss</span>
                <span className="font-mono text-red-400">
                  -${dailyMaxLoss.toLocaleString()}
                </span>
              </div>
              <input
                type="number"
                min={0}
                value={dailyMaxLoss}
                onChange={(e) =>
                  setDailyMaxLoss(Math.max(0, Number(e.target.value) || 0))
                }
                className="w-full rounded-xl border border-white/10 bg-black px-3 py-2.5 text-sm font-mono text-white focus:outline-none"
              />
              <p className="text-[11px] text-white/30 mt-1">
                Stop trading when daily loss reaches this amount.
              </p>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-white/60">Max Concurrent Positions</span>
                <span className="font-mono text-white">{maxPositions}</span>
              </div>
              <input
                type="range"
                min={1}
                max={20}
                value={maxPositions}
                onChange={(e) => setMaxPositions(Number(e.target.value))}
                className="w-full accent-emerald-500"
              />
              <div className="flex justify-between text-[10px] text-white/25 font-mono">
                <span>1</span>
                <span>5</span>
                <span>10</span>
                <span>20</span>
              </div>
            </div>
          </section>

          {/* Live trade — active positions + PnL (same session as /app/trade) */}
          <section className="rounded-2xl border border-emerald-500/20 bg-[#121212] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-white/40">
                Live trade · active positions & PnL
              </h2>
              <Link href="/app/trade" className="text-[11px] text-emerald-400 hover:underline">
                Full view →
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-black/40 border border-white/10 p-3 text-center">
                <div className="text-[10px] text-white/40">Realized</div>
                <div
                  className={`text-sm font-mono font-bold mt-0.5 ${
                    livePnl.realized >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {livePnl.realized >= 0 ? '+' : ''}$
                  {Math.abs(livePnl.realized).toFixed(2)}
                </div>
              </div>
              <div className="rounded-xl bg-black/40 border border-white/10 p-3 text-center">
                <div className="text-[10px] text-white/40">Unrealized</div>
                <div
                  className={`text-sm font-mono font-bold mt-0.5 ${
                    livePnl.unrealized >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {livePnl.unrealized >= 0 ? '+' : ''}$
                  {Math.abs(livePnl.unrealized).toFixed(2)}
                </div>
              </div>
              <div className="rounded-xl bg-black/40 border border-white/10 p-3 text-center">
                <div className="text-[10px] text-white/40">Open</div>
                <div className="text-sm font-mono font-bold mt-0.5 text-sky-400">
                  {livePnl.openCount} / {livePnl.maxPositions || maxPositions}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-white/50">Profit Target</span>
                <span className="font-mono text-emerald-400">
                  {livePnl.realized >= 0 ? '+' : ''}${livePnl.realized.toFixed(2)} / $
                  {dailyProfitTarget}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{
                    width: `${
                      dailyProfitTarget > 0
                        ? Math.min(100, Math.max(0, (livePnl.realized / dailyProfitTarget) * 100))
                        : 0
                    }%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-white/50">Max Loss Guard</span>
                <span className="font-mono text-red-400">
                  {Math.min(0, livePnl.realized) >= 0 ? '+$0.00' : `-$${Math.abs(Math.min(0, livePnl.realized)).toFixed(2)}`}{' '}
                  / -${dailyMaxLoss}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-red-500 rounded-full"
                  style={{
                    width: `${
                      dailyMaxLoss > 0
                        ? Math.min(
                            100,
                            Math.max(
                              0,
                              (Math.abs(Math.min(0, livePnl.realized)) / dailyMaxLoss) * 100
                            )
                          )
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
            {livePnl.openCount === 0 && (
              <p className="text-xs text-white/35 text-center py-2">
                No open positions — Cletus is not in any trades right now
              </p>
            )}
          </section>

          {/* Summary */}
          <section className="rounded-2xl border border-white/10 bg-[#121212] p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-4">
              Current Configuration Summary
            </h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-xs text-white/40">Capital</div>
                <div className="font-mono font-semibold mt-0.5">
                  ${summary.capital.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-xs text-white/40">Aggression</div>
                <div className="font-semibold mt-0.5">{summary.aggression}</div>
              </div>
              <div>
                <div className="text-xs text-white/40">Position Size</div>
                <div className="font-mono font-semibold mt-0.5">
                  {summary.positionSize}%
                </div>
              </div>
              <div>
                <div className="text-xs text-white/40">Stop Loss</div>
                <div className="font-mono font-semibold mt-0.5">{summary.stopLoss}%</div>
              </div>
              <div>
                <div className="text-xs text-white/40">Take Profit</div>
                <div className="font-mono font-semibold mt-0.5">
                  {summary.takeProfit}%
                </div>
              </div>
              <div>
                <div className="text-xs text-white/40">Max Positions</div>
                <div className="font-mono font-semibold mt-0.5">
                  {summary.maxPositions}
                </div>
              </div>
            </div>
          </section>

          <p className="text-[11px] text-white/25 text-center">
            Paper simulation only until live execution is enabled. Not financial advice.
            Trading involves risk of loss.
          </p>
        </div>
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 border-t border-white/10 bg-black/95 backdrop-blur z-50 md:hidden">
        <div className="flex overflow-x-auto justify-around px-1 py-2">
          {[
            { href: '/app', label: 'Dashboard', icon: '📊' },
            { href: '/app/chart', label: 'Chart', icon: '📈' },
            { href: '/app/signals', label: 'Signals', icon: '⚡' },
            { href: '/app/ai', label: 'Cletus AI', icon: '🤖' },
            { href: '/app/config', label: 'Config', icon: '⚙️' },
            { href: '/app/community', label: 'Community', icon: '🪿' },
          ].map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={`flex flex-col items-center gap-0.5 min-w-[52px] text-[10px] ${
                t.href === '/app/config' ? 'text-emerald-400' : 'text-white/50'
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
