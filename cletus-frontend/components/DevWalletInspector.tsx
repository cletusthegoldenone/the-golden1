'use client';

import { useState, useCallback } from 'react';

interface WalletAnalysis {
  address: string;
  isKnownRugger: boolean;
  rugCount: number;
  riskScore: number;
  riskLabel: string;
  riskColor: string;
  solBalance: number;
  tokenHoldings: TokenHolding[];
  recentActivity: ActivityItem[];
  flags: string[];
  rugHistory: RugEvent[];
  firstSeen: string;
  totalVolume: string;
  rugcheckScore?: number;
  isLive?: boolean;
}

interface TokenHolding {
  symbol: string;
  name: string;
  mint?: string;
  amount: string;
  valueUsd: string;
  percentOfSupply: string;
  suspicious: boolean;
  rugcheckScore?: number;
  rugcheckRisks?: string[];
  rugged?: boolean;
}

interface ActivityItem {
  type: 'sell' | 'buy' | 'transfer' | 'launch';
  description: string;
  amount: string;
  time: string;
  flagged: boolean;
  signature?: string;
}

interface RugEvent {
  token: string;
  date: string;
  lossUsd: string;
  evidence: string;
}

function RiskMeter({ score }: { score: number }) {
  const color = score >= 80 ? '#ff4757' : score >= 55 ? '#ffd43b' : '#00d4aa';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-500">Risk Score</span>
        <span className="font-mono font-bold" style={{ color }}>{score}/100</span>
      </div>
      <div className="h-2.5 bg-trading-surface rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${score}%`, background: color }}
        />
      </div>
    </div>
  );
}

export default function DevWalletInspector() {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<WalletAnalysis | null>(null);
  const [error, setError] = useState('');

  const inspect = useCallback(async (addr: string) => {
    const trimmed = addr.trim();
    if (!trimmed) return;
    if (trimmed.length < 32) {
      setError('Enter a valid Solana wallet address (32–44 characters).');
      return;
    }
    setError('');
    setIsLoading(true);
    setResult(null);

    try {
      const res = await fetch(`/api/wallet/${encodeURIComponent(trimmed)}`);
      const data = await res.json() as WalletAnalysis & { error?: string };
      if (!res.ok || data.error) {
        setError(data.error ?? 'Failed to fetch wallet data. Please try again.');
      } else {
        setResult(data);
      }
    } catch {
      setError('Network error — check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    inspect(query);
  };

  // Real Solana mainnet wallets for demonstration
  const EXAMPLE_ADDRESSES = [
    { label: '🪿 Cletus Dev', addr: 'GJwtCupMcNGbhGX1vapg2ueK2pedx2tgMkzGjhugnxaA' },
    { label: '🏦 Binance Hot', addr: '5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9' },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="trading-card p-4">
        <div className="flex items-start gap-3">
          <div className="text-3xl shrink-0">🔍</div>
          <div>
            <h2 className="font-bold text-lg">Dev Wallet Inspector</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              Inspect any Solana wallet. Fetches live data from Solana mainnet — real SOL balance,
              token holdings, and transaction history.
            </p>
          </div>
        </div>

        {/* Search */}
        <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Paste wallet or token address…"
            className="flex-1 bg-trading-surface border border-trading-border rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-trading-green font-mono transition-colors"
          />
          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="px-5 py-2.5 rounded-xl bg-trading-green text-black font-bold text-sm hover:bg-trading-green/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] shrink-0"
          >
            {isLoading ? '⏳' : 'Inspect'}
          </button>
        </form>

        {error && <p className="mt-2 text-xs text-trading-red">{error}</p>}

        {/* Example addresses */}
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="text-xs text-gray-600">Try:</span>
          {EXAMPLE_ADDRESSES.map((ex) => (
            <button
              key={ex.addr}
              onClick={() => { setQuery(ex.addr); inspect(ex.addr); }}
              className="text-xs px-3 py-1 bg-trading-surface border border-trading-border rounded-full hover:border-trading-green/50 hover:text-white transition-all text-gray-400"
            >
              {ex.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="trading-card p-8 text-center">
          <div className="text-3xl mb-3 animate-bounce">🔍</div>
          <div className="text-sm text-gray-400">Querying Solana mainnet…</div>
          <div className="text-xs text-gray-600 mt-1">Fetching balance · Token accounts · Transaction history</div>
        </div>
      )}

      {/* Results */}
      {result && !isLoading && (
        <div className="space-y-4">
          {/* Risk Overview */}
          <div className={`trading-card p-5 ${result.isKnownRugger ? 'border-trading-red/60' : ''}`}>
            {result.isKnownRugger && (
              <div className="bg-trading-red/10 border border-trading-red/40 rounded-lg p-3 mb-4 flex items-center gap-2">
                <span className="text-xl">🚨</span>
                <div>
                  <div className="font-bold text-trading-red">KNOWN RUGGER — DO NOT INTERACT</div>
                  <div className="text-xs text-trading-red/80 mt-0.5">
                    {result.rugCount} confirmed rug pulls · In Cletus rug database
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 space-y-3">
                <div>
                  <div className="text-xs text-gray-500 mb-0.5">Address</div>
                  <div className="font-mono text-xs text-white/70 break-all">{result.address}</div>
                </div>
                <RiskMeter score={result.riskScore} />
                <div className={`text-lg font-bold ${result.riskColor}`}>{result.riskLabel}</div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-1 gap-3 sm:w-44">
                {result.rugcheckScore !== undefined && (
                  <div className="bg-trading-surface rounded-lg p-3 text-center">
                    <div className="text-xs text-gray-500">Rugcheck Score</div>
                    <div className={`text-xl font-bold font-mono mt-1 ${result.rugcheckScore >= 70 ? 'text-trading-green' : result.rugcheckScore >= 40 ? 'text-trading-yellow' : 'text-trading-red'}`}>
                      {result.rugcheckScore}/100
                    </div>
                  </div>
                )}
                <div className="bg-trading-surface rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-500">SOL Balance</div>
                  <div className="text-xl font-bold font-mono mt-1 text-white">{result.solBalance}</div>
                </div>
                <div className="bg-trading-surface rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-500">First Seen</div>
                  <div className="text-sm font-mono mt-1 text-gray-300">{result.firstSeen}</div>
                </div>
                <div className="bg-trading-surface rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-500">Total Volume</div>
                  <div className="text-sm font-mono mt-1 text-white">{result.totalVolume}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Flags */}
          {result.flags.length > 0 && (
            <div className="trading-card p-4">
              <div className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-3">
                Intelligence Flags
              </div>
              <div className="space-y-1.5">
                {result.flags.map((flag, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className={`shrink-0 ${result.isKnownRugger || result.riskScore >= 80 ? 'text-trading-red' : result.riskScore >= 55 ? 'text-trading-yellow' : 'text-trading-green'}`}>
                      {result.isKnownRugger || result.riskScore >= 80 ? '🚩' : result.riskScore >= 55 ? '⚠️' : '✅'}
                    </span>
                    <span className="text-gray-300">{flag}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rug History */}
          {result.rugHistory.length > 0 && (
            <div className="trading-card p-4 border-trading-red/30">
              <div className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-3">
                🚨 Confirmed Rug Pull History
              </div>
              <div className="space-y-2">
                {result.rugHistory.map((rug, i) => (
                  <div key={i} className="bg-trading-red/10 border border-trading-red/20 rounded-lg p-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-trading-red">{rug.token}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{rug.evidence}</div>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <div className="font-mono font-bold text-trading-red">{rug.lossUsd}</div>
                        <div className="text-xs text-gray-500">{rug.date}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Token Holdings */}
          {result.tokenHoldings.length > 0 && (
            <div className="trading-card p-4">
              <div className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-3">
                Token Holdings
              </div>
              <div className="space-y-2">
                {result.tokenHoldings.map((h, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-3 p-3 rounded-lg ${
                      h.rugged
                        ? 'bg-trading-red/15 border border-trading-red/40'
                        : h.suspicious
                        ? 'bg-trading-red/10 border border-trading-red/20'
                        : 'bg-trading-surface'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-trading-surface border border-trading-border flex items-center justify-center text-xs font-bold shrink-0">
                      {h.symbol.replace('$', '').slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center flex-wrap gap-1.5">
                        <span className="font-semibold text-sm">{h.symbol}</span>
                        {h.rugged && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-trading-red/30 text-trading-red rounded-full font-bold">
                            🚨 RUGGED
                          </span>
                        )}
                        {!h.rugged && h.suspicious && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-trading-red/20 text-trading-red rounded-full font-semibold">
                            HIGH RISK
                          </span>
                        )}
                        {h.rugcheckScore !== undefined && !h.rugged && !h.suspicious && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                            h.rugcheckScore <= 30
                              ? 'bg-trading-green/20 text-trading-green'
                              : h.rugcheckScore <= 60
                              ? 'bg-trading-yellow/20 text-trading-yellow'
                              : 'bg-trading-red/20 text-trading-red'
                          }`}>
                            RC {h.rugcheckScore}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">{h.name}</div>
                      {h.rugcheckRisks && h.rugcheckRisks.length > 0 && (
                        <div className="text-[10px] text-trading-yellow mt-0.5">
                          {h.rugcheckRisks.join(' · ')}
                        </div>
                      )}
                    </div>
                    <div className="text-right text-sm shrink-0">
                      <div className="font-mono text-xs text-gray-400">{h.amount}</div>
                      {h.rugcheckScore !== undefined && (
                        <div className={`text-xs font-mono font-bold ${
                          h.rugcheckScore <= 30
                            ? 'text-trading-green'
                            : h.rugcheckScore <= 60
                            ? 'text-trading-yellow'
                            : 'text-trading-red'
                        }`}>
                          {h.rugged ? '☠ DEAD' : `RC: ${h.rugcheckScore}`}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Activity */}
          {result.recentActivity.length > 0 && (
            <div className="trading-card p-4">
              <div className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-3">
                Recent On-Chain Activity
              </div>
              <div className="space-y-2">
                {result.recentActivity.map((act, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-3 p-3 rounded-lg ${
                      act.flagged ? 'bg-trading-red/10 border border-trading-red/20' : 'bg-trading-surface'
                    }`}
                  >
                    <span className="text-lg shrink-0">
                      {act.type === 'buy' ? '🟢' : act.type === 'sell' ? '🔴' : act.type === 'launch' ? '🚀' : '↗️'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-300">{act.description}</div>
                      <div className="text-xs text-gray-500">{act.time}</div>
                    </div>
                    <div className="text-right shrink-0">
                      {act.signature ? (
                        <a
                          href={`https://solscan.io/tx/${act.signature}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-xs text-trading-blue hover:underline"
                        >
                          {act.amount}
                        </a>
                      ) : (
                        <div className="font-mono text-sm text-white">{act.amount}</div>
                      )}
                      {act.flagged && (
                        <span className="text-[10px] text-trading-red font-semibold">⚠️ FLAGGED</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Powered by */}
          <div className="trading-card p-3 border-trading-border/50">
            <p className="text-xs text-gray-500">
              🔗 Live data from{' '}
              <a
                href={`https://solscan.io/account/${result.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white font-medium hover:underline"
              >
                Solana mainnet
              </a>
              {' '}via JSON-RPC. Token metadata from Jupiter verified list.
              {result.tokenHoldings.some((h) => h.rugcheckScore !== undefined) && (
                <> Token risk scored by <a href="https://rugcheck.xyz" target="_blank" rel="noopener noreferrer" className="text-white font-medium hover:underline">rugcheck.xyz</a>.</>
              )}
              {' '}Risk scoring is heuristic — always verify independently before trading.
              {result.isLive && (
                <span className="ml-1 text-trading-green">● Live</span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!result && !isLoading && (
        <div className="trading-card p-10 text-center">
          <div className="text-5xl mb-4">🔍</div>
          <div className="text-lg font-semibold text-gray-300 mb-2">Inspect Any Solana Wallet</div>
          <div className="text-sm text-gray-500 max-w-sm mx-auto">
            Paste a Solana wallet address to see real SOL balance, token holdings, and
            recent transaction history — fetched live from mainnet.
          </div>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 text-left max-w-lg mx-auto">
            {[
              { icon: '💰', title: 'SOL Balance', desc: 'Live from mainnet RPC' },
              { icon: '🪙', title: 'Token Holdings', desc: 'SPL tokens + rugcheck.xyz risk scores' },
              { icon: '📊', title: 'Transaction History', desc: 'Last 25 on-chain txns' },
            ].map((item) => (
              <div key={item.title} className="bg-trading-surface rounded-xl p-3">
                <div className="text-xl mb-1">{item.icon}</div>
                <div className="text-xs font-semibold text-white">{item.title}</div>
                <div className="text-xs text-gray-500 mt-0.5">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
