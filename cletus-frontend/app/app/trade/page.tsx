'use client';

/**
 * Active Trading / live trade section
 * Daily PnL limits, open positions Cletus is in, unrealized + realized PnL.
 * Trading settings now live directly on this page.
 * Route: /app/trade
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
const DEFAULT_CAPITAL = 1000;
const DEFAULT_START_TIME = '9:00 AM';
const DEFAULT_END_TIME = '9:00 PM';
const DEFAULT_AGGRESSION: Aggression = 'conservative';
const DEFAULT_POSITION_SIZE = 10;
const DEFAULT_STOP_LOSS = 5;
const DEFAULT_TAKE_PROFIT = 10;
const DEFAULT_DAILY_PROFIT_TARGET = 500;
const DEFAULT_DAILY_MAX_LOSS = 50;
const DEFAULT_MAX_POSITIONS = 20;
const SAVE_FEEDBACK_MS = 2000;
const CAPITAL_PRESETS = [500, 1000, 5000, 10000];
const TIME_OPTIONS = Array.from({ length: 24 * 2 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? '00' : '30';
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${ampm}`;
});

const EMPTY: TradeSession = {
  running: false,
  paused: false,
  mode: 'paper',
  capital: 0,
  available: 0,
  dailyRealizedPnl: 0,
  dailyProfitTarget: DEFAULT_DAILY_PROFIT_TARGET,
  dailyMaxLoss: DEFAULT_DAILY_MAX_LOSS,
  openPositions: [],
  aggression: '—',
  positionSizePercent: 0,
  stopLossPercent: 0,
  takeProfitPercent: 0,
  maxPositions: DEFAULT_MAX_POSITIONS,
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

function readNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default function ActiveTradingPage() {
  const [session, setSession] = useState<TradeSession>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const hydratedConfig = useRef(false);
  const savedResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [capital, setCapital] = useState(DEFAULT_CAPITAL);
  const [capitalInput, setCapitalInput] = useState(String(DEFAULT_CAPITAL));
  const [activeDays, setActiveDays] = useState<Set<string>>(
    () => new Set(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])
  );
  const [startTime, setStartTime] = useState(DEFAULT_START_TIME);
  const [endTime, setEndTime] = useState(DEFAULT_END_TIME);
  const [aggression, setAggression] = useState<Aggression>(DEFAULT_AGGRESSION);
  const [positionSize, setPositionSize] = useState(DEFAULT_POSITION_SIZE);
  const [stopLoss, setStopLoss] = useState(DEFAULT_STOP_LOSS);
  const [takeProfit, setTakeProfit] = useState(DEFAULT_TAKE_PROFIT);
  const [dailyProfitTarget, setDailyProfitTarget] = useState(DEFAULT_DAILY_PROFIT_TARGET);
  const [dailyProfitTargetInput, setDailyProfitTargetInput] = useState(
    String(DEFAULT_DAILY_PROFIT_TARGET)
  );
  const [dailyMaxLoss, setDailyMaxLoss] = useState(DEFAULT_DAILY_MAX_LOSS);
  const [dailyMaxLossInput, setDailyMaxLossInput] = useState(String(DEFAULT_DAILY_MAX_LOSS));
  const [maxPositions, setMaxPositions] = useState(DEFAULT_MAX_POSITIONS);

  const syncCapital = useCallback((value: number) => {
    setCapital(value);
    setCapitalInput(String(value));
  }, []);

  const syncDailyProfitTarget = useCallback((value: number) => {
    setDailyProfitTarget(value);
    setDailyProfitTargetInput(String(value));
  }, []);

  const syncDailyMaxLoss = useCallback((value: number) => {
    setDailyMaxLoss(value);
    setDailyMaxLossInput(String(value));
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/protected/trade/session', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        const nextCapital = Math.max(1, readNumber(data.capital, DEFAULT_CAPITAL));
        const nextDailyRealizedPnl = readNumber(data.dailyRealizedPnl, 0);
        const nextDailyProfitTarget = Math.max(0, readNumber(data.dailyProfitTarget, DEFAULT_DAILY_PROFIT_TARGET));
        const nextDailyMaxLoss = Math.max(0, readNumber(data.dailyMaxLoss, DEFAULT_DAILY_MAX_LOSS));
        const nextPositionSize = Math.max(1, readNumber(data.positionSizePercent, DEFAULT_POSITION_SIZE));
        const nextStopLoss = Math.max(1, readNumber(data.stopLossPercent, DEFAULT_STOP_LOSS));
        const nextTakeProfit = Math.max(1, readNumber(data.takeProfitPercent, DEFAULT_TAKE_PROFIT));
        const nextMaxPositions = Math.max(1, readNumber(data.maxPositions, DEFAULT_MAX_POSITIONS));

        setSession({
          running: !!data.running,
          paused: !!data.paused,
          pauseReason: data.pauseReason,
          mode: data.mode === 'live' ? 'live' : 'paper',
          capital: nextCapital,
          available: readNumber(data.available, 0),
          dailyRealizedPnl: nextDailyRealizedPnl,
          dailyProfitTarget: nextDailyProfitTarget,
          dailyMaxLoss: nextDailyMaxLoss,
          openPositions: Array.isArray(data.openPositions) ? data.openPositions : [],
          aggression: data.aggression ?? '—',
          positionSizePercent: nextPositionSize,
          stopLossPercent: nextStopLoss,
          takeProfitPercent: nextTakeProfit,
          maxPositions: nextMaxPositions,
          withinHours: data.withinHours !== false,
        });

        if (!hydratedConfig.current) {
          syncCapital(nextCapital);
          syncDailyProfitTarget(nextDailyProfitTarget);
          syncDailyMaxLoss(nextDailyMaxLoss);
          setMaxPositions(nextMaxPositions);
          setPositionSize(nextPositionSize);
          setStopLoss(nextStopLoss);
          setTakeProfit(nextTakeProfit);

          if (Array.isArray(data.activeDays)) {
            const nextActiveDays = data.activeDays.filter((day: unknown): day is string =>
              DAYS.includes(day as (typeof DAYS)[number])
            );
            setActiveDays(
              new Set(nextActiveDays.length > 0 ? nextActiveDays : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])
            );
          } else {
            setActiveDays(new Set(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']));
          }
          if (typeof data.startTime === 'string' && TIME_OPTIONS.includes(data.startTime)) {
            setStartTime(data.startTime);
          } else {
            setStartTime(DEFAULT_START_TIME);
          }
          if (typeof data.endTime === 'string' && TIME_OPTIONS.includes(data.endTime)) {
            setEndTime(data.endTime);
          } else {
            setEndTime(DEFAULT_END_TIME);
          }

          const nextAggression =
            typeof data.aggression === 'string' ? data.aggression.toLowerCase() : '';
          if (nextAggression in AGGRESSION_PRESETS) {
            setAggression(nextAggression as Aggression);
          } else {
            setAggression(DEFAULT_AGGRESSION);
          }
          hydratedConfig.current = true;
        }
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

  const toggleDay = (day: string) => {
    setActiveDays((prev) => {
      if (prev.size === 1 && prev.has(day)) return prev;
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  };

  const applyAggression = (key: Aggression) => {
    setAggression(key);
    const preset = AGGRESSION_PRESETS[key];
    setPositionSize(preset.size);
    setStopLoss(preset.sl);
    setTakeProfit(preset.tp);
  };

  const persistConfigCore = useCallback(async () => {
    const res = await fetch('/api/protected/config', {
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
    if (!res.ok) return false;
    hydratedConfig.current = false;
    setSaved(true);
    if (savedResetTimer.current) clearTimeout(savedResetTimer.current);
    savedResetTimer.current = setTimeout(() => setSaved(false), SAVE_FEEDBACK_MS);
    await load();
    return true;
  }, [
    activeDays,
    aggression,
    capital,
    dailyMaxLoss,
    dailyProfitTarget,
    endTime,
    maxPositions,
    positionSize,
    startTime,
    stopLoss,
    takeProfit,
    load,
  ]);

  const persistConfig = useCallback(async () => {
    setBusy(true);
    try {
      return await persistConfigCore();
    } catch {
      return false;
    } finally {
      setBusy(false);
    }
  }, [persistConfigCore]);

  const post = async (path: string) => {
    setBusy(true);
    try {
      const res = await fetch(path, { method: 'POST', credentials: 'include' });
      if (!res.ok) return;
      await load();
    } finally {
      setBusy(false);
    }
  };

  const startTrading = async () => {
    setBusy(true);
    try {
      const savedConfig = await persistConfigCore();
      if (!savedConfig) return;
      const startPath = session.mode === 'paper' ? '/api/protected/simulate/start' : '/api/protected/trade/start';
      const res = await fetch(startPath, { method: 'POST', credentials: 'include' });
      if (!res.ok) return;
      await load();
    } finally {
      setBusy(false);
    }
  };

  const resetSimulation = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/protected/simulate/reset', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) return;
      hydratedConfig.current = false;
      await load();
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => () => {
    if (savedResetTimer.current) clearTimeout(savedResetTimer.current);
  }, []);

  const unrealizedPnl = useMemo(
    () => session.openPositions.reduce((sum, p) => sum + (p.pnlUsd || 0), 0),
    [session.openPositions]
  );
  const totalSessionPnl = session.dailyRealizedPnl + unrealizedPnl;

  const profitPct =
    session.dailyProfitTarget > 0
      ? Math.min(100, Math.max(0, (session.dailyRealizedPnl / session.dailyProfitTarget) * 100))
      : 0;
  const lossPct =
    session.dailyMaxLoss > 0
      ? Math.min(
          100,
          Math.max(0, (Math.abs(Math.min(0, session.dailyRealizedPnl)) / session.dailyMaxLoss) * 100)
        )
      : 0;

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
    [aggression, capital, dailyMaxLoss, dailyProfitTarget, maxPositions, positionSize, stopLoss, takeProfit]
  );

  const emptyReason = !session.running
    ? 'Engine stopped — start from here'
    : session.paused
      ? `Paused${session.pauseReason ? `: ${session.pauseReason}` : ''}`
      : !session.withinHours
        ? 'Outside trading hours'
        : 'Waiting for qualifying signals…';

  return (
    <div className="min-h-screen bg-black text-white flex flex-col pb-20">
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
            <div className="min-w-0">
              <div className="font-bold text-lg tracking-tight leading-none">Cletus</div>
              <div className="text-xs text-white/50 mt-0.5">Trade + configuration</div>
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
                  {session.running ? (session.paused ? 'Paused' : 'Live') : 'Stopped'}
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
                    onClick={startTrading}
                    className="px-4 py-2 rounded-full text-sm font-semibold bg-emerald-500 text-black disabled:opacity-60"
                  >
                    ▶ Start
                  </button>
                ) : session.paused ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => post('/api/protected/trade/resume')}
                    className="px-4 py-2 rounded-full text-sm font-semibold bg-emerald-500 text-black disabled:opacity-60"
                  >
                    ▶ Resume
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => post('/api/protected/trade/pause')}
                    className="px-4 py-2 rounded-full text-sm font-semibold border border-yellow-500/40 text-yellow-400 disabled:opacity-60"
                  >
                    ⏸ Pause
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => post('/api/protected/trade/stop')}
                  className="px-4 py-2 rounded-full text-sm border border-white/15 text-white/60 disabled:opacity-60"
                >
                  Stop
                </button>
              </div>
            </div>

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

          <section className="rounded-2xl border border-white/10 bg-[#161d24] p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold tracking-tight">Trading Configuration</h1>
                <p className="text-sm text-white/50 mt-1.5 leading-relaxed max-w-xl">
                  Set your trading hours, aggression level, and PnL limits directly on the trade
                  page.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
                <button
                  type="button"
                  disabled={busy || session.mode !== 'paper'}
                  onClick={resetSimulation}
                  className="px-5 py-3 rounded-2xl text-sm font-semibold border border-white/10 bg-black/20 text-white/70 hover:bg-white/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ↺ Reset Paper Session
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={persistConfig}
                  className="col-span-2 sm:col-span-1 px-5 py-3 rounded-2xl text-sm font-medium border border-white/15 text-white/70 hover:bg-white/5 transition-colors disabled:opacity-60"
                >
                  {saved ? 'Saved' : 'Save'}
                </button>
              </div>
            </div>
            {session.running && !session.paused && session.mode === 'paper' && (
              <p className="text-xs text-emerald-400 font-mono">
                Simulation active · paper trades only
              </p>
            )}
          </section>

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
                id="starting-capital"
                aria-label="Starting capital"
                type="number"
                min={1}
                value={capitalInput}
                onChange={(e) => {
                  const value = e.target.value;
                  setCapitalInput(value);
                  if (value === '') return;
                  const parsed = Number(value);
                  if (Number.isFinite(parsed)) setCapital(Math.max(1, parsed));
                }}
                onBlur={() => setCapitalInput(String(capital))}
                className="flex-1 bg-transparent text-white font-mono text-sm focus:outline-none"
              />
              <span className="text-xs text-white/40">USD</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {CAPITAL_PRESETS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => { syncCapital(value); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-colors ${
                    capital === value
                      ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/15'
                      : 'border-white/10 text-white/50 hover:border-white/25'
                  }`}
                >
                  ${value.toLocaleString()}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-[#161d24] p-5 space-y-4">
            <div className="flex items-center gap-2">
              <span>🕐</span>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-white/50">
                Trading Hours
              </h2>
            </div>
            <p className="text-xs text-white/40">
              Cletus only opens new trades within these hours. Existing positions continue running
              outside the window.
            </p>
            <div>
              <div className="text-xs text-white/45 mb-2">Active Days</div>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`px-5 py-2 rounded-2xl text-base sm:text-sm font-semibold border transition-colors ${
                      activeDays.has(day)
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                        : 'bg-black/20 text-white/40 border-white/10'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="trade-start-time" className="text-xs text-white/45 block mb-1.5">
                  Start Time
                </label>
                <select
                  id="trade-start-time"
                  value={startTime}
                  onChange={(e) => { setStartTime(e.target.value); }}
                  className="w-full rounded-xl border border-white/10 bg-black px-3 py-2.5 text-sm text-white focus:outline-none"
                >
                  {TIME_OPTIONS.map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="trade-end-time" className="text-xs text-white/45 block mb-1.5">
                  End Time
                </label>
                <select
                  id="trade-end-time"
                  value={endTime}
                  onChange={(e) => { setEndTime(e.target.value); }}
                  className="w-full rounded-xl border border-white/10 bg-black px-3 py-2.5 text-sm text-white focus:outline-none"
                >
                  {TIME_OPTIONS.map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-[11px] text-white/30">Use your current device/browser timezone when choosing these labels. The exact AM/PM labels shown here are what get saved.</p>
          </section>

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
                const preset = AGGRESSION_PRESETS[key];
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
                    <div className={`text-sm font-semibold ${selected ? 'text-sky-300' : 'text-white'}`}>
                      {preset.label}
                    </div>
                    <div className="text-[11px] text-white/45 mt-1 leading-snug">
                      {preset.blurb}
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
                    onChange={(e) => { row.set(Number(e.target.value)); }}
                    className="w-full accent-emerald-500"
                  />
                </div>
              ))}
            </div>
          </section>

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
                <label htmlFor="daily-profit-target" className="text-white/60">
                  Daily Profit Target
                </label>
                <span className="font-mono text-emerald-400">
                  {dailyProfitTarget > 0 ? `$${dailyProfitTarget.toLocaleString()}` : 'Disabled'}
                </span>
              </div>
              <input
                id="daily-profit-target"
                aria-label="Daily profit target"
                aria-describedby="daily-profit-target-help"
                type="number"
                min={0}
                value={dailyProfitTargetInput}
                onChange={(e) => {
                  const value = e.target.value;
                  setDailyProfitTargetInput(value);
                  if (value === '') return;
                  const parsed = Number(value);
                  if (Number.isFinite(parsed)) setDailyProfitTarget(Math.max(0, parsed));
                }}
                onBlur={() => setDailyProfitTargetInput(String(dailyProfitTarget))}
                className="w-full rounded-xl border border-white/10 bg-black px-3 py-2.5 text-sm font-mono text-white focus:outline-none"
              />
              <p id="daily-profit-target-help" className="text-[11px] text-white/30 mt-1">
                Stop trading when daily profit reaches this amount. Enter 0 to disable.
              </p>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <label htmlFor="daily-max-loss" className="text-white/60">
                  Daily Max Loss
                </label>
                <span className="font-mono text-red-400">
                  {dailyMaxLoss > 0 ? `-$${dailyMaxLoss.toLocaleString()}` : 'Disabled'}
                </span>
              </div>
              <input
                id="daily-max-loss"
                aria-label="Daily max loss"
                aria-describedby="daily-max-loss-help"
                type="number"
                min={0}
                value={dailyMaxLossInput}
                onChange={(e) => {
                  const value = e.target.value;
                  setDailyMaxLossInput(value);
                  if (value === '') return;
                  const parsed = Number(value);
                  if (Number.isFinite(parsed)) setDailyMaxLoss(Math.max(0, parsed));
                }}
                onBlur={() => setDailyMaxLossInput(String(dailyMaxLoss))}
                className="w-full rounded-xl border border-white/10 bg-black px-3 py-2.5 text-sm font-mono text-white focus:outline-none"
              />
              <p id="daily-max-loss-help" className="text-[11px] text-white/30 mt-1">
                Stop trading when daily loss reaches this amount. Enter 0 to disable.
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
                onChange={(e) => { setMaxPositions(Number(e.target.value)); }}
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

          <section className="rounded-2xl border border-white/10 bg-[#121212] p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-4">
              Current Configuration Summary
            </h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-xs text-white/40">Capital</div>
                <div className="font-mono font-semibold mt-0.5">${summary.capital.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-xs text-white/40">Aggression</div>
                <div className="font-semibold mt-0.5">{summary.aggression}</div>
              </div>
              <div>
                <div className="text-xs text-white/40">Position Size</div>
                <div className="font-mono font-semibold mt-0.5">{summary.positionSize}%</div>
              </div>
              <div>
                <div className="text-xs text-white/40">Stop Loss</div>
                <div className="font-mono font-semibold mt-0.5">{summary.stopLoss}%</div>
              </div>
              <div>
                <div className="text-xs text-white/40">Take Profit</div>
                <div className="font-mono font-semibold mt-0.5">{summary.takeProfit}%</div>
              </div>
              <div>
                <div className="text-xs text-white/40">Max Positions</div>
                <div className="font-mono font-semibold mt-0.5">{summary.maxPositions}</div>
              </div>
            </div>
          </section>

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
                  <div key={p.id} className="rounded-2xl border border-white/10 bg-[#121212] p-4">
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
                            post(`/api/protected/trade/close?id=${encodeURIComponent(p.id)}`)
                          }
                          className="mt-2 text-[11px] px-2.5 py-1 rounded-lg border border-white/15 text-white/50 hover:text-red-400 disabled:opacity-60"
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

          <section className="rounded-2xl border border-white/10 bg-[#121212] p-4 text-xs text-white/50 leading-relaxed">
            {session.mode === 'paper' ? (
              <>
                🎮 <strong className="text-white/70">Simulation mode:</strong> All trades are
                paper trades using simulated prices. No real funds are used or at risk. For beta
                testing only.
              </>
            ) : (
              <>
                ⚡ <strong className="text-white/70">Live mode:</strong> Orders may execute under
                your wallet and policy rules. Real capital is at risk.
              </>
            )}
          </section>

          <p className="text-[11px] text-white/25 text-center">
            Paper simulation only until live execution is enabled. Not financial advice. Trading
            involves risk of loss.
          </p>
        </div>
      </main>

      <nav className="fixed bottom-0 inset-x-0 border-t border-white/10 bg-black/95 backdrop-blur z-50 md:hidden">
        <div className="flex overflow-x-auto justify-around px-1 py-2">
          {[
            { href: '/app', label: 'Dashboard', icon: '📊' },
            { href: '/app/trade', label: 'Trade', icon: '▶' },
            { href: '/app/chart', label: 'Chart', icon: '📈' },
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
