'use client';

import { useState } from 'react';
import type { TierInfo } from '@/types';

const TIERS: TierInfo[] = [
  { name: 'Starter', minStake: 100_000, monthlyTradingLimit: 500, color: '#6b7280', icon: '🌱' },
  { name: 'Bronze', minStake: 500_000, monthlyTradingLimit: 1000, color: '#b45309', icon: '🥉' },
  { name: 'Silver', minStake: 1_000_000, monthlyTradingLimit: 2000, color: '#9ca3af', icon: '🥈' },
  { name: 'Gold', minStake: 5_000_000, monthlyTradingLimit: 5000, color: '#f59e0b', icon: '🥇' },
  { name: 'Platinum', minStake: 10_000_000, monthlyTradingLimit: 15000, color: '#22d3ee', icon: '💠' },
  { name: 'Diamond', minStake: 25_000_000, monthlyTradingLimit: 50000, color: '#60a5fa', icon: '💎' },
  { name: 'Founder', minStake: 100_000_000, monthlyTradingLimit: 0, color: '#c084fc', icon: '👑' },
];


function TierCard({
  tier,
  isActive,
  isNext,
}: {
  tier: TierInfo;
  isActive: boolean;
  isNext: boolean;
}) {
  return (
    <div
      className={`trading-card p-3 transition-all duration-200 ${
        isActive
          ? 'border-2 glow-green'
          : isNext
          ? 'border-dashed opacity-80'
          : '' // All tiers shown at full opacity in preview mode — no tier is currently active
      }`}
      style={isActive ? { borderColor: tier.color, boxShadow: `0 0 20px ${tier.color}20` } : {}}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-lg">{tier.icon}</span>
        {isActive && (
          <span className="text-xs px-1.5 py-0.5 rounded-full font-bold"
            style={{ background: `${tier.color}20`, color: tier.color }}>
            ACTIVE
          </span>
        )}
        {isNext && (
          <span className="text-xs px-1.5 py-0.5 rounded-full font-bold bg-gray-700 text-gray-400">
            NEXT
          </span>
        )}
      </div>
      <div className="font-bold text-sm" style={{ color: isActive ? tier.color : undefined }}>
        {tier.name}
      </div>
      <div className="text-xs text-gray-500 mt-1">
        {(tier.minStake / 1e6).toFixed(1)}M CLETUS
      </div>
      <div className="text-xs mt-1" style={{ color: tier.color }}>
        {tier.monthlyTradingLimit > 0
          ? `$${tier.monthlyTradingLimit.toLocaleString()} / mo trading limit`
          : 'Unlimited trading limit'}
      </div>
    </div>
  );
}

export default function StakingDashboard() {
  const [stakeAmount, setStakeAmount] = useState('');

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Coming Soon Banner */}
      <div className="trading-card p-5 border-trading-yellow/40 bg-trading-yellow/5">
        <div className="flex items-start gap-3">
          <span className="text-2xl shrink-0">🚀</span>
          <div>
            <div className="font-bold text-trading-yellow text-base">$CLETUS Token — Launching Soon</div>
            <p className="text-sm text-gray-400 mt-1">
              The $CLETUS token has not yet been deployed on Solana. Staking will go live
              the moment the token launches. The tier structure, APY rates, and profit-sharing
              percentages shown below are the confirmed parameters for launch.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="text-xs px-3 py-1 rounded-full bg-trading-yellow/10 text-trading-yellow border border-trading-yellow/30 font-medium">
                ⏳ Token not yet deployed
              </span>
              <span className="text-xs px-3 py-1 rounded-full bg-trading-surface border border-trading-border text-gray-400">
                Staking contract: pending deployment
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tier Preview */}
      <div className="trading-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold text-lg">Staking Tiers — Preview</h2>
            <p className="text-sm text-gray-400">Stake $CLETUS to unlock your monthly platform trading limit</p>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-trading-purple/20 text-trading-purple border border-trading-purple/30 font-mono">
            PREVIEW
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {TIERS.map((tier) => (
            <TierCard key={tier.name} tier={tier} isActive={false} isNext={false} />
          ))}
        </div>
      </div>

      {/* Stake Form — disabled until launch */}
      <div className="trading-card p-5 opacity-60">
        <h3 className="font-bold text-sm mb-3 text-gray-400 uppercase tracking-wider">Stake $CLETUS</h3>
        <div className="flex gap-2">
          <input
            type="number"
            value={stakeAmount}
            onChange={(e) => setStakeAmount(e.target.value)}
            placeholder="Amount of CLETUS to stake"
            disabled
            className="flex-1 bg-trading-surface border border-trading-border rounded-xl px-4 py-2.5 text-sm text-gray-600 placeholder-gray-700 cursor-not-allowed font-mono"
          />
          <button
            disabled
            className="px-5 py-2.5 rounded-xl bg-trading-surface border border-trading-border text-gray-600 font-bold text-sm cursor-not-allowed shrink-0"
          >
            Launching Soon
          </button>
        </div>
        <p className="text-xs text-gray-600 mt-2">
          Staking is disabled until the $CLETUS token is deployed on Solana mainnet.
        </p>
      </div>

      {/* How it works */}
      <div className="trading-card p-5">
        <h3 className="font-bold text-sm mb-4 text-gray-400 uppercase tracking-wider">How Staking Will Work</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              icon: '🪙',
              title: 'Acquire $CLETUS',
              desc: 'Buy $CLETUS tokens on Raydium once the token launches. No minimum for holding, minimum stake varies by tier.',
            },
            {
              icon: '🔒',
              title: 'Stake Your Tokens',
              desc: 'Lock your $CLETUS in the staking contract. Your tokens stay in your control — unstake anytime after the 7-day cooldown.',
            },
            {
              icon: '📊',
              title: 'Unlock Your Tier',
              desc: 'Your staked amount determines your monthly platform trading limit — the maximum Cletus can trade on your behalf each month.',
            },
          ].map((step) => (
            <div key={step.title} className="flex gap-3">
              <span className="text-2xl shrink-0">{step.icon}</span>
              <div>
                <div className="font-semibold text-sm text-white">{step.title}</div>
                <div className="text-xs text-gray-500 mt-1">{step.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fee distribution reminder */}
      <div className="trading-card p-4 border-trading-border/50">
        <p className="text-xs text-gray-500">
          💡 Every trade closed on Cletus generates a 1% fee distributed as follows:
          20% to development, 25% to platform access pool, 30% to platform upgrades, 25% to digital bank fund.
          Staking does not pay SOL rewards or profit share — it unlocks your monthly trading limit tier.
        </p>
      </div>
    </div>
  );
}
