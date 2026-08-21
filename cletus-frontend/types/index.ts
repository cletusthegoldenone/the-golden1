// ============================================================
// Cletus Autonomous Trader - Type Definitions
// ============================================================

export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TradingSignal {
  id: string;
  tokenName: string;
  tokenAddress: string;
  marketCap: number;
  volume24h: number;
  compositeScore: number;
  priceChange24h: number;
  currentPrice: number;
  breakdown: SignalBreakdown;
  riskReward: number;
  stopLoss: number;
  takeProfit: number;
  direction: 'LONG' | 'SHORT';
  strength: 'WEAK' | 'MODERATE' | 'STRONG' | 'EXTREME';
  timestamp: number;
}

export interface SignalBreakdown {
  volumeSpike: number;
  momentum: number;
  breakout: number;
  rsiScore: number;
  macdCross: number;
  holderGrowth: number;
  liquidityScore: number;
  socialSentiment: number;
}

export type StakingTier =
  | 'Starter'
  | 'Bronze'
  | 'Silver'
  | 'Gold'
  | 'Platinum'
  | 'Diamond'
  | 'Founder';

export interface TierInfo {
  name: StakingTier;
  minStake: number;
  /** Monthly platform trading limit unlocked by this tier (USD, 0 = unlimited) */
  monthlyTradingLimit: number;
  color: string;
  icon: string;
}

export interface StakingPosition {
  staked: number;
  tier: StakingTier;
  stakedAt: number;
  /** Reserved for future platform-utility rewards (not SOL, not profit share) */
  pendingRewards: number;
  totalEarned: number;
}

export interface DistributionRecord {
  month: string;
  /** Platform access pool allocation for this period */
  platformAccessAllocation: number;
  total: number;
  claimed: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  citations?: string[];
}

export interface DashboardStats {
  pnl24h: number;
  pnl24hPercent: number;
  winRate: number;
  activePositions: number;
  totalTrades: number;
  bestTrade: number;
  worstTrade: number;
  sharpeRatio: number;
}

export interface WalletInfo {
  address: string;
  solBalance: number;
  usdtBalance: number;
  connected: boolean;
}

export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

export interface TradeMarker {
  time: number;
  position: 'belowBar' | 'aboveBar';
  color: string;
  shape: 'arrowUp' | 'arrowDown';
  text: string;
}

// ── Simulation & Trading Config ───────────────────────────────────────────────

export type AggressionLevel = 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE' | 'MAX_RISK';

export interface TradingConfig {
  /** 24-hour time string "HH:MM" */
  startTime: string;
  /** 24-hour time string "HH:MM" */
  endTime: string;
  /** Mon=0 … Sun=6 */
  activeDays: boolean[];
  aggression: AggressionLevel;
  /** % of available balance allocated per trade */
  positionSizePercent: number;
  /** Min composite score (0–1) required to open a trade */
  signalThreshold: number;
  /** Per-trade stop loss in % of entry price */
  perTradeSL: number;
  /** Per-trade take profit in % of entry price */
  perTradeTP: number;
  /** Stop trading when daily profit hits this USD amount (0 = disabled) */
  dailyProfitTarget: number;
  /** Stop trading when daily loss hits this USD amount (0 = disabled) */
  dailyMaxLoss: number;
  /** Max number of concurrently open positions */
  maxPositions: number;
  /** Starting USD balance for the simulation */
  initialCapital: number;
}

export interface SimulatedPosition {
  id: string;
  tokenName: string;
  tokenAddress: string;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  currentPrice: number;
  stopLoss: number;
  takeProfit: number;
  /** USD reserved for this position at open */
  positionSizeUsd: number;
  /** Token quantity = positionSizeUsd / entryPrice */
  quantity: number;
  openedAt: number;
  pnlUsd: number;
  pnlPercent: number;
  status: 'OPEN' | 'CLOSED_TP' | 'CLOSED_SL' | 'CLOSED_MANUAL';
  closedAt?: number;
  closingPrice?: number;
  closingPnlUsd?: number;
  /** Platform fee charged on close (% of position size, sent to dev wallet) */
  feeUsd?: number;
  /** Distributed fee breakdown */
  feeDistribution?: FeeDistribution;
  signalScore: number;
}

/** Fee distribution breakdown for a single trade */
export interface FeeDistribution {
  /** Total fee collected (1% of position size) */
  totalFee: number;
  /** 20% to developer */
  developer: number;
  /** 25% to platform access pool (sustains staking program infrastructure) */
  platformAccess: number;
  /** 30% for future upgrades */
  futureUpgrades: number;
  /** 25% to digital bank fund */
  digitalBank: number;
}

/** Aggregated fee distribution across all trades */
export interface AggregatedFeeDistribution {
  /** Total fees collected from all trades */
  totalFeesCollected: number;
  /** Total distributed to developer wallet */
  totalDeveloper: number;
  /** Total distributed to platform access pool */
  totalPlatformAccess: number;
  /** Total distributed to future upgrades wallet */
  totalFutureUpgrades: number;
  /** Total distributed to digital bank wallet */
  totalDigitalBank: number;
}

// ── Live trading position (real/dry-run on-chain trade) ───────────────────────

export interface LivePosition {
  id: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  direction: 'LONG';
  entryPrice: number;
  entryAmountSol: number;
  tokenAmount: number;
  openedAt: number;
  signalScore: number;
  stopLoss: number;
  takeProfit: number;
  entrySignature: string;
  currentPrice: number;
  pnlUsd: number;
  signalBreakdown?: SignalBreakdown;
  isDryRun: boolean;
}

export interface ClosedLivePosition extends LivePosition {
  closedAt: number;
  exitPrice: number;
  exitSignature: string;
  realisedPnlUsd: number;
  closeReason: 'MANUAL' | 'STOP_LOSS' | 'TAKE_PROFIT' | 'KILL_SWITCH';
}
