'use client';

import { useState, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import type { DashboardStats, WalletInfo } from '@/types';
import TrialModal from '@/components/TrialModal';

// Slight upward bias to simulate realistic trending PnL in demo mode
const UPWARD_BIAS_FACTOR = 0.48;

const MOCK_STATS: DashboardStats = {
  pnl24h: 3847.5,
  pnl24hPercent: 12.4,
  winRate: 73.2,
  activePositions: 4,
  totalTrades: 247,
  bestTrade: 2340.0,
  worstTrade: -420.0,
  sharpeRatio: 2.14,
};

const MOCK_WALLET: WalletInfo = {
  address: '9xQeKq...Mop7',
  solBalance: 42.7,
  usdtBalance: 18420.0,
  connected: true,
};

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  positive?: boolean;
  neutral?: boolean;
  icon: string;
}

function StatCard({ label, value, sub, positive, neutral, icon }: StatCardProps) {
  const valueColor = neutral
    ? 'text-trading-blue'
    : positive
    ? 'text-trading-green'
    : 'text-trading-red';

  return (
    <div className="trading-card p-4 flex flex-col gap-2 hover:border-trading-border/80 transition-all duration-200">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500 uppercase tracking-wider font-medium">
          {label}
        </span>
        <span className="text-lg">{icon}</span>
      </div>
      <div className={`text-2xl font-bold font-mono ${valueColor}`}>{value}</div>
      {sub && <div className="text-xs text-gray-500">{sub}</div>}
    </div>
  );
}

interface QuickActionProps {
  icon: string;
  label: string;
  description: string;
  color: string;
  onClick: () => void;
}

function QuickAction({ icon, label, description, color, onClick }: QuickActionProps) {
  return (
    <button
      onClick={onClick}
      className={`trading-card p-4 text-left hover:bg-trading-surface transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] border ${color} group`}
    >
      <div className="text-2xl mb-2">{icon}</div>
      <div className="font-semibold text-sm group-hover:text-white transition-colors">
        {label}
      </div>
      <div className="text-xs text-gray-500 mt-1">{description}</div>
    </button>
  );
}

interface DashboardProps {
  onNavigate: (tab: string) => void;
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const [stats, setStats] = useState<DashboardStats>(MOCK_STATS);
  const [walletInfo, setWalletInfo] = useState<WalletInfo>(MOCK_WALLET);
  const [isLive, setIsLive] = useState(true);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [isTrialModalOpen, setIsTrialModalOpen] = useState(false);

  // Real wallet integration
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();

  // Sync real wallet data when connected
  useEffect(() => {
    if (!connected || !publicKey) {
      setWalletInfo(MOCK_WALLET);
      return;
    }

    const addr = publicKey.toBase58();
    setWalletInfo({
      address: `${addr.slice(0, 4)}…${addr.slice(-4)}`,
      solBalance: 0,
      usdtBalance: 0,
      connected: true,
    });

    // Fetch real SOL balance
    connection.getBalance(publicKey).then((lamports) => {
      setWalletInfo((prev) => ({
        ...prev,
        solBalance: lamports / LAMPORTS_PER_SOL,
      }));
    }).catch(() => {
      // keep zero balance on error
    });
  }, [connected, publicKey, connection]);

  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(new Date().toLocaleTimeString('en-US', { hour12: false }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Simulate real-time PnL fluctuation
  useEffect(() => {
    const interval = setInterval(() => {
      setStats((prev) => ({
        ...prev,
        pnl24h: prev.pnl24h + (Math.random() - UPWARD_BIAS_FACTOR) * 50,
        activePositions: Math.max(
          1,
          prev.activePositions + (Math.random() > 0.8 ? (Math.random() > 0.5 ? 1 : -1) : 0)
        ),
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const formatUsd = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header / Welcome */}
      <div className="trading-card p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-trading-green/5 via-transparent to-trading-blue/5 pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-3 h-3 rounded-full bg-trading-green status-dot-live" />
              <span className="text-xs text-gray-400 font-mono uppercase tracking-widest">
                {isLive ? 'LIVE TRADING' : 'PAUSED'}
              </span>
              <span className="text-xs text-gray-600 font-mono">{currentTime} UTC</span>
            </div>
            <h1 className="text-3xl font-bold gradient-text-green">Cletus</h1>
            <p className="text-gray-400 text-sm mt-1">
              AI Autonomous Trader · Solana · v2.1.0
            </p>
          </div>

          <div className="flex flex-col items-start sm:items-end gap-2">
            <div className="flex items-center gap-2 text-sm">
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-trading-green status-dot-live' : 'bg-gray-600'}`} />
              <span className="text-gray-300 font-mono text-xs">{walletInfo.address}</span>
              {connected && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-trading-green/20 text-trading-green border border-trading-green/30 font-semibold">
                  LIVE
                </span>
              )}
            </div>
            <div className="flex gap-3 text-xs font-mono">
              <span className="text-gray-400">
                <span className="text-white font-semibold">{walletInfo.solBalance.toFixed(connected ? 4 : 2)}</span> SOL
              </span>
              {!connected && (
                <span className="text-gray-400">
                  <span className="text-white font-semibold">
                    ${walletInfo.usdtBalance.toLocaleString()}
                  </span>{' '}
                  USDT
                </span>
              )}
            </div>
            {connected ? (
              <div className="text-xs text-trading-green/70 font-mono">Wallet connected · Simulation ready</div>
            ) : (
              <button
                onClick={() => setIsLive((v) => !v)}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                  isLive
                    ? 'bg-trading-red/20 text-trading-red border border-trading-red/40 hover:bg-trading-red/30'
                    : 'bg-trading-green/20 text-trading-green border border-trading-green/40 hover:bg-trading-green/30'
                }`}
              >
                {isLive ? '⏸ Pause Trading' : '▶ Resume Trading'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Free Trial Banner */}
      <div className="trading-card p-4 bg-gradient-to-r from-emerald-500/10 to-transparent border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider font-mono">
            🎁 Limited Time Offer
          </h3>
          <p className="text-xs text-gray-300 mt-1">
            Unlock premium features with our 30-Day Free Trial. No CLETUS staking required during the trial.
          </p>
        </div>
        <button
          onClick={() => setIsTrialModalOpen(true)}
          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 transition-colors text-black text-xs font-semibold rounded-xl shrink-0"
        >
          Claim Trial
        </button>
      </div>

      {/* Stats Grid */}
      <div>
        <h2 className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-3">
          24h Performance
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="24h PnL"
            value={formatUsd(stats.pnl24h)}
            sub={`${stats.pnl24h >= 0 ? '+' : ''}${stats.pnl24hPercent.toFixed(1)}%`}
            positive={stats.pnl24h >= 0}
            icon="💰"
          />
          <StatCard
            label="Win Rate"
            value={`${stats.winRate.toFixed(1)}%`}
            sub={`${stats.totalTrades} total trades`}
            positive={stats.winRate > 60}
            icon="🎯"
          />
          <StatCard
            label="Active Positions"
            value={stats.activePositions.toString()}
            sub="currently open"
            neutral
            icon="📊"
          />
          <StatCard
            label="Sharpe Ratio"
            value={stats.sharpeRatio.toFixed(2)}
            sub="risk-adjusted return"
            positive={stats.sharpeRatio > 1}
            icon="⚡"
          />
        </div>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Best Trade"
          value={formatUsd(stats.bestTrade)}
          positive
          icon="🚀"
        />
        <StatCard
          label="Worst Trade"
          value={formatUsd(stats.worstTrade)}
          positive={false}
          icon="📉"
        />
        <StatCard
          label="Total Trades"
          value={stats.totalTrades.toString()}
          sub="all time"
          neutral
          icon="🔢"
        />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-3">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <QuickAction
            icon="📈"
            label="Start Trading"
            description="Launch AI trading engine"
            color="hover:border-trading-green/50"
            onClick={() => onNavigate('chart')}
          />
          <QuickAction
            icon="⚡"
            label="View Signals"
            description="Active trading opportunities"
            color="hover:border-trading-yellow/50"
            onClick={() => onNavigate('signals')}
          />
          <QuickAction
            icon="🤖"
            label="Ask Cletus"
            description="AI trading intelligence"
            color="hover:border-trading-blue/50"
            onClick={() => onNavigate('ai')}
          />
        </div>
      </div>

      {/* System Status */}
      <div className="trading-card p-4">
        <h2 className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-3">
          System Status
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Solana RPC', status: 'Operational', ok: true },
            { label: 'Gemini AI', status: 'Connected', ok: true },
            { label: 'Signal Engine', status: 'Active', ok: true },
            { label: 'Risk Manager', status: 'Monitoring', ok: true },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full status-dot-live ${
                  item.ok ? 'bg-trading-green' : 'bg-trading-red'
                }`}
              />
              <div>
                <div className="text-xs font-medium text-gray-300">{item.label}</div>
                <div
                  className={`text-xs ${item.ok ? 'text-trading-green' : 'text-trading-red'}`}
                >
                  {item.status}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="trading-card p-3 border-trading-yellow/30">
        <p className="text-xs text-gray-500 leading-relaxed">
          ⚠️{' '}
          <span className="text-trading-yellow font-medium">Disclaimer:</span> Cletus is an AI
          trading system. Past performance does not guarantee future results. All trading
          involves significant risk. Never invest more than you can afford to lose. This is not
          financial advice.
        </p>
      </div>

      <TrialModal open={isTrialModalOpen} onClose={() => setIsTrialModalOpen(false)} />
    </div>
  );
}
