'use client';

import { useSimulation, TRADING_FEE_DISTRIBUTION, FEE_DISTRIBUTION_WALLETS } from '@/context/SimulationContext';

function formatUsd(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatPercent(n: number): string {
  return `${(n * 100).toFixed(0)}%`;
}

export default function FeeDistributionPanel() {
  const { stats } = useSimulation();
  const { feeDistribution } = stats;

  const distributions = [
    {
      label: 'Developer',
      percent: TRADING_FEE_DISTRIBUTION.DEVELOPER,
      amount: feeDistribution.totalDeveloper,
      wallet: FEE_DISTRIBUTION_WALLETS.DEVELOPER,
      color: 'text-trading-blue',
      bgColor: 'bg-trading-blue/20',
      borderColor: 'border-trading-blue/40',
      icon: '👨‍💻',
      description: 'Platform development & maintenance',
    },
    {
      label: 'Staking Rewards',
      percent: TRADING_FEE_DISTRIBUTION.STAKING_REWARDS,
      amount: feeDistribution.totalStakingRewards,
      wallet: FEE_DISTRIBUTION_WALLETS.STAKING_REWARDS,
      color: 'text-trading-green',
      bgColor: 'bg-trading-green/20',
      borderColor: 'border-trading-green/40',
      icon: '💰',
      description: 'SOL rewards for CLETUS stakers',
    },
    {
      label: 'Future Upgrades',
      percent: TRADING_FEE_DISTRIBUTION.FUTURE_UPGRADES,
      amount: feeDistribution.totalFutureUpgrades,
      wallet: FEE_DISTRIBUTION_WALLETS.FUTURE_UPGRADES,
      color: 'text-trading-purple',
      bgColor: 'bg-trading-purple/20',
      borderColor: 'border-trading-purple/40',
      icon: '🚀',
      description: 'New features & infrastructure',
    },
    {
      label: 'Digital Bank Fund',
      percent: TRADING_FEE_DISTRIBUTION.DIGITAL_BANK,
      amount: feeDistribution.totalDigitalBank,
      wallet: FEE_DISTRIBUTION_WALLETS.DIGITAL_BANK,
      color: 'text-trading-yellow',
      bgColor: 'bg-trading-yellow/20',
      borderColor: 'border-trading-yellow/40',
      icon: '🏦',
      description: 'Future DeFi banking services',
    },
  ];

  return (
    <div className="trading-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-white mb-1">Fee Distribution</h3>
          <p className="text-xs text-gray-500">
            1% fee per trade split across platform development, staker rewards, upgrades & banking
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">Total Collected</div>
          <div className="text-2xl font-bold font-mono text-trading-yellow">
            {formatUsd(feeDistribution.totalFeesCollected)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        {distributions.map((dist) => (
          <div
            key={dist.label}
            className={`p-4 rounded-lg border ${dist.bgColor} ${dist.borderColor} transition-all hover:scale-[1.02]`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">{dist.icon}</span>
                <div>
                  <div className={`text-sm font-semibold ${dist.color}`}>{dist.label}</div>
                  <div className="text-xs text-gray-500">{dist.description}</div>
                </div>
              </div>
              <div className={`text-xs px-2 py-1 rounded font-semibold ${dist.bgColor} ${dist.color}`}>
                {formatPercent(dist.percent)}
              </div>
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-trading-border/30">
              <div className="text-xs text-gray-500 uppercase tracking-wider">Distributed</div>
              <div className={`text-lg font-bold font-mono ${dist.color}`}>
                {formatUsd(dist.amount)}
              </div>
            </div>
            <div className="mt-2 text-xs font-mono break-all">
              {dist.wallet === 'GJwtCupMcNGbhGX1vapg2ueK2pedx2tgMkzGjhugnxaA' && dist.label !== 'Developer' ? (
                <span className="text-trading-yellow">⚠ Temp: dev wallet — update before mainnet</span>
              ) : (
                <span className="text-gray-600">{dist.wallet}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Verification info */}
      <div className="p-3 rounded-lg bg-trading-surface border border-trading-border/50">
        <div className="flex items-start gap-3">
          <span className="text-xl">🔍</span>
          <div>
            <div className="text-xs font-semibold text-gray-400 mb-1">On-Chain Verification</div>
            <p className="text-xs text-gray-600 leading-relaxed">
              All fee distributions are executed on-chain and can be verified using{' '}
              <a
                href="https://explorer.solana.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-trading-blue hover:underline"
              >
                Solana Explorer
              </a>
              {' '}or{' '}
              <a
                href="https://solscan.io"
                target="_blank"
                rel="noopener noreferrer"
                className="text-trading-blue hover:underline"
              >
                Solscan
              </a>
              . See{' '}
              <a
                href="/FEE_DISTRIBUTION.md"
                className="text-trading-blue hover:underline"
              >
                FEE_DISTRIBUTION.md
              </a>
              {' '}for complete details.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
