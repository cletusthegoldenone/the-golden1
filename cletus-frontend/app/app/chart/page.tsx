'use client';

/**
 * Token Chart page — look up any token
 * Black background, logo on every page. Quote context: USDC.
 * Route: /app/chart
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import Image from 'next/image';
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
};

type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
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

export default function TokenChartPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TokenResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<TokenResult | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [range, setRange] = useState<'1H' | '4H' | '1D' | '1W' | '1M'>('1D');
  const [error, setError] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Search any token by name, symbol, or mint address
  const searchTokens = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 1) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    setError('');
    try {
      // Wire to backend / CoinGecko / Jupiter token list:
      // GET /api/tokens/search?q=...
      const res = await fetch(
        `/api/tokens/search?q=${encodeURIComponent(trimmed)}`
      );
      if (res.ok) {
        const data = await res.json();
        setResults(Array.isArray(data.tokens) ? data.tokens : data.results ?? []);
      } else {
        setResults([]);
        setError('Search unavailable. Try again.');
      }
    } catch {
      setResults([]);
      setError('Search failed. Check connection.');
    } finally {
      setSearching(false);
    }
  }, []);

  const onQueryChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchTokens(value), 300);
  };

  const loadChart = useCallback(async (token: TokenResult, r: typeof range) => {
    setChartLoading(true);
    setError('');
    try {
      // Wire to CoinGecko / Birdeye / your API:
      // GET /api/tokens/chart?id=...&range=1D
      const params = new URLSearchParams({
        range: r,
        quote: 'USDC',
      });
      if (token.id) params.set('id', token.id);
      if (token.address) params.set('address', token.address);
      if (token.symbol) params.set('symbol', token.symbol);

      const res = await fetch(`/api/tokens/chart?${params}`);
      if (res.ok) {
        const data = await res.json();
        setCandles(Array.isArray(data.candles) ? data.candles : []);
        if (data.priceUsd != null) {
          setSelected((prev) =>
            prev
              ? {
                  ...prev,
                  priceUsd: data.priceUsd,
                  change24h: data.change24h ?? prev.change24h,
                  volume24h: data.volume24h ?? prev.volume24h,
                  mcap: data.mcap ?? prev.mcap,
                }
              : prev
          );
        }
      } else {
        setCandles([]);
        setError('Chart data unavailable for this token.');
      }
    } catch {
      setCandles([]);
      setError('Failed to load chart.');
    } finally {
      setChartLoading(false);
    }
  }, []);

  const selectToken = (token: TokenResult) => {
    setSelected(token);
    setResults([]);
    setQuery(token.symbol || token.name);
    loadChart(token, range);
  };

  useEffect(() => {
    if (selected) loadChart(selected, range);
  }, [range]); // eslint-disable-line react-hooks/exhaustive-deps

  // Simple sparkline / bar chart from candles (no external chart lib required)
  const chartMin = candles.length
    ? Math.min(...candles.map((c) => c.low))
    : 0;
  const chartMax = candles.length
    ? Math.max(...candles.map((c) => c.high))
    : 1;
  const chartSpan = chartMax - chartMin || 1;

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Logo on every page */}
      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
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
              <div className="text-xs text-white/50 mt-0.5">Token chart</div>
            </div>
          </Link>
          <nav className="flex items-center gap-3 text-xs">
            <Link href="/app/signals" className="text-white/50 hover:text-white transition-colors">
              Signals
            </Link>
            <Link href="/app/wallet" className="text-white/50 hover:text-white transition-colors">
              Wallet
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 px-6 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Token Chart</h1>
            <p className="text-sm text-white/50 mt-1">
              Look up <strong className="text-white/70">any token</strong> by name, symbol, or
              mint address · Prices in USDC context
            </p>
          </div>

          {/* Search any token */}
          <div className="relative">
            <label className="block text-xs font-medium text-white/50 mb-1.5">
              Search any token
            </label>
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && results[0]) selectToken(results[0]);
                }}
                placeholder="e.g. SOL, BONK, or paste mint address…"
                className="flex-1 border border-white/15 rounded-xl px-4 py-3 text-sm bg-black text-white focus:outline-none focus:border-emerald-500/50 placeholder:text-white/30 font-mono"
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                onClick={() => searchTokens(query)}
                className="px-4 py-3 rounded-xl text-sm font-semibold border border-white/15 text-white/80 hover:bg-white/5 transition-all"
              >
                {searching ? '…' : 'Search'}
              </button>
            </div>

            {/* Dropdown results — any token match */}
            {results.length > 0 && (
              <ul className="absolute z-20 left-0 right-0 mt-2 max-h-64 overflow-y-auto rounded-xl border border-white/15 bg-[#0a0a0a] shadow-xl">
                {results.map((t) => (
                  <li key={t.id || t.address || t.symbol}>
                    <button
                      type="button"
                      onClick={() => selectToken(t)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                    >
                      {t.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={t.image} alt="" className="w-7 h-7 rounded-full" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold">
                          {(t.symbol || '?').slice(0, 2)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-sm">
                          {t.symbol}{' '}
                          <span className="text-white/40 font-normal">{t.name}</span>
                        </div>
                        {t.address && (
                          <div className="text-xs text-white/30 font-mono truncate">
                            {t.address}
                          </div>
                        )}
                      </div>
                      {t.priceUsd != null && (
                        <div className="text-xs font-mono text-white/60">
                          ${formatPrice(t.priceUsd)}
                        </div>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          {/* Selected token + chart */}
          {selected && (
            <div className="space-y-4">
              <div className="rounded-xl border border-white/10 bg-white/5 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                  {selected.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selected.image}
                      alt=""
                      className="w-10 h-10 rounded-full"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center font-bold">
                      {(selected.symbol || '?').slice(0, 2)}
                    </div>
                  )}
                  <div>
                    <div className="font-bold text-lg">
                      {selected.symbol}
                      <span className="text-white/40 font-normal text-sm ml-2">
                        / USDC
                      </span>
                    </div>
                    <div className="text-sm text-white/50">{selected.name}</div>
                  </div>
                </div>
                <div className="text-right font-mono">
                  {selected.priceUsd != null && (
                    <div className="text-xl font-bold">
                      ${formatPrice(selected.priceUsd)}
                    </div>
                  )}
                  {selected.change24h != null && (
                    <div
                      className={`text-sm ${
                        selected.change24h >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {selected.change24h >= 0 ? '+' : ''}
                      {selected.change24h.toFixed(2)}% 24h
                    </div>
                  )}
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                <div className="rounded-lg border border-white/10 bg-black/40 p-3">
                  <div className="text-xs text-white/40">24h volume</div>
                  <div className="font-mono mt-0.5">
                    {selected.volume24h != null
                      ? formatUsd(selected.volume24h)
                      : '—'}
                  </div>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/40 p-3">
                  <div className="text-xs text-white/40">Market cap</div>
                  <div className="font-mono mt-0.5">
                    {selected.mcap != null ? formatUsd(selected.mcap) : '—'}
                  </div>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/40 p-3 col-span-2 sm:col-span-1">
                  <div className="text-xs text-white/40">Mint / id</div>
                  <div className="font-mono mt-0.5 text-xs truncate">
                    {selected.address || selected.id || '—'}
                  </div>
                </div>
              </div>

              {/* Range tabs */}
              <div className="flex flex-wrap gap-2">
                {(['1H', '4H', '1D', '1W', '1M'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRange(r)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-all ${
                      range === r
                        ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10'
                        : 'border-white/10 text-white/50 hover:border-white/30'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>

              {/* Chart area */}
              <div className="rounded-xl border border-white/10 bg-[#0a0a0a] p-4 min-h-[220px]">
                {chartLoading && (
                  <div className="h-[200px] flex items-center justify-center text-white/30 text-sm">
                    Loading chart…
                  </div>
                )}
                {!chartLoading && candles.length === 0 && (
                  <div className="h-[200px] flex items-center justify-center text-white/30 text-sm text-center px-4">
                    No candle data yet. Connect `/api/tokens/chart` (CoinGecko / Birdeye) for
                    live OHLC. You can still look up any token above.
                  </div>
                )}
                {!chartLoading && candles.length > 0 && (
                  <div className="h-[200px] flex items-end gap-px">
                    {candles.map((c, i) => {
                      const highPct = ((c.high - chartMin) / chartSpan) * 100;
                      const lowPct = ((c.low - chartMin) / chartSpan) * 100;
                      const openPct = ((c.open - chartMin) / chartSpan) * 100;
                      const closePct = ((c.close - chartMin) / chartSpan) * 100;
                      const up = c.close >= c.open;
                      const bodyTop = Math.max(openPct, closePct);
                      const bodyBottom = Math.min(openPct, closePct);
                      return (
                        <div
                          key={c.time ?? i}
                          className="flex-1 min-w-0 relative h-full"
                          title={`O:${c.open} H:${c.high} L:${c.low} C:${c.close}`}
                        >
                          <div
                            className={`absolute left-1/2 w-px -translate-x-1/2 ${
                              up ? 'bg-emerald-500/60' : 'bg-red-500/60'
                            }`}
                            style={{
                              bottom: `${lowPct}%`,
                              height: `${Math.max(1, highPct - lowPct)}%`,
                            }}
                          />
                          <div
                            className={`absolute left-0 right-0 mx-auto w-[70%] max-w-[8px] ${
                              up ? 'bg-emerald-500' : 'bg-red-500'
                            }`}
                            style={{
                              bottom: `${bodyBottom}%`,
                              height: `${Math.max(1, bodyTop - bodyBottom)}%`,
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {!selected && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-10 text-center text-white/40 text-sm">
              Search any token above — by <strong className="text-white/60">name</strong>,{' '}
              <strong className="text-white/60">symbol</strong>, or{' '}
              <strong className="text-white/60">mint address</strong> — to open its chart.
            </div>
          )}

          <p className="text-xs text-white/30 text-center">
            Charts are informational only. Not financial advice. Trading involves risk of loss.
          </p>
        </div>
      </main>
    </div>
  );
}
