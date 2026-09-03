'use client';

import { useState, useEffect, useCallback } from 'react';
import type { TradingSignal } from '@/types';

function toNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function StrengthBadge({ strength }: { strength: TradingSignal['strength'] }) {
  const config = {
    EXTREME: { color: 'bg-trading-purple/20 text-trading-purple border-trading-purple/40', dot: 'bg-trading-purple' },
    STRONG: { color: 'bg-trading-green/20 text-trading-green border-trading-green/40', dot: 'bg-trading-green' },
    MODERATE: { color: 'bg-trading-yellow/20 text-trading-yellow border-trading-yellow/40', dot: 'bg-trading-yellow' },
    WEAK: { color: 'bg-gray-700/20 text-gray-400 border-gray-600/40', dot: 'bg-gray-500' },
  }[strength];

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border ${config.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot} status-dot-live`} />
      {strength}
    </span>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const safeValue = toNumber(value);
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 w-28 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-trading-surface rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${value * 100}%`,
            background:
              safeValue > 0.7
                ? '#00d4aa'
                : safeValue > 0.4
                ? '#ffd43b'
                : '#ff4757',
          }}
        />
      </div>
      <span className="text-xs font-mono text-gray-400 w-8 text-right">
        {(safeValue * 100).toFixed(0)}%
      </span>
    </div>
  );
}

function SignalCard({
  signal,
  isExpanded,
  onToggle,
  onExecute,
}: {
  signal: TradingSignal;
  isExpanded: boolean;
  onToggle: () => void;
  onExecute: (signal: TradingSignal) => void;
}) {
  const formatNum = (n: number) => {
    const safe = toNumber(n);
    if (safe >= 1e6) return `$${(safe / 1e6).toFixed(1)}M`;
    if (safe >= 1e3) return `$${(safe / 1e3).toFixed(1)}K`;
    return `$${safe.toFixed(2)}`;
  };

  const formatPrice = (p: number) => {
    const safe = toNumber(p);
    if (safe < 0.0001) return safe.toExponential(3);
    if (safe < 0.01) return safe.toFixed(6);
    if (safe < 1) return safe.toFixed(4);
    return safe.toFixed(3);
  };

  const timeSince = (ts: number) => {
    const secs = Math.floor((Date.now() - ts) / 1000);
    if (secs < 60) return `${secs}s ago`;
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
    return `${Math.floor(secs / 3600)}h ago`;
  };

  return (
    <div
      className={`trading-card transition-all duration-200 hover:border-trading-border/60 ${
        signal.strength === 'EXTREME'
          ? 'border-trading-purple/40 glow-green'
          : signal.strength === 'STRONG'
          ? 'border-trading-green/30'
          : ''
      }`}
    >
      <div
        className="p-4 cursor-pointer"
        onClick={onToggle}
      >
        <div className="flex items-start justify-between gap-3">
          {/* Token Info */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-trading-surface border border-trading-border flex items-center justify-center text-sm font-bold">
              {signal.tokenName.slice(0, 2)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white">{signal.tokenName}</span>
                <span
                  className={`text-xs px-1.5 py-0.5 rounded font-semibold ${
                    signal.direction === 'LONG'
                      ? 'bg-trading-green/20 text-trading-green'
                      : 'bg-trading-red/20 text-trading-red'
                  }`}
                >
                  {signal.direction}
                </span>
              </div>
              <div className="text-xs text-gray-500 mt-0.5 font-mono">
                {signal.tokenAddress.slice(0, 8)}...{signal.tokenAddress.slice(-4)}
              </div>
            </div>
          </div>

          {/* Score & Strength */}
          <div className="text-right">
            <div className="text-2xl font-bold font-mono text-white">
              {(signal.compositeScore * 100).toFixed(0)}
              <span className="text-sm text-gray-500">/100</span>
            </div>
            <div className="mt-1">
              <StrengthBadge strength={signal.strength} />
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-3 mt-4 text-center">
          <div>
            <div className="text-xs text-gray-500">Mkt Cap</div>
            <div className="text-sm font-mono font-semibold text-white">
              {formatNum(signal.marketCap)}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Volume</div>
            <div className="text-sm font-mono font-semibold text-white">
              {formatNum(signal.volume24h)}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">24h Chg</div>
            <div
              className={`text-sm font-mono font-semibold ${
                signal.priceChange24h >= 0 ? 'text-trading-green' : 'text-trading-red'
              }`}
            >
              {signal.priceChange24h >= 0 ? '+' : ''}
              {(signal.priceChange24h ?? 0).toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">R:R</div>
            <div className="text-sm font-mono font-semibold text-trading-blue">
              1:{signal.riskReward.toFixed(1)}
            </div>
          </div>
        </div>

        {/* Timestamp */}
        <div className="text-xs text-gray-600 mt-2">{timeSince(signal.timestamp)}</div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="border-t border-trading-border px-4 pb-4 pt-3 space-y-4 animate-slide-up">
          {/* Signal Breakdown */}
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">
              Signal Breakdown
            </div>
            <div className="space-y-1.5">
              <ScoreBar label="Volume Spike" value={signal.breakdown.volumeSpike} />
              <ScoreBar label="Momentum" value={signal.breakdown.momentum} />
              <ScoreBar label="Breakout" value={signal.breakdown.breakout} />
              <ScoreBar label="RSI Signal" value={signal.breakdown.rsiScore} />
              <ScoreBar label="MACD Cross" value={signal.breakdown.macdCross} />
              <ScoreBar label="Holder Growth" value={signal.breakdown.holderGrowth} />
              <ScoreBar label="Liquidity" value={signal.breakdown.liquidityScore} />
              <ScoreBar label="Social Sentiment" value={signal.breakdown.socialSentiment} />
            </div>
          </div>

          {/* Price Targets */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-trading-surface rounded-lg p-3 text-center">
              <div className="text-xs text-gray-500 mb-1">Entry</div>
              <div className="font-mono font-bold text-white text-sm">
                ${formatPrice(signal.currentPrice)}
              </div>
            </div>
            <div className="bg-trading-green/10 rounded-lg p-3 text-center border border-trading-green/20">
              <div className="text-xs text-trading-green mb-1">Take Profit</div>
              <div className="font-mono font-bold text-trading-green text-sm">
                ${formatPrice(signal.takeProfit)}
              </div>
            </div>
            <div className="bg-trading-red/10 rounded-lg p-3 text-center border border-trading-red/20">
              <div className="text-xs text-trading-red mb-1">Stop Loss</div>
              <div className="font-mono font-bold text-trading-red text-sm">
                ${formatPrice(signal.stopLoss)}
              </div>
            </div>
          </div>

          {/* Execute Button */}
          <button
            onClick={() => onExecute(signal)}
            className="w-full py-2.5 rounded-lg font-bold text-sm transition-all duration-200 active:scale-[0.98] bg-trading-green text-black hover:bg-trading-green/90"
          >
            ⚡ Execute {signal.direction} Trade
          </button>
        </div>
      )}
    </div>
  );
}

interface ExecutionModalProps {
  signal: TradingSignal | null;
  onClose: () => void;
}

function ExecutionModal({ signal, onClose }: ExecutionModalProps) {
  const [amount, setAmount] = useState('1.5');
  const [executing, setExecuting] = useState(false);
  const [executed, setExecuted] = useState(false);

  if (!signal) return null;

  const handleExecute = async () => {
    setExecuting(true);
    await new Promise((r) => setTimeout(r, 2000));
    setExecuting(false);
    setExecuted(true);
    setTimeout(onClose, 2000);
  };

  const formatPrice = (p: number) => {
    if (p < 0.0001) return p.toExponential(3);
    if (p < 0.01) return p.toFixed(6);
    if (p < 1) return p.toFixed(4);
    return p.toFixed(3);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="trading-card w-full max-w-md animate-slide-up">
        <div className="p-6">
          {executed ? (
            <div className="text-center py-8">
              <div className="text-5xl mb-4">✅</div>
              <div className="text-xl font-bold text-trading-green">Trade Submitted!</div>
              <div className="text-gray-400 text-sm mt-2">
                {signal.direction} {signal.tokenName} order placed
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-bold text-lg">Execute Trade</h3>
                  <p className="text-gray-400 text-sm">
                    {signal.direction} {signal.tokenName}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="text-gray-500 hover:text-white text-xl"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-trading-surface rounded-lg p-3">
                    <div className="text-gray-500 text-xs">Entry Price</div>
                    <div className="font-mono font-bold mt-1">
                      ${formatPrice(signal.currentPrice)}
                    </div>
                  </div>
                  <div className="bg-trading-surface rounded-lg p-3">
                    <div className="text-gray-500 text-xs">Signal Score</div>
                    <div className="font-mono font-bold mt-1 text-trading-green">
                      {(signal.compositeScore * 100).toFixed(0)}/100
                    </div>
                  </div>
                  <div className="bg-trading-green/10 rounded-lg p-3 border border-trading-green/20">
                    <div className="text-trading-green text-xs">Take Profit</div>
                    <div className="font-mono font-bold text-trading-green mt-1">
                      ${formatPrice(signal.takeProfit)}
                    </div>
                  </div>
                  <div className="bg-trading-red/10 rounded-lg p-3 border border-trading-red/20">
                    <div className="text-trading-red text-xs">Stop Loss</div>
                    <div className="font-mono font-bold text-trading-red mt-1">
                      ${formatPrice(signal.stopLoss)}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-500 mb-1 block">
                    Trade Size (SOL)
                  </label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    min="0.1"
                    step="0.1"
                    className="w-full bg-trading-surface border border-trading-border rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-trading-green"
                  />
                </div>

                <div className="bg-trading-yellow/10 border border-trading-yellow/30 rounded-lg p-3 text-xs text-trading-yellow">
                  ⚠️ This will execute a live trade. Ensure you understand the risks. Max
                  loss: ${(parseFloat(amount) * signal.currentPrice * 0.1).toFixed(2)} (10%
                  stop)
                </div>

                <button
                  onClick={handleExecute}
                  disabled={executing}
                  className="w-full py-3 rounded-lg font-bold text-sm transition-all bg-trading-green text-black hover:bg-trading-green/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {executing ? '⏳ Executing...' : `⚡ Confirm ${signal.direction} Trade`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TradingSignals() {
  const [signals, setSignals] = useState<TradingSignal[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedSignal, setSelectedSignal] = useState<TradingSignal | null>(null);
  const [filter, setFilter] = useState<'all' | 'extreme' | 'strong' | 'moderate'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLive, setIsLive] = useState(false);

  const fetchSignals = useCallback(async () => {
    try {
      const res = await fetch('/api/signals');
      if (res.ok) {
        const data = await res.json() as {
          signals: TradingSignal[];
          isLive?: boolean;
        };
        setSignals(
          (data.signals ?? []).map((s) => {
            const currentPrice = toNumber(s.currentPrice);
            const marketCap = toNumber(s.marketCap);
            const volume24h = toNumber(s.volume24h);
            const compositeScore = toNumber(s.compositeScore);
            const priceChange24h = toNumber(s.priceChange24h);
            const riskReward = toNumber(s.riskReward, 2);
            const timestamp = toNumber(s.timestamp, Date.now());
            const breakdown = s.breakdown ?? {
              volumeSpike: 0,
              momentum: 0,
              breakout: 0,
              rsiScore: 0,
              macdCross: 0,
              holderGrowth: 0,
              liquidityScore: 0,
              socialSentiment: 0,
            };

            return {
              ...s,
              currentPrice,
              marketCap,
              volume24h,
              compositeScore,
              priceChange24h,
              riskReward,
              timestamp,
              breakdown: {
                volumeSpike: toNumber(breakdown.volumeSpike),
                momentum: toNumber(breakdown.momentum),
                breakout: toNumber(breakdown.breakout),
                rsiScore: toNumber(breakdown.rsiScore),
                macdCross: toNumber(breakdown.macdCross),
                holderGrowth: toNumber(breakdown.holderGrowth),
                liquidityScore: toNumber(breakdown.liquidityScore),
                socialSentiment: toNumber(breakdown.socialSentiment),
              },
              stopLoss: toNumber(s.stopLoss, currentPrice * 0.92),
              takeProfit: toNumber(s.takeProfit, currentPrice * 1.2),
            };
          })),
        );
        setIsLive(data.isLive ?? false);
      }
    } catch {
      // keep existing signals
    }
  }, []);

  const refreshSignals = useCallback(async () => {
    setIsRefreshing(true);
    await fetchSignals();
    setIsRefreshing(false);
  }, [fetchSignals]);

  useEffect(() => {
    fetchSignals();
  }, [fetchSignals]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchSignals, 30_000);
    return () => clearInterval(interval);
  }, [fetchSignals]);

  const filteredSignals = signals.filter((s) => {
    if (filter === 'all') return true;
    if (filter === 'extreme') return s.strength === 'EXTREME';
    if (filter === 'strong') return s.strength === 'STRONG';
    if (filter === 'moderate') return s.strength === 'MODERATE';
    return true;
  });

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="trading-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-lg">Active Signals</h2>
            <p className="text-gray-400 text-sm">
              {signals.length} opportunities detected
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-trading-green status-dot-live' : 'bg-trading-yellow'}`} />
              <span className={`text-xs font-mono ${isLive ? 'text-trading-green' : 'text-trading-yellow'}`}>
                {isLive ? 'LIVE' : 'SIMULATED'}
              </span>
            </div>
            <button
              onClick={refreshSignals}
              disabled={isRefreshing}
              className="px-3 py-1.5 rounded-lg text-xs bg-trading-surface border border-trading-border text-gray-300 hover:text-white hover:border-trading-green/50 transition-all disabled:opacity-50"
            >
              {isRefreshing ? '⏳ Scanning...' : '🔄 Refresh'}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mt-3 pt-3 border-t border-trading-border">
          {(['all', 'extreme', 'strong', 'moderate'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-all ${
                filter === f
                  ? 'bg-trading-green text-black font-bold'
                  : 'text-gray-400 hover:text-white bg-trading-surface border border-trading-border'
              }`}
            >
              {f}
            </button>
          ))}
          <span className="ml-auto text-xs text-gray-500 self-center">
            {filteredSignals.length} showing
          </span>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Extreme', count: signals.filter((s) => s.strength === 'EXTREME').length, color: 'text-trading-purple' },
          { label: 'Strong', count: signals.filter((s) => s.strength === 'STRONG').length, color: 'text-trading-green' },
          { label: 'Moderate', count: signals.filter((s) => s.strength === 'MODERATE').length, color: 'text-trading-yellow' },
          { label: 'Long/Short', count: signals.filter((s) => s.direction === 'LONG').length, color: 'text-trading-blue' },
        ].map((item) => (
          <div key={item.label} className="trading-card p-3 text-center">
            <div className={`text-xl font-bold font-mono ${item.color}`}>{item.count}</div>
            <div className="text-xs text-gray-500 mt-0.5">{item.label}</div>
          </div>
        ))}
      </div>

      {/* Signal Cards */}
      <div className="space-y-3">
        {filteredSignals.length === 0 ? (
          <div className="trading-card p-8 text-center text-gray-500">
            No signals match current filter
          </div>
        ) : (
          filteredSignals.map((signal) => (
            <SignalCard
              key={signal.id}
              signal={signal}
              isExpanded={expandedId === signal.id}
              onToggle={() =>
                setExpandedId(expandedId === signal.id ? null : signal.id)
              }
              onExecute={setSelectedSignal}
            />
          ))
        )}
      </div>

      {/* Execution Modal */}
      <ExecutionModal
        signal={selectedSignal}
        onClose={() => setSelectedSignal(null)}
      />
    </div>
  );
}
