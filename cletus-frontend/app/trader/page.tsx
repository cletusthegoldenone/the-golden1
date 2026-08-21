'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Dashboard from '@/components/Dashboard';
import CandlestickChart from '@/components/CandlestickChart';
import TradingSignals from '@/components/TradingSignals';
import AIBrainChat from '@/components/AIBrainChat';
import CommunityChat from '@/components/CommunityChat';
import DevWalletInspector from '@/components/DevWalletInspector';
import TradingConfig from '@/components/TradingConfig';
import SimulationDashboard from '@/components/SimulationDashboard';
import ConnectWalletButton from '@/components/ConnectWalletButton';
import GeminiLiveChat from '@/components/GeminiLiveChat';
import InvestorRelations from '@/components/InvestorRelations';

type Tab = 'dashboard' | 'chart' | 'signals' | 'ai' | 'gemini' | 'simulate' | 'config' | 'community' | 'investor' | 'inspect';

const VALID_TABS: Tab[] = ['dashboard', 'chart', 'signals', 'ai', 'gemini', 'simulate', 'config', 'community', 'investor', 'inspect'];

const AI_MODEL_LABEL = process.env.NEXT_PUBLIC_AI_MODEL_LABEL ?? 'Gemini AI';

const TABS: { id: Tab; label: string; icon: string; badge?: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'chart', label: 'Chart', icon: '📈' },
  { id: 'signals', label: 'Signals', icon: '⚡', badge: 'LIVE' },
  { id: 'ai', label: 'Cletus AI', icon: '🤖' },
  { id: 'gemini', label: 'Gemini Live', icon: '💬', badge: 'NEW' },
  { id: 'simulate', label: 'Simulate', icon: '🎮', badge: 'BETA' },
  { id: 'config', label: 'Config', icon: '⚙️' },
  { id: 'community', label: 'Community', icon: '🪿' },
  { id: 'investor', label: 'Investor', icon: '💼' },
  { id: 'inspect', label: 'Dev Wallet', icon: '🔍' },
];

// Inner component that reads search params (must be wrapped in Suspense)
function TraderInner() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') as Tab | null;
  const initialTab: Tab = tabParam && VALID_TABS.includes(tabParam) ? tabParam : 'dashboard';
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  useEffect(() => {
    const tab = searchParams.get('tab') as Tab | null;
    if (tab && VALID_TABS.includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-trading-bg text-white">
      {/* Top Header */}
      <header className="border-b border-trading-border bg-trading-bg/95 backdrop-blur-lg sticky top-0 z-50">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 md:px-8">
          <div className="h-14 flex items-center justify-between gap-4">
            {/* Logo */}
            <div className="flex items-center gap-x-2.5 shrink-0">
              <div className="w-8 h-8 bg-trading-green rounded-xl flex items-center justify-center text-xl">
                🪿
              </div>
              <div className="flex items-baseline gap-x-1">
                <span className="font-bold text-lg tracking-tight">Cletus</span>
                <span className="text-trading-green text-[10px] font-mono tracking-[3px]">PRO</span>
              </div>
              <span className="text-xs text-gray-600 hidden sm:block">Autonomous Trader</span>
            </div>

            {/* Live status */}
            <div className="hidden md:flex items-center gap-x-3 text-xs flex-1 justify-center">
              <div className="flex items-center gap-x-1.5 text-trading-green">
                <div className="w-2 h-2 rounded-full bg-trading-green status-dot-live" />
                <span className="font-mono">LIVE</span>
              </div>
              <span className="text-gray-600">|</span>
              <span className="text-gray-400 font-mono">Solana Mainnet</span>
              <span className="text-gray-600">|</span>
              <span className="text-gray-400 font-mono">AI: {AI_MODEL_LABEL}</span>
            </div>

            {/* Right: wallet + home */}
            <div className="flex items-center gap-x-2 shrink-0">
              <ConnectWalletButton />
              <Link
                href="/"
                className="text-xs text-gray-500 hover:text-white transition-colors flex items-center gap-x-1.5 px-3 py-1.5 rounded-lg border border-trading-border hover:border-trading-border/80 hidden sm:flex"
              >
                <span>←</span>
                <span>Home</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="border-b border-trading-border bg-trading-surface sticky top-14 z-40">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 md:px-8">
          <div className="flex overflow-x-auto scrollbar-hide">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-x-1.5 px-4 sm:px-5 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-all duration-150 ${
                  activeTab === tab.id
                    ? 'border-trading-green text-trading-green'
                    : 'border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-600'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className={`ml-0.5 px-1.5 py-0.5 text-xs rounded-full font-mono ${
                    tab.badge === 'BETA'
                      ? 'bg-trading-purple/20 text-trading-purple'
                      : 'bg-trading-green/20 text-trading-green'
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 md:px-8 py-6">
        {activeTab === 'dashboard' && (
          <Dashboard onNavigate={(tab) => setActiveTab(tab as Tab)} />
        )}
        {activeTab === 'chart' && <CandlestickChart />}
        {activeTab === 'signals' && <TradingSignals />}
        {activeTab === 'ai' && <AIBrainChat />}
        {activeTab === 'gemini' && <GeminiLiveChat />}
        {activeTab === 'simulate' && <SimulationDashboard />}
        {activeTab === 'config' && <TradingConfig />}
        {activeTab === 'community' && <CommunityChat />}
        {activeTab === 'investor' && <InvestorRelations />}
        {activeTab === 'inspect' && <DevWalletInspector />}
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 border-t border-trading-border bg-trading-surface z-50">
        <div className="flex overflow-x-auto scrollbar-hide">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center gap-y-0.5 py-2 text-[10px] transition-colors min-w-[48px] ${
                activeTab === tab.id ? 'text-trading-green' : 'text-gray-600'
              }`}
            >
              <span className="text-base leading-none">{tab.icon}</span>
              <span className="font-medium leading-none">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Mobile bottom padding */}
      <div className="md:hidden h-16" />
    </div>
  );
}

export default function TraderPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-trading-bg text-white flex items-center justify-center text-gray-500">Loading…</div>}>
      <TraderInner />
    </Suspense>
  );
}

