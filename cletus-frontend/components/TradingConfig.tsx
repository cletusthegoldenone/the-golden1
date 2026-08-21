'use client';

import { useSimulation, AGGRESSION_PRESETS, DEFAULT_CONFIG } from '@/context/SimulationContext';
import type { AggressionLevel } from '@/types';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function TradingConfig() {
  const { config, stats, updateConfig, applyAggressionPreset, startSimulation, pauseSimulation, resetSimulation } =
    useSimulation();

  const preset = AGGRESSION_PRESETS[config.aggression];

  const handleDayToggle = (i: number) => {
    const next = [...config.activeDays];
    next[i] = !next[i];
    updateConfig({ activeDays: next });
  };

  const handleCapitalChange = (val: string) => {
    const n = parseFloat(val);
    if (!isNaN(n) && n > 0) updateConfig({ initialCapital: n });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="trading-card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">Trading Configuration</h2>
            <p className="text-xs text-gray-500 mt-1">
              Set your trading hours, aggression level, and PnL limits. Cletus will simulate trades automatically within these parameters.
            </p>
          </div>
          {/* Quick run controls */}
          <div className="flex items-center gap-2 shrink-0">
            {stats.isRunning ? (
              <button
                onClick={pauseSimulation}
                className="px-5 py-2 rounded-lg text-sm font-semibold bg-trading-red/20 border border-trading-red/40 text-trading-red hover:bg-trading-red/30 transition-all"
              >
                ⏸ Pause Simulation
              </button>
            ) : (
              <button
                onClick={startSimulation}
                className="px-5 py-2 rounded-lg text-sm font-semibold bg-trading-green text-black hover:bg-trading-green/90 transition-all active:scale-[0.97]"
              >
                ▶ Start Simulation
              </button>
            )}
            <button
              onClick={resetSimulation}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-trading-surface border border-trading-border text-gray-400 hover:text-white hover:border-trading-border/60 transition-all"
            >
              ↺ Reset
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column */}
        <div className="space-y-5">
          {/* Starting Capital */}
          <div className="trading-card p-5">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
              💰 Starting Capital
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              Paper balance used for all simulated trades. Resets when you click Reset.
            </p>
            <div className="flex items-center gap-3">
              <span className="text-gray-400 text-sm">$</span>
              <input
                type="number"
                min="10"
                step="50"
                value={config.initialCapital}
                onChange={(e) => handleCapitalChange(e.target.value)}
                disabled={stats.isRunning}
                className="flex-1 bg-trading-surface border border-trading-border rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-trading-green transition-colors disabled:opacity-50"
              />
              <span className="text-gray-500 text-xs">USD</span>
            </div>
            <div className="flex gap-2 mt-3">
              {[500, 1000, 5000, 10000].map((v) => (
                <button
                  key={v}
                  disabled={stats.isRunning}
                  onClick={() => updateConfig({ initialCapital: v })}
                  className={`px-3 py-1 rounded text-xs font-mono transition-all disabled:opacity-40 ${
                    config.initialCapital === v
                      ? 'bg-trading-green/20 border border-trading-green/40 text-trading-green'
                      : 'bg-trading-surface border border-trading-border text-gray-400 hover:text-white'
                  }`}
                >
                  ${v.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          {/* Trading Hours */}
          <div className="trading-card p-5">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
              🕐 Trading Hours
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Cletus only opens new trades within these hours. Existing positions continue running outside the window.
            </p>

            {/* Day selector */}
            <div className="mb-4">
              <label className="text-xs text-gray-500 block mb-2">Active Days</label>
              <div className="flex gap-1.5 flex-wrap">
                {DAYS.map((day, i) => (
                  <button
                    key={day}
                    onClick={() => handleDayToggle(i)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      config.activeDays[i]
                        ? 'bg-trading-green/20 border border-trading-green/40 text-trading-green'
                        : 'bg-trading-surface border border-trading-border text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>

            {/* Time range */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1.5">Start Time</label>
                <input
                  type="time"
                  value={config.startTime}
                  onChange={(e) => updateConfig({ startTime: e.target.value })}
                  className="w-full bg-trading-surface border border-trading-border rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-trading-green transition-colors"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1.5">End Time</label>
                <input
                  type="time"
                  value={config.endTime}
                  onChange={(e) => updateConfig({ endTime: e.target.value })}
                  className="w-full bg-trading-surface border border-trading-border rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-trading-green transition-colors"
                />
              </div>
            </div>
            <p className="text-xs text-gray-600 mt-2">Times are in your local timezone.</p>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Aggression Level */}
          <div className="trading-card p-5">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
              ⚡ Aggression Level
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Sets default position size, stop loss width, and minimum signal score to open a trade.
            </p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {(Object.keys(AGGRESSION_PRESETS) as AggressionLevel[]).map((level) => {
                const p = AGGRESSION_PRESETS[level];
                const isActive = config.aggression === level;
                return (
                  <button
                    key={level}
                    onClick={() => applyAggressionPreset(level)}
                    className={`p-3 rounded-xl text-left transition-all border ${
                      isActive
                        ? `${p.bgColor} border-opacity-60`
                        : 'bg-trading-surface border-trading-border hover:border-trading-border/60'
                    }`}
                  >
                    <div className={`text-sm font-bold ${isActive ? p.color : 'text-gray-300'}`}>
                      {p.label}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 leading-tight">{p.description}</div>
                  </button>
                );
              })}
            </div>

            {/* Fine-tune */}
            <div className="border-t border-trading-border pt-4 space-y-3">
              <p className="text-xs text-gray-500">Fine-tune (overrides preset)</p>
              {[
                { label: 'Position Size %', key: 'positionSizePercent' as const, min: 0.5, max: 25, step: 0.5, suffix: '%' },
                { label: 'Stop Loss %', key: 'perTradeSL' as const, min: 1, max: 30, step: 0.5, suffix: '%' },
                { label: 'Take Profit %', key: 'perTradeTP' as const, min: 2, max: 100, step: 1, suffix: '%' },
              ].map(({ label, key, min, max, step, suffix }) => (
                <div key={key} className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-28 shrink-0">{label}</span>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={config[key]}
                    onChange={(e) => updateConfig({ [key]: parseFloat(e.target.value) })}
                    className="flex-1 accent-trading-green"
                  />
                  <span className="text-xs font-mono text-white w-12 text-right">
                    {config[key]}{suffix}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* PnL Margins */}
          <div className="trading-card p-5">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
              📊 PnL Margins
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Cletus auto-pauses when these daily limits are hit. Set to 0 to disable.
            </p>
            <div className="space-y-4">
              {/* Daily profit target */}
              <div>
                <div className="flex justify-between mb-1.5">
                  <label className="text-xs text-gray-400">Daily Profit Target</label>
                  <span className="text-xs font-mono text-trading-green">
                    {config.dailyProfitTarget > 0 ? `$${config.dailyProfitTarget.toFixed(0)}` : 'Disabled'}
                  </span>
                </div>
                <input
                  type="number"
                  min="0"
                  step="10"
                  value={config.dailyProfitTarget}
                  onChange={(e) => updateConfig({ dailyProfitTarget: Math.max(0, parseFloat(e.target.value) || 0) })}
                  placeholder="0 = disabled"
                  className="w-full bg-trading-surface border border-trading-border rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-trading-green transition-colors"
                />
                <p className="text-xs text-gray-600 mt-1">Stop trading when daily profit reaches this amount.</p>
              </div>

              {/* Daily max loss */}
              <div>
                <div className="flex justify-between mb-1.5">
                  <label className="text-xs text-gray-400">Daily Max Loss</label>
                  <span className="text-xs font-mono text-trading-red">
                    {config.dailyMaxLoss > 0 ? `-$${config.dailyMaxLoss.toFixed(0)}` : 'Disabled'}
                  </span>
                </div>
                <input
                  type="number"
                  min="0"
                  step="10"
                  value={config.dailyMaxLoss}
                  onChange={(e) => updateConfig({ dailyMaxLoss: Math.max(0, parseFloat(e.target.value) || 0) })}
                  placeholder="0 = disabled"
                  className="w-full bg-trading-surface border border-trading-border rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-trading-green transition-colors"
                />
                <p className="text-xs text-gray-600 mt-1">Stop trading when daily loss reaches this amount.</p>
              </div>

              {/* Max concurrent positions */}
              <div>
                <div className="flex justify-between mb-1.5">
                  <label className="text-xs text-gray-400">Max Concurrent Positions</label>
                  <span className="text-xs font-mono text-white">{config.maxPositions}</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={20}
                  step={1}
                  value={config.maxPositions}
                  onChange={(e) => updateConfig({ maxPositions: parseInt(e.target.value) })}
                  className="w-full accent-trading-green"
                />
                <div className="flex justify-between text-xs text-gray-600 mt-0.5">
                  <span>1</span><span>5</span><span>10</span><span>20</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Config summary */}
      <div className="trading-card p-4 bg-trading-green/5 border-trading-green/20">
        <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">Current Configuration Summary</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {[
            { label: 'Capital', value: `$${config.initialCapital.toLocaleString()}` },
            { label: 'Aggression', value: preset.label },
            { label: 'Position Size', value: `${config.positionSizePercent}%` },
            { label: 'Stop Loss', value: `${config.perTradeSL}%` },
            { label: 'Take Profit', value: `${config.perTradeTP}%` },
            { label: 'Max Positions', value: config.maxPositions.toString() },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <div className="text-xs text-gray-500">{label}</div>
              <div className="text-sm font-bold font-mono text-white mt-0.5">{value}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-trading-border flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
          <span>Hours: {config.startTime}–{config.endTime}</span>
          <span>Days: {DAYS.filter((_, i) => config.activeDays[i]).join(', ') || 'None selected'}</span>
          {config.dailyProfitTarget > 0 && <span className="text-trading-green">Profit target: ${config.dailyProfitTarget}</span>}
          {config.dailyMaxLoss > 0 && <span className="text-trading-red">Max loss: ${config.dailyMaxLoss}</span>}
        </div>
        <button
          onClick={() => {
            const defaultPreset = AGGRESSION_PRESETS[DEFAULT_CONFIG.aggression];
            const presetValues = {
              positionSizePercent: defaultPreset.positionSizePercent,
              signalThreshold: defaultPreset.signalThreshold,
              perTradeSL: defaultPreset.perTradeSL,
              perTradeTP: defaultPreset.perTradeTP,
            };
            updateConfig({ ...DEFAULT_CONFIG, ...presetValues });
          }}
          className="mt-3 text-xs text-gray-600 hover:text-gray-400 transition-colors underline"
        >
          Reset to defaults
        </button>
      </div>
    </div>
  );
}
