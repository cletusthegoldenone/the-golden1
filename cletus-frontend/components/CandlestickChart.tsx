'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { Timeframe, CandleData } from '@/types';

// Slight upward bias to simulate realistic trending price behavior in demo mode
const PRICE_DRIFT_BIAS = 0.49;

// Generate realistic mock candle data
function generateCandles(count: number, basePrice: number, volatility: number): CandleData[] {
  const candles: CandleData[] = [];
  let price = basePrice;
  const now = Math.floor(Date.now() / 1000);

  for (let i = count; i >= 0; i--) {
    const change = (Math.random() - PRICE_DRIFT_BIAS) * volatility;
    const open = price;
    const close = Math.max(0.00001, price + change);
    const high = Math.max(open, close) * (1 + Math.random() * 0.01);
    const low = Math.min(open, close) * (1 - Math.random() * 0.01);
    const volume = Math.random() * 500000 + 50000;

    candles.push({
      time: now - i * 60,
      open,
      high,
      low,
      close,
      volume,
    });

    price = close;
  }

  return candles;
}

// Calculate Simple Moving Average
function calcSMA(data: CandleData[], period: number): { time: number; value: number }[] {
  const result: { time: number; value: number }[] = [];
  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1);
    const avg = slice.reduce((sum, c) => sum + c.close, 0) / period;
    result.push({ time: data[i].time, value: avg });
  }
  return result;
}

// Calculate RSI
function calcRSI(data: CandleData[], period: number = 14): number {
  if (data.length < period + 1) return 50;
  const recent = data.slice(-period - 1);
  let gains = 0, losses = 0;
  for (let i = 1; i < recent.length; i++) {
    const diff = recent[i].close - recent[i - 1].close;
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

const TIMEFRAMES: { label: string; value: Timeframe; seconds: number }[] = [
  { label: '1m', value: '1m', seconds: 60 },
  { label: '5m', value: '5m', seconds: 300 },
  { label: '15m', value: '15m', seconds: 900 },
  { label: '1h', value: '1h', seconds: 3600 },
  { label: '4h', value: '4h', seconds: 14400 },
  { label: '1d', value: '1d', seconds: 86400 },
];

const TRADING_PAIRS = [
  { symbol: 'SOL/USDT', base: 185, vol: 2.5 },
  { symbol: 'JTO/USDT', base: 3.2, vol: 0.08 },
  { symbol: 'WIF/USDT', base: 2.8, vol: 0.07 },
  { symbol: 'BONK/USDT', base: 0.000035, vol: 0.0000008 },
  { symbol: 'PYTH/USDT', base: 0.42, vol: 0.012 },
  { symbol: 'JUP/USDT', base: 1.15, vol: 0.03 },
];

export default function CandlestickChart() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof import('lightweight-charts')['createChart']> | null>(null);
  const candleSeriesRef = useRef<unknown>(null);
  const volumeSeriesRef = useRef<unknown>(null);
  const ma20SeriesRef = useRef<unknown>(null);
  const ma50SeriesRef = useRef<unknown>(null);

  const [timeframe, setTimeframe] = useState<Timeframe>('15m');
  const [selectedPair, setSelectedPair] = useState(TRADING_PAIRS[0]);
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [showMA20, setShowMA20] = useState(true);
  const [showMA50, setShowMA50] = useState(true);
  const [rsi, setRsi] = useState(50);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [priceChange, setPriceChange] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const initChart = async () => {
      try {
        const { createChart, ColorType, CrosshairMode } = await import('lightweight-charts');

        if (chartRef.current) {
          chartRef.current.remove();
        }

        const chart = createChart(chartContainerRef.current!, {
          layout: {
            background: { type: ColorType.Solid, color: '#161b22' },
            textColor: '#8b949e',
          },
          grid: {
            vertLines: { color: '#21262d' },
            horzLines: { color: '#21262d' },
          },
          crosshair: {
            mode: CrosshairMode.Normal,
          },
          rightPriceScale: {
            borderColor: '#21262d',
          },
          timeScale: {
            borderColor: '#21262d',
            timeVisible: true,
            secondsVisible: false,
          },
          handleScroll: true,
          handleScale: true,
        });

        chartRef.current = chart;

        // Candlestick series
        const candleSeries = chart.addCandlestickSeries({
          upColor: '#00d4aa',
          downColor: '#ff4757',
          borderVisible: false,
          wickUpColor: '#00d4aa',
          wickDownColor: '#ff4757',
        });
        candleSeriesRef.current = candleSeries;

        // Volume series (histogram)
        const volumeSeries = chart.addHistogramSeries({
          color: '#26a69a',
          priceFormat: { type: 'volume' },
          priceScaleId: 'volume',
        });
        // Set scale margins on the price scale separately
        chart.priceScale('volume').applyOptions({
          scaleMargins: { top: 0.8, bottom: 0 },
        });
        volumeSeriesRef.current = volumeSeries;

        // MA20 series
        const ma20Series = chart.addLineSeries({
          color: '#4dabf7',
          lineWidth: 1,
          title: 'MA20',
          priceLineVisible: false,
          lastValueVisible: false,
        });
        ma20SeriesRef.current = ma20Series;

        // MA50 series
        const ma50Series = chart.addLineSeries({
          color: '#ff922b',
          lineWidth: 1,
          title: 'MA50',
          priceLineVisible: false,
          lastValueVisible: false,
        });
        ma50SeriesRef.current = ma50Series;

        // Resize observer
        const resizeObserver = new ResizeObserver(() => {
          if (chartContainerRef.current && chartRef.current) {
            chartRef.current.applyOptions({
              width: chartContainerRef.current.clientWidth,
              height: chartContainerRef.current.clientHeight,
            });
          }
        });

        resizeObserver.observe(chartContainerRef.current!);
        setIsLoading(false);

        return () => {
          resizeObserver.disconnect();
          chart.remove();
        };
      } catch {
        setIsLoading(false);
      }
    };

    const cleanup = initChart();
    return () => {
      cleanup.then((fn) => fn && fn());
    };
  }, []);

  // Load candle data when pair or timeframe changes
  const loadCandles = useCallback(() => {
    const tfInfo = TIMEFRAMES.find((t) => t.value === timeframe)!;
    const count = 200;
    const newCandles = generateCandles(count, selectedPair.base, selectedPair.vol);
    setCandles(newCandles);

    const lastCandle = newCandles[newCandles.length - 1];
    const firstCandle = newCandles[0];
    setCurrentPrice(lastCandle.close);
    setPriceChange(((lastCandle.close - firstCandle.open) / firstCandle.open) * 100);
    setRsi(calcRSI(newCandles));

    if (candleSeriesRef.current && volumeSeriesRef.current) {
      const chartCandles = newCandles.map((c) => ({
        time: c.time as unknown as import('lightweight-charts').Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));

      const chartVolume = newCandles.map((c) => ({
        time: c.time as unknown as import('lightweight-charts').Time,
        value: c.volume,
        color: c.close >= c.open ? 'rgba(0, 212, 170, 0.3)' : 'rgba(255, 71, 87, 0.3)',
      }));

      (candleSeriesRef.current as { setData: (d: unknown[]) => void }).setData(chartCandles);
      (volumeSeriesRef.current as { setData: (d: unknown[]) => void }).setData(chartVolume);

      if (ma20SeriesRef.current) {
        const ma20 = calcSMA(newCandles, 20).map((d) => ({
          time: d.time as unknown as import('lightweight-charts').Time,
          value: d.value,
        }));
        (ma20SeriesRef.current as { setData: (d: unknown[]) => void }).setData(
          showMA20 ? ma20 : []
        );
      }

      if (ma50SeriesRef.current) {
        const ma50 = calcSMA(newCandles, 50).map((d) => ({
          time: d.time as unknown as import('lightweight-charts').Time,
          value: d.value,
        }));
        (ma50SeriesRef.current as { setData: (d: unknown[]) => void }).setData(
          showMA50 ? ma50 : []
        );
      }
    }
  }, [selectedPair, timeframe, showMA20, showMA50]);

  useEffect(() => {
    if (!isLoading) {
      loadCandles();
    }
  }, [loadCandles, isLoading]);

  // Real-time price updates
  useEffect(() => {
    const interval = setInterval(() => {
      if (candleSeriesRef.current && candles.length > 0) {
        const lastCandle = candles[candles.length - 1];
        const priceChange = (Math.random() - 0.49) * selectedPair.vol * 0.1;
        const newClose = Math.max(0.00001, lastCandle.close + priceChange);
        const updatedCandle = {
          ...lastCandle,
          close: newClose,
          high: Math.max(lastCandle.high, newClose),
          low: Math.min(lastCandle.low, newClose),
        };

        setCurrentPrice(newClose);
        setCandles((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = updatedCandle;
          return updated;
        });

        (candleSeriesRef.current as {
          update: (d: unknown) => void;
        }).update({
          time: updatedCandle.time as unknown as import('lightweight-charts').Time,
          open: updatedCandle.open,
          high: updatedCandle.high,
          low: updatedCandle.low,
          close: updatedCandle.close,
        });
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [candles, selectedPair.vol]);

  const formatPrice = (p: number) => {
    if (p < 0.0001) return p.toFixed(8);
    if (p < 0.01) return p.toFixed(6);
    if (p < 1) return p.toFixed(4);
    if (p < 100) return p.toFixed(3);
    return p.toFixed(2);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Chart Header */}
      <div className="trading-card p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {/* Pair selector */}
          <div className="flex items-center gap-3">
            <select
              value={selectedPair.symbol}
              onChange={(e) => {
                const pair = TRADING_PAIRS.find((p) => p.symbol === e.target.value)!;
                setSelectedPair(pair);
                setIsLoading(true);
                setTimeout(() => setIsLoading(false), 100);
              }}
              className="bg-trading-surface border border-trading-border text-white rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:border-trading-green"
            >
              {TRADING_PAIRS.map((p) => (
                <option key={p.symbol} value={p.symbol}>
                  {p.symbol}
                </option>
              ))}
            </select>

            <div>
              <div
                className={`text-xl font-bold font-mono ${
                  priceChange >= 0 ? 'text-trading-green' : 'text-trading-red'
                }`}
              >
                ${formatPrice(currentPrice)}
              </div>
              <div
                className={`text-xs font-mono ${
                  priceChange >= 0 ? 'text-trading-green' : 'text-trading-red'
                }`}
              >
                {priceChange >= 0 ? '▲' : '▼'} {Math.abs(priceChange).toFixed(2)}%
              </div>
            </div>
          </div>

          {/* Timeframe selector */}
          <div className="flex items-center gap-1">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.value}
                onClick={() => setTimeframe(tf.value)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-all duration-150 ${
                  timeframe === tf.value
                    ? 'bg-trading-green text-black font-bold'
                    : 'text-gray-400 hover:text-white hover:bg-trading-surface'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>

        {/* Indicator toggles */}
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-trading-border">
          <span className="text-xs text-gray-500">Indicators:</span>
          <button
            onClick={() => setShowMA20((v) => !v)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-all ${
              showMA20
                ? 'bg-trading-blue/20 text-trading-blue border border-trading-blue/40'
                : 'text-gray-600 hover:text-gray-400 border border-transparent'
            }`}
          >
            <div className="w-3 h-0.5 bg-trading-blue" />
            MA20
          </button>
          <button
            onClick={() => setShowMA50((v) => !v)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-all ${
              showMA50
                ? 'bg-trading-orange/20 text-trading-orange border border-trading-orange/40'
                : 'text-gray-600 hover:text-gray-400 border border-transparent'
            }`}
          >
            <div className="w-3 h-0.5 bg-trading-orange" />
            MA50
          </button>
          <div className="ml-auto flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-trading-green status-dot-live" />
            <span className="text-xs text-trading-green font-mono">LIVE</span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="trading-card p-0 overflow-hidden">
        <div ref={chartContainerRef} className="w-full h-[420px] md:h-[520px]">
          {isLoading && (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-gray-500 text-sm">Loading chart...</div>
            </div>
          )}
        </div>
      </div>

      {/* Technical Indicators Panel */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* RSI */}
        <div className="trading-card p-3">
          <div className="text-xs text-gray-500 mb-1">RSI (14)</div>
          <div
            className={`text-lg font-bold font-mono ${
              rsi > 70
                ? 'text-trading-red'
                : rsi < 30
                ? 'text-trading-green'
                : 'text-trading-yellow'
            }`}
          >
            {rsi.toFixed(1)}
          </div>
          <div className="text-xs mt-1">
            {rsi > 70 ? (
              <span className="text-trading-red">Overbought</span>
            ) : rsi < 30 ? (
              <span className="text-trading-green">Oversold</span>
            ) : (
              <span className="text-trading-yellow">Neutral</span>
            )}
          </div>
          <div className="mt-2 h-1.5 bg-trading-surface rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                rsi > 70
                  ? 'bg-trading-red'
                  : rsi < 30
                  ? 'bg-trading-green'
                  : 'bg-trading-yellow'
              }`}
              style={{ width: `${rsi}%` }}
            />
          </div>
        </div>

        {/* MACD */}
        <div className="trading-card p-3">
          <div className="text-xs text-gray-500 mb-1">MACD</div>
          <div className="text-lg font-bold font-mono text-trading-green">Bullish</div>
          <div className="text-xs text-gray-400 mt-1">Signal crossing up</div>
          <div className="flex gap-1 mt-2">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className={`flex-1 h-4 rounded-sm ${
                  i < 5 ? 'bg-trading-green/60' : 'bg-trading-red/60'
                }`}
                style={{ height: `${Math.random() * 12 + 4}px` }}
              />
            ))}
          </div>
        </div>

        {/* Volume */}
        <div className="trading-card p-3">
          <div className="text-xs text-gray-500 mb-1">Volume 24h</div>
          <div className="text-lg font-bold font-mono text-trading-blue">
            $
            {(candles.reduce((s, c) => s + c.volume, 0) / 1e6).toFixed(1)}M
          </div>
          <div className="text-xs text-trading-green mt-1">+23% vs avg</div>
        </div>

        {/* Trend */}
        <div className="trading-card p-3">
          <div className="text-xs text-gray-500 mb-1">Trend</div>
          <div className="text-lg font-bold text-trading-green">↗ Bullish</div>
          <div className="text-xs text-gray-400 mt-1">MA20 above MA50</div>
          <div className="mt-2 text-xs">
            <span className="text-trading-blue">MA20: </span>
            <span className="font-mono text-white">
              ${formatPrice(selectedPair.base * 0.98)}
            </span>
          </div>
        </div>
      </div>

      {/* Trade Entry/Exit Markers Legend */}
      <div className="trading-card p-4">
        <div className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-3">
          Recent Trade Markers
        </div>
        <div className="flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-trading-green text-base">▲</span>
            <span className="text-gray-400">Long Entry</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-trading-red text-base">▼</span>
            <span className="text-gray-400">Short Entry</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-trading-yellow text-base">◆</span>
            <span className="text-gray-400">Take Profit</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-base">◇</span>
            <span className="text-gray-400">Stop Loss</span>
          </div>
          <div className="ml-auto flex items-center gap-4 text-gray-500">
            <span>
              Entry: <span className="text-white font-mono">${formatPrice(selectedPair.base * 0.97)}</span>
            </span>
            <span>
              TP: <span className="text-trading-green font-mono">${formatPrice(selectedPair.base * 1.25)}</span>
            </span>
            <span>
              SL: <span className="text-trading-red font-mono">${formatPrice(selectedPair.base * 0.90)}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
