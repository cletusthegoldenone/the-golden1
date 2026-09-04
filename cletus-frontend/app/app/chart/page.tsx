'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

type TokenResult = {
  id: string;
  symbol: string;
  name: string;
  address?: string;
  image?: string;
  priceUsd?: number;
  change24h?: number;
  volume24h?: number;
  mcap?: number;
  fdv?: number;
  liquidityUsd?: number;
  txns24h?: number;
  holders?: number;
  dex?: string;
  chain?: string;
  quoteSymbol?: string;
  pairAddress?: string;
};

type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

type Range = '1m' | '5m' | '15m' | '1H' | '4H' | '1D' | '1W';

const RANGE_CONFIG: Record<Range, { timeframe: string; count: string }> = {
  '1m': { timeframe: '1m', count: '120' },
  '5m': { timeframe: '5m', count: '120' },
  '15m': { timeframe: '15m', count: '120' },
  '1H': { timeframe: '1h', count: '120' },
  '4H': { timeframe: '4h', count: '120' },
  '1D': { timeframe: '1d', count: '90' },
  '1W': { timeframe: '1w', count: '104' },
};

const DEFAULT_SYMBOL = 'BONK';
const DEFAULT_MINT = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';

function normalizeTokenResults(list: unknown[]): TokenResult[] {
  return list.reduce<TokenResult[]>((acc, item) => {
      const token = item as Partial<TokenResult>;
      const symbol = typeof token.symbol === 'string' ? token.symbol.trim() : '';
      const name = typeof token.name === 'string' ? token.name.trim() : '';
      const address = typeof token.address === 'string' ? token.address.trim() : '';
      const id = typeof token.id === 'string' ? token.id.trim() : address || symbol || name;
      if (!id || (!symbol && !name && !address)) return acc;

      acc.push({
        id,
        symbol: symbol || name || address.slice(0, 6),
        name: name || symbol || 'Unknown token',
        address,
        image: typeof token.image === 'string' ? token.image : undefined,
        priceUsd: typeof token.priceUsd === 'number' ? token.priceUsd : undefined,
        change24h: typeof token.change24h === 'number' ? token.change24h : undefined,
        volume24h: typeof token.volume24h === 'number' ? token.volume24h : undefined,
        mcap: typeof token.mcap === 'number' ? token.mcap : undefined,
        fdv: typeof token.fdv === 'number' ? token.fdv : undefined,
        liquidityUsd: typeof token.liquidityUsd === 'number' ? token.liquidityUsd : undefined,
        txns24h: typeof token.txns24h === 'number' ? token.txns24h : undefined,
        holders: typeof token.holders === 'number' ? token.holders : undefined,
        dex: typeof token.dex === 'string' ? token.dex : 'Unknown',
        chain: typeof token.chain === 'string' ? token.chain : 'Solana',
        quoteSymbol: 'USDC',
        pairAddress: typeof token.pairAddress === 'string' ? token.pairAddress : undefined,
      });
      return acc;
    }, []);
}

function formatUsd(value?: number) {
  if (value == null || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

function formatPrice(value?: number) {
  if (value == null || !Number.isFinite(value)) return '—';
  if (value < 0.0001) return value.toExponential(2);
  if (value < 0.01) return value.toFixed(6);
  if (value < 1) return value.toFixed(4);
  if (value < 1000) return value.toFixed(2);
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatPriceDisplay(value?: number) {
  const formatted = formatPrice(value);
  return formatted === '—' ? formatted : `$${formatted}`;
}

function formatPercent(value?: number) {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function formatCount(value?: number) {
  if (value == null || !Number.isFinite(value)) return '—';
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toFixed(0);
}

function truncateAddress(value?: string) {
  if (!value) return '—';
  if (value.length <= 12) return value;
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

function parseTimestamp(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export default function TokenChartPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TokenResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<TokenResult | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [range, setRange] = useState<Range>('15m');
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [chartSource, setChartSource] = useState('DexScreener / Helius');
  const [chartReady, setChartReady] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof import('lightweight-charts')['createChart']> | null>(null);
  const candleSeriesRef = useRef<unknown>(null);
  const volumeSeriesRef = useRef<unknown>(null);

  const fetchTokenResults = useCallback(async (term: string): Promise<TokenResult[]> => {
    const res = await fetch(`/api/tokens?q=${encodeURIComponent(term)}`);
    if (!res.ok) throw new Error('search-unavailable');
    const data = await res.json();
    const list: unknown[] = Array.isArray(data.tokens)
      ? data.tokens
      : Array.isArray(data.results)
        ? data.results
        : [];
    return normalizeTokenResults(list);
  }, []);

  const searchTokens = useCallback(async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      setResults([]);
      setHasSearched(false);
      setSearching(false);
      setError('');
      return;
    }

    setSearching(true);
    setError('');
    setHasSearched(true);

    try {
      const normalized = await fetchTokenResults(trimmed);
      setResults(normalized);
    } catch {
      setResults([]);
      setError('Search failed. Check connection.');
    } finally {
      setSearching(false);
    }
  }, [fetchTokenResults]);

  const loadChart = useCallback(async (mint: string, symbol: string, nextRange: Range) => {
    if (!mint) {
      setCandles([]);
      setLastFetchedAt(null);
      setError('Token mint missing. Pick a different token.');
      return;
    }

    const config = RANGE_CONFIG[nextRange];
    setChartLoading(true);
    setCandles([]);
    setLastFetchedAt(null);
    setError('');

    try {
      const params = new URLSearchParams({
        mint,
        pair: `${symbol.toUpperCase()}/USDC`,
        timeframe: config.timeframe,
        count: config.count,
      });

      const res = await fetch(`/api/prices?${params}`);
      if (!res.ok) {
        setCandles([]);
        setLastFetchedAt(null);
        setError('Chart data unavailable for this token.');
        return;
      }

      const data = await res.json();
      const nextCandles = Array.isArray(data.candles) ? data.candles : [];
      setCandles(nextCandles);
      setLastFetchedAt(parseTimestamp(data.lastUpdated));
      setChartSource(typeof data.source === 'string' ? data.source : 'DexScreener / Helius');
      setSelected((prev) =>
        prev
          ? {
              ...prev,
              priceUsd: typeof data.currentPrice === 'number' ? data.currentPrice : prev.priceUsd,
              change24h: typeof data.change24h === 'number' ? data.change24h : prev.change24h,
              quoteSymbol: 'USDC',
            }
          : prev
      );
    } catch {
      setCandles([]);
      setLastFetchedAt(null);
      setError('Failed to load chart.');
    } finally {
      setChartLoading(false);
    }
  }, []);

  const selectToken = useCallback((token: TokenResult) => {
    setSelected({ ...token, quoteSymbol: 'USDC' });
    setResults([]);
    setQuery(token.symbol || token.name);
    setHasSearched(false);
    setError('');
  }, []);

  useEffect(() => {
    const mint = selected?.address?.trim();
    const symbol = selected?.symbol?.trim();
    if (mint && symbol) {
      void loadChart(mint, symbol, range);
    }
  }, [loadChart, range, selected?.address, selected?.symbol]);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const bootstrapDefaultToken = async () => {
      try {
        const normalized = await fetchTokenResults(DEFAULT_SYMBOL);
        if (!normalized.length || cancelled) return;
        const preferred =
          normalized.find((token) => token.address === DEFAULT_MINT) ??
          normalized.find((token) => token.symbol.toUpperCase() === DEFAULT_SYMBOL) ??
          normalized[0];
        setSelected({ ...preferred, quoteSymbol: 'USDC' });
        setQuery(preferred.symbol || preferred.name || DEFAULT_SYMBOL);
      } catch {
        // no-op; empty chart state already handled
      }
    };

    void bootstrapDefaultToken();
    return () => {
      cancelled = true;
    };
  }, [fetchTokenResults]);

  useEffect(() => {
    if (!selected || !chartContainerRef.current) return;

    let resizeObserver: ResizeObserver | null = null;
    let mounted = true;

    const initChart = async () => {
      try {
        const { ColorType, CrosshairMode, createChart } = await import('lightweight-charts');
        if (!mounted || !chartContainerRef.current) return;

        if (chartRef.current) {
          chartRef.current.remove();
        }

        const chart = createChart(chartContainerRef.current, {
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
          layout: {
            background: { type: ColorType.Solid, color: '#000000' },
            textColor: '#7f8c8d',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          },
          grid: {
            vertLines: { color: 'rgba(255,255,255,0.08)' },
            horzLines: { color: 'rgba(255,255,255,0.08)' },
          },
          crosshair: {
            mode: CrosshairMode.Normal,
          },
          rightPriceScale: {
            borderColor: 'rgba(255,255,255,0.12)',
          },
          timeScale: {
            borderColor: 'rgba(255,255,255,0.12)',
            timeVisible: true,
            secondsVisible: false,
          },
        });

        const candleSeries = chart.addCandlestickSeries({
          upColor: '#10b981',
          downColor: '#ef4444',
          borderUpColor: '#10b981',
          borderDownColor: '#ef4444',
          wickUpColor: '#10b981',
          wickDownColor: '#ef4444',
          priceLineVisible: false,
        });

        const volumeSeries = chart.addHistogramSeries({
          priceScaleId: 'volume',
          priceFormat: { type: 'volume' },
        });

        chart.priceScale('volume').applyOptions({
          scaleMargins: { top: 0.76, bottom: 0 },
          borderVisible: false,
        });

        chartRef.current = chart;
        candleSeriesRef.current = candleSeries;
        volumeSeriesRef.current = volumeSeries;
        setChartReady(true);

        resizeObserver = new ResizeObserver(() => {
          if (!chartContainerRef.current || !chartRef.current) return;
          chartRef.current.applyOptions({
            width: chartContainerRef.current.clientWidth,
            height: chartContainerRef.current.clientHeight,
          });
        });

        resizeObserver.observe(chartContainerRef.current);
      } catch {
        setError((prev) => prev || 'Chart renderer unavailable.');
      }
    };

    void initChart();

    return () => {
      mounted = false;
      resizeObserver?.disconnect();
      setChartReady(false);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, [selected]);

  const displayedCandles = candles;

  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current || !chartRef.current || !chartReady) return;

    if (!displayedCandles.length) {
      (candleSeriesRef.current as { setData: (data: unknown[]) => void }).setData([]);
      (volumeSeriesRef.current as { setData: (data: unknown[]) => void }).setData([]);
      return;
    }

    const chartCandles = displayedCandles.map((candle) => ({
      time: candle.time as unknown as import('lightweight-charts').Time,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    }));

    const chartVolume = displayedCandles.map((candle) => ({
      time: candle.time as unknown as import('lightweight-charts').Time,
      value: candle.volume ?? 0,
      color: candle.close >= candle.open ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)',
    }));

    (candleSeriesRef.current as { setData: (data: unknown[]) => void }).setData(chartCandles);
    (volumeSeriesRef.current as { setData: (data: unknown[]) => void }).setData(chartVolume);
    chartRef.current.timeScale().fitContent();
  }, [displayedCandles, chartReady]);

  const metricItems = useMemo(() => {
    if (!selected) return [];

    const items = [
      { label: 'Mcap', value: formatUsd(selected.mcap) },
      { label: 'FDV', value: formatUsd(selected.fdv) },
      { label: 'Liq', value: formatUsd(selected.liquidityUsd) },
      { label: 'Vol 24h', value: formatUsd(selected.volume24h) },
      { label: 'Txns 24h', value: formatCount(selected.txns24h) },
    ];

    if (selected.holders != null) {
      items.push({ label: 'Holders', value: formatCount(selected.holders) });
    }

    return items;
  }, [selected]);

  const lastCandle = displayedCandles.length > 0 ? displayedCandles[displayedCandles.length - 1] : null;
  const lastUpdateLabel = lastFetchedAt != null
    ? new Date(lastFetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '—';

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-white/10 px-3 py-3 sm:px-5">
        <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center gap-3">
          <Link href="/app" className="shrink-0 text-sm font-semibold tracking-[0.08em] text-white/90">
            Cletus · Chart
          </Link>

          <div className="relative min-w-[260px] flex-1">
            <input
              type="text"
              value={query}
              onChange={(event) => {
                const value = event.target.value;
                setQuery(value);
                if (debounceRef.current) clearTimeout(debounceRef.current);
                debounceRef.current = setTimeout(() => {
                  void searchTokens(value);
                }, 250);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && results[0]) {
                  selectToken(results[0]);
                }
              }}
              placeholder="search…"
              className="h-10 w-full border border-white/15 bg-black px-3 pr-10 text-sm text-white outline-none placeholder:text-white/35 focus:border-emerald-400 font-mono"
              autoComplete="off"
              spellCheck={false}
            />
            <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[10px] uppercase tracking-[0.18em] text-white/40">
              {searching ? 'scan' : 'find'}
            </div>

            {results.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden border border-white/15 bg-black shadow-2xl">
                <div className="grid grid-cols-[1.1fr_1.8fr_1fr_0.8fr] gap-3 border-b border-white/10 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-white/40">
                  <span>Symbol</span>
                  <span>Name</span>
                  <span className="text-right">Price</span>
                  <span className="text-right">24h</span>
                </div>
                <ul className="max-h-80 overflow-y-auto">
                  {results.map((token) => (
                    <li key={token.id}>
                      <button
                        type="button"
                        onClick={() => selectToken(token)}
                        className="grid w-full grid-cols-[1.1fr_1.8fr_1fr_0.8fr] gap-3 border-b border-white/5 px-3 py-2 text-left text-sm transition-colors hover:bg-white/5"
                      >
                        <span className="truncate font-semibold">{token.symbol}</span>
                        <span className="truncate text-white/65">{token.name}</span>
                        <span className="text-right font-mono text-white/80">
                          {formatPriceDisplay(token.priceUsd)}
                        </span>
                        <span
                          className={`text-right font-mono ${
                            (token.change24h ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {formatPercent(token.change24h)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em]">
            <span className="border border-white/15 px-2.5 py-2 text-white/80">USDC</span>
            <span className="inline-flex items-center gap-2 border border-emerald-400/40 px-2.5 py-2 text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              LIVE
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-3 px-3 py-4 sm:px-5 sm:py-5">
        {error && <div className="border border-red-500/30 px-3 py-2 text-sm text-red-400">{error}</div>}

        {selected ? (
          <>
            <section className="border border-white/10 bg-black px-4 py-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-mono text-xl font-semibold tracking-tight sm:text-2xl">
                    {selected.symbol} / USDC
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-white/50">
                    <span>{selected.chain || 'Solana'}</span>
                    <span>·</span>
                    <span>{selected.dex || 'Unknown DEX'}</span>
                    <span>·</span>
                    <span className="font-mono">mint {truncateAddress(selected.address)}</span>
                  </div>
                </div>

                <div className="text-left md:text-right">
                  <div className="font-mono text-2xl font-semibold tracking-tight sm:text-3xl">
                    {formatPriceDisplay(selected.priceUsd)}
                  </div>
                  <div
                    className={`mt-1 font-mono text-sm ${
                      (selected.change24h ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {formatPercent(selected.change24h)} 24h
                  </div>
                </div>
              </div>
            </section>

            <section className="overflow-x-auto">
              <div
                className="min-w-[680px] border border-white/10"
              >
                <div
                  className="grid border-b border-white/10 bg-black text-[10px] uppercase tracking-[0.18em] text-white/40"
                  style={{ gridTemplateColumns: `repeat(${metricItems.length || 1}, minmax(0, 1fr))` }}
                >
                  {metricItems.map((item) => (
                    <div key={`${item.label}-header`} className="border-r border-white/10 px-3 py-2 last:border-r-0">
                      {item.label}
                    </div>
                  ))}
                </div>
                <div
                  className="grid bg-black"
                  style={{ gridTemplateColumns: `repeat(${metricItems.length || 1}, minmax(0, 1fr))` }}
                >
                  {metricItems.map((item) => (
                    <div key={item.label} className="border-r border-white/10 px-3 py-2.5 font-mono text-sm text-white/90 last:border-r-0 sm:text-base">
                      {item.value}
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="flex flex-wrap items-center justify-between gap-2 border border-white/10 bg-black px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                {(Object.keys(RANGE_CONFIG) as Range[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setRange(item)}
                    aria-pressed={range === item}
                    className={`px-2 py-1 font-mono text-xs uppercase tracking-[0.14em] transition-colors ${
                      range === item
                        ? 'text-emerald-400'
                        : 'text-white/50 hover:text-white'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1 text-xs">
                <span className="border border-emerald-400 px-2.5 py-1 font-mono uppercase tracking-[0.14em] text-emerald-400">
                  Price
                </span>
                <span className="border border-white/10 px-2.5 py-1 font-mono uppercase tracking-[0.14em] text-white/40">
                  Mcap
                </span>
              </div>
            </section>

            <section className="border border-white/10 bg-black">
              <div className="relative min-h-[320px] w-full md:min-h-[460px]">
                <div ref={chartContainerRef} className="h-[320px] w-full md:h-[460px]" />
                {chartLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/75 font-mono text-sm text-white/45">
                    Loading candles…
                  </div>
                )}
                {!chartLoading && candles.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center px-4 text-center font-mono text-sm text-white/35">
                    No candle data available for this token.
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2 border-t border-white/10 px-3 py-3 text-[11px] uppercase tracking-[0.16em] text-white/45 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-white/75">
                  <span>O {lastCandle ? formatPrice(lastCandle.open) : '—'}</span>
                  <span>H {lastCandle ? formatPrice(lastCandle.high) : '—'}</span>
                  <span>L {lastCandle ? formatPrice(lastCandle.low) : '—'}</span>
                  <span>C {lastCandle ? formatPrice(lastCandle.close) : '—'}</span>
                </div>
                <div className="font-mono text-white/45">
                  last update {lastUpdateLabel} · source {chartSource}
                </div>
              </div>
            </section>
          </>
        ) : (
          <section className="border border-white/10 px-4 py-10 text-center text-sm text-white/40">
            Search by symbol or mint address to open a live USDC chart.
          </section>
        )}

        {hasSearched && !searching && results.length === 0 && !selected && !error && (
          <div className="border border-white/10 px-3 py-3 text-sm text-white/45">
            No token results. Try a symbol or paste a mint address.
          </div>
        )}
      </main>
    </div>
  );
}
