'use client';

import { useSimulation, AGGRESSION_PRESETS, TRADE_FEE_PERCENT, FEE_WALLET } from '@/context/SimulationContext';
import type { SimulatedPosition } from '@/types';
import FeeDistributionPanel from './FeeDistributionPanel';

function formatUsd(n: number, showSign = false): string {
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(n));
  if (showSign) return `${n >= 0 ? '+' : '-'}${formatted}`;
  return n < 0 ? `-${formatted}` : formatted;
}

function formatPrice(p: number): string {
  if (p < 0.0001) return p.toExponential(3);
  if (p < 0.01) return p.toFixed(6);
  if (p < 1) return p.toFixed(4);
  return p.toFixed(3);
}

function timeSince(ts: number): string {
  const secs = Math.floor((Date.now() - ts) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

function PositionRow({
  pos,
  onClose,
}: {
  pos: SimulatedPosition;
  onClose: (id: string) => void;
}) {
  const isLong = pos.direction === 'LONG';
  const pnlPositive = pos.pnlUsd >= 0;

  const pctToTP =
    isLong
      ? ((pos.currentPrice - pos.entryPrice) / (pos.takeProfit - pos.entryPrice)) * 100
      : ((pos.entryPrice - pos.currentPrice) / (pos.entryPrice - pos.takeProfit)) * 100;

  return (
    <div className="trading-card p-4 hover:border-trading-border/60 transition-all">
      <div className="flex items-start justify-between gap-3">
        {/* Token + direction */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full bg-trading-surface border border-trading-border flex items-center justify-center text-xs font-bold shrink-0">
            {pos.tokenName.slice(0, 2)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-white">{pos.tokenName}</span>
              <span
                className={`text-xs px-1.5 py-0.5 rounded font-semibold ${
                  isLong ? 'bg-trading-green/20 text-trading-green' : 'bg-trading-red/20 text-trading-red'
                }`}
              >
                {pos.direction}
              </span>
              <span className="text-xs text-gray-500 font-mono">
                Score: {(pos.signalScore * 100).toFixed(0)}
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-0.5">{timeSince(pos.openedAt)}</div>
          </div>
        </div>

        {/* P&L */}
        <div className="text-right shrink-0">
          <div
            className={`text-lg font-bold font-mono ${pnlPositive ? 'text-trading-green' : 'text-trading-red'}`}
          >
            {formatUsd(pos.pnlUsd, true)}
          </div>
          <div className={`text-xs font-mono ${pnlPositive ? 'text-trading-green/70' : 'text-trading-red/70'}`}>
            {pos.pnlPercent >= 0 ? '+' : ''}{pos.pnlPercent.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Progress bar toward TP */}
      <div className="mt-3">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>SL ${formatPrice(pos.stopLoss)}</span>
          <span className="text-gray-400">Current ${formatPrice(pos.currentPrice)}</span>
          <span>TP ${formatPrice(pos.takeProfit)}</span>
        </div>
        <div className="h-1.5 bg-trading-surface rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              pctToTP >= 70
                ? 'bg-trading-green'
                : pctToTP >= 30
                ? 'bg-trading-yellow'
                : 'bg-trading-red'
            }`}
            style={{ width: `${Math.min(100, Math.max(0, pctToTP))}%` }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
        <span>Size: <span className="text-white font-mono">{formatUsd(pos.positionSizeUsd)}</span></span>
        <button
          onClick={() => onClose(pos.id)}
          className="px-3 py-1 rounded-lg bg-trading-surface border border-trading-border hover:border-trading-red/40 hover:text-trading-red transition-all"
        >
          Close Position
        </button>
      </div>
    </div>
  );
}

function ClosedPositionRow({ pos }: { pos: SimulatedPosition }) {
  const won = (pos.closingPnlUsd ?? pos.pnlUsd) >= 0;
  const statusLabels: Record<SimulatedPosition['status'], string> = {
    OPEN: 'Open',
    CLOSED_TP: '✅ TP Hit',
    CLOSED_SL: '❌ SL Hit',
    CLOSED_MANUAL: '🤚 Manual',
  };

  return (
    <div className="flex items-center justify-between py-3 border-b border-trading-border/50 last:border-0 hover:bg-trading-surface/50 px-2 rounded transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-7 h-7 rounded-full bg-trading-surface border border-trading-border flex items-center justify-center text-xs font-bold shrink-0">
          {pos.tokenName.slice(0, 2)}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{pos.tokenName}</span>
            <span
              className={`text-xs px-1.5 rounded ${
                pos.direction === 'LONG'
                  ? 'text-trading-green bg-trading-green/10'
                  : 'text-trading-red bg-trading-red/10'
              }`}
            >
              {pos.direction}
            </span>
          </div>
          <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
            <span>{statusLabels[pos.status]}</span>
            {pos.closedAt && <span>{timeSince(pos.closedAt)}</span>}
            {pos.feeUsd !== undefined && (
              <span className="text-trading-yellow/70">fee: {formatUsd(pos.feeUsd)}</span>
            )}
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className={`text-sm font-bold font-mono ${won ? 'text-trading-green' : 'text-trading-red'}`}>
          {formatUsd(pos.closingPnlUsd ?? pos.pnlUsd, true)}
        </div>
        <div className="text-xs text-gray-500 font-mono">
          {formatUsd(pos.positionSizeUsd)} size
        </div>
      </div>
    </div>
  );
}

export default function SimulationDashboard() {
  const {
    config,
    stats,
    portfolioValue,
    unrealizedPnl,
    startSimulation,
    pauseSimulation,
    resetSimulation,
    closePosition,
  } = useSimulation();

  const totalPnl = portfolioValue - stats.initialCapital;
  const totalPnlPct = (totalPnl / stats.initialCapital) * 100;
  const winRate =
    stats.winCount + stats.lossCount > 0
      ? (stats.winCount / (stats.winCount + stats.lossCount)) * 100
      : 0;
  const preset = AGGRESSION_PRESETS[config.aggression];

  const statusLabel = stats.isRunning
    ? stats.isWithinTradingHours
      ? '🟢 Live — Trading Active'
      : '🟡 Live — Outside Trading Hours'
    : stats.isPaused
    ? '⏸ Paused'
    : '⚫ Stopped';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Status banner */}
      {stats.isPaused && stats.pauseReason && (
        <div className="trading-card p-4 border-trading-yellow/40 bg-trading-yellow/5">
          <div className="flex items-center gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <div className="font-semibold text-trading-yellow text-sm">Simulation Paused</div>
              <div className="text-xs text-gray-400 mt-0.5">{stats.pauseReason}</div>
            </div>
            <button
              onClick={startSimulation}
              className="ml-auto px-4 py-1.5 rounded-lg text-xs font-semibold bg-trading-green text-black hover:bg-trading-green/90 transition-all"
            >
              Resume
            </button>
          </div>
        </div>
      )}

      {/* Top controls */}
      <div className="trading-card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className={`w-2.5 h-2.5 rounded-full ${stats.isRunning ? 'bg-trading-green status-dot-live' : 'bg-gray-600'}`} />
              <span className="text-xs font-mono text-gray-400 uppercase tracking-wider">{statusLabel}</span>
            </div>
            <h2 className="text-2xl font-bold">
              Simulation{' '}
              <span className={`text-sm font-semibold ${preset.color}`}>· {preset.label}</span>
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Paper trading — no real funds at risk. Configure in the ⚙️ Config tab.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {stats.isRunning ? (
              <button
                onClick={pauseSimulation}
                className="px-5 py-2 rounded-lg text-sm font-semibold bg-trading-red/20 border border-trading-red/40 text-trading-red hover:bg-trading-red/30 transition-all"
              >
                ⏸ Pause
              </button>
            ) : (
              <button
                onClick={startSimulation}
                className="px-5 py-2 rounded-lg text-sm font-semibold bg-trading-green text-black hover:bg-trading-green/90 transition-all active:scale-[0.97]"
              >
                ▶ Start
              </button>
            )}
            <button
              onClick={resetSimulation}
              className="px-4 py-2 rounded-lg text-sm bg-trading-surface border border-trading-border text-gray-400 hover:text-white transition-all"
            >
              ↺
            </button>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: 'Portfolio Value',
            value: formatUsd(portfolioValue),
            sub: `Started at ${formatUsd(stats.initialCapital)}`,
            color: 'text-white',
            icon: '💼',
          },
          {
            label: 'Total P&L',
            value: formatUsd(totalPnl, true),
            sub: `${totalPnlPct >= 0 ? '+' : ''}${totalPnlPct.toFixed(2)}% all time`,
            color: totalPnl >= 0 ? 'text-trading-green' : 'text-trading-red',
            icon: '📈',
          },
          {
            label: 'Today\'s P&L',
            value: formatUsd(stats.dailyRealizedPnl, true),
            sub: 'Realised today',
            color: stats.dailyRealizedPnl >= 0 ? 'text-trading-green' : 'text-trading-red',
            icon: '🗓️',
          },
          {
            label: 'Unrealised P&L',
            value: formatUsd(unrealizedPnl, true),
            sub: `${stats.openPositions.length} open position${stats.openPositions.length !== 1 ? 's' : ''}`,
            color: unrealizedPnl >= 0 ? 'text-trading-green' : 'text-trading-red',
            icon: '⏳',
          },
        ].map((s) => (
          <div key={s.label} className="trading-card p-4 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 uppercase tracking-wider">{s.label}</span>
              <span className="text-base">{s.icon}</span>
            </div>
            <div className={`text-xl font-bold font-mono ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Available Cash', value: formatUsd(stats.availableBalance), icon: '💵', color: 'text-white' },
          { label: 'Win Rate', value: `${winRate.toFixed(1)}%`, sub: `${stats.winCount}W / ${stats.lossCount}L`, icon: '🎯', color: winRate >= 50 ? 'text-trading-green' : 'text-trading-red' },
          { label: 'Total Trades', value: (stats.winCount + stats.lossCount).toString(), sub: 'Closed positions', icon: '🔢', color: 'text-trading-blue' },
          { label: 'Aggression', value: preset.label, sub: `${config.positionSizePercent}% size · ${config.perTradeSL}% SL`, icon: '⚡', color: preset.color },
        ].map((s) => (
          <div key={s.label} className="trading-card p-4 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 uppercase tracking-wider">{s.label}</span>
              <span className="text-base">{s.icon}</span>
            </div>
            <div className={`text-xl font-bold font-mono ${s.color}`}>{s.value}</div>
            {'sub' in s && s.sub && <div className="text-xs text-gray-500">{s.sub}</div>}
          </div>
        ))}
      </div>

      {/* Platform fee info */}
      <div className="trading-card p-4 border-trading-yellow/20 bg-trading-yellow/5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">💸 Platform Fee</div>
            <div className="text-sm font-semibold text-trading-yellow">
              {TRADE_FEE_PERCENT}% per trade <span className="text-gray-500 font-normal">(charged on position size at close)</span>
            </div>
            <div className="text-xs text-gray-500 mt-1 font-mono">
              Fee wallet: <span className="text-gray-400">{FEE_WALLET}</span>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Fees Collected</div>
            <div className="text-xl font-bold font-mono text-trading-yellow">
              {formatUsd(stats.totalFeesCollected)}
            </div>
          </div>
        </div>
      </div>

      {/* Fee Distribution Panel */}
      <FeeDistributionPanel />

      {/* PnL limits bar */}
      {(config.dailyProfitTarget > 0 || config.dailyMaxLoss > 0) && (
        <div className="trading-card p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">Daily PnL Limits</div>
          <div className="space-y-3">
            {config.dailyProfitTarget > 0 && (
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-400">Profit Target</span>
                  <span className="font-mono text-trading-green">
                    {formatUsd(stats.dailyRealizedPnl, true)} / ${config.dailyProfitTarget}
                  </span>
                </div>
                <div className="h-2 bg-trading-surface rounded-full overflow-hidden">
                  <div
                    className="h-full bg-trading-green rounded-full transition-all"
                    style={{ width: `${Math.min(100, Math.max(0, (stats.dailyRealizedPnl / config.dailyProfitTarget) * 100))}%` }}
                  />
                </div>
              </div>
            )}
            {config.dailyMaxLoss > 0 && (
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-400">Max Loss Guard</span>
                  <span className="font-mono text-trading-red">
                    {formatUsd(Math.min(0, stats.dailyRealizedPnl), true)} / -${config.dailyMaxLoss}
                  </span>
                </div>
                <div className="h-2 bg-trading-surface rounded-full overflow-hidden">
                  <div
                    className="h-full bg-trading-red rounded-full transition-all"
                    style={{ width: `${Math.min(100, Math.max(0, (Math.abs(Math.min(0, stats.dailyRealizedPnl)) / config.dailyMaxLoss) * 100))}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Open positions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs text-gray-500 uppercase tracking-wider font-medium">
            Open Positions ({stats.openPositions.length} / {config.maxPositions})
          </h3>
          {!stats.isRunning && stats.openPositions.length === 0 && (
            <span className="text-xs text-gray-600">Start simulation to open positions</span>
          )}
        </div>
        {stats.openPositions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {stats.openPositions.map((pos) => (
              <PositionRow key={pos.id} pos={pos} onClose={closePosition} />
            ))}
          </div>
        ) : (
          <div className="trading-card p-8 text-center text-gray-600">
            <div className="text-4xl mb-3">📭</div>
            <div className="text-sm">No open positions</div>
            <div className="text-xs mt-1">
              {stats.isRunning
                ? stats.isWithinTradingHours
                  ? 'Waiting for a qualifying signal…'
                  : `Outside trading hours (${config.startTime}–${config.endTime})`
                : 'Start the simulation to begin trading'}
            </div>
          </div>
        )}
      </div>

      {/* Trade history */}
      {stats.closedPositions.length > 0 && (
        <div className="trading-card p-4">
          <h3 className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-3">
            Trade History ({stats.closedPositions.length})
          </h3>
          <div className="divide-y divide-trading-border/30">
            {stats.closedPositions.slice(0, 20).map((pos) => (
              <ClosedPositionRow key={pos.id} pos={pos} />
            ))}
          </div>
          {stats.closedPositions.length > 20 && (
            <div className="text-center text-xs text-gray-600 mt-3">
              Showing 20 of {stats.closedPositions.length} trades
            </div>
          )}
        </div>
      )}

      {/* Disclaimer */}
      <div className="trading-card p-3 border-trading-yellow/20">
        <p className="text-xs text-gray-600 leading-relaxed">
          🎮 <span className="text-gray-400">Simulation mode:</span> All trades are paper trades using simulated prices. No real funds are used or at risk. For beta testing only.
        </p>
      </div>
    </div>
  );
}
