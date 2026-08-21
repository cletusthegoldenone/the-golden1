/**
 * SEC Compliance Module — Regulatory Memory
 *
 * Encodes key U.S. Securities and Exchange Commission (SEC) regulations
 * applicable to automated algorithmic trading systems. These rules are
 * applied as pre-trade compliance checks and as knowledge context for
 * the Cletus AI Brain.
 *
 * Primary statutory and regulatory references:
 *  - Securities Act of 1933 (15 U.S.C. § 77a et seq.)
 *  - Securities Exchange Act of 1934 (15 U.S.C. § 78a et seq.)
 *  - Investment Advisers Act of 1940 (15 U.S.C. § 80b-1 et seq.)
 *  - Dodd-Frank Wall Street Reform and Consumer Protection Act (2010)
 *  - Commodity Exchange Act (7 U.S.C. § 1 et seq.)
 *  - SEC Rule 10b-5, Rule 10b5-1, Rule 15c3-5, Regulation SHO, Regulation ATS
 *  - SEC v. W.J. Howey Co., 328 U.S. 293 (1946) — Howey Test
 *
 * NOTE: The regulatory classification of individual crypto/DeFi tokens is
 * unsettled law. The checks below apply conservative standards consistent
 * with compliant algorithmic trading regardless of asset class.
 */

// ── SEC Rule Reference Library (Regulatory Memory) ───────────────────────────

export const SEC_REGULATIONS = {

  // ── Securities Exchange Act of 1934 ────────────────────────────────────────

  EXCHANGE_ACT_SECTION_9: {
    citation: 'Securities Exchange Act of 1934, § 9 (15 U.S.C. § 78i)',
    title: 'Prohibition of Market Manipulation',
    summary:
      'Prohibits any person from executing wash sales, matched orders, or any series ' +
      'of transactions designed to create a false or misleading appearance of active ' +
      'trading in a security. SEC enforcement actions have extended this principle to ' +
      'crypto assets deemed securities.',
    prohibitions: [
      'Wash trading — simultaneously buying and selling to create artificial volume',
      'Matched orders — pre-arranged buy/sell between coordinated accounts',
      'Pegging, fixing, or stabilising a price in violation of SEC rules',
      'Any series of transactions creating the appearance of active trading not ' +
        'reflecting genuine supply-and-demand activity',
    ],
    relevance: 'Cletus must not execute rapid buy-sell cycles for the same token that could ' +
      'create an artificial appearance of market activity.',
  },

  EXCHANGE_ACT_SECTION_10B_RULE_10B5: {
    citation: 'Securities Exchange Act of 1934, § 10(b) / SEC Rule 10b-5 (17 C.F.R. § 240.10b-5)',
    title: 'Anti-Fraud and Anti-Manipulation',
    summary:
      'It is unlawful for any person, in connection with the purchase or sale of any ' +
      'security, to employ any device, scheme, or artifice to defraud; make any untrue ' +
      'statement of a material fact; or engage in any act that operates as a fraud.',
    prohibitions: [
      'Employing any device, scheme, or artifice to defraud',
      'Making any untrue statement of a material fact',
      'Omitting material facts necessary to make other statements not misleading',
      'Engaging in any act, practice, or course of business constituting fraud or deceit',
    ],
    relevance: 'All signal data, trade representations, and AI responses must be accurate. ' +
      'No deceptive trading strategies may be executed.',
  },

  EXCHANGE_ACT_RULE_10B5_1: {
    citation: 'SEC Rule 10b5-1 (17 C.F.R. § 240.10b5-1)',
    title: 'Trading on the Basis of Material Non-Public Information (Insider Trading)',
    summary:
      'A trade is deemed to be "on the basis of" material non-public information (MNPI) ' +
      'if the trader was aware of MNPI at the time of trading. Pre-programmed trading ' +
      'plans based solely on public market signals provide a safe harbour from liability.',
    prohibitions: [
      'Trading while in possession of MNPI about a token or issuer',
      'Tipping MNPI to other persons who then trade',
      'Circumventing trading restrictions through derivatives or related instruments',
    ],
    safeHarbour:
      'Cletus uses only publicly available on-chain data (DexScreener, Rugcheck) and ' +
      'deterministic signal algorithms. This pre-programmed approach aligns with ' +
      'Rule 10b5-1 safe harbour for automated trading plans.',
  },

  EXCHANGE_ACT_RULE_15C3_5: {
    citation: 'SEC Rule 15c3-5 — Market Access Rule (17 C.F.R. § 240.15c3-5)',
    title: 'Risk Management Controls for Market Access',
    summary:
      'Requires pre-trade risk controls, supervisory procedures, and real-time ' +
      'monitoring for entities with automated market access. Sets the regulatory ' +
      'standard for algorithmic trading system design.',
    requirements: [
      'Pre-trade risk checks: position limits, order size limits, duplicate order detection',
      'Real-time monitoring of trading activity for anomalous patterns',
      'Kill switch / emergency stop capability that closes all positions immediately',
      'Regular testing and review of risk controls',
      'Written supervisory procedures governing automated trading',
    ],
    relevance:
      'Cletus implements: pre-trade security audit (rugcheck), signal score gate, ' +
      'MAX_OPEN_POSITIONS limit, position sizing caps, and a kill-switch endpoint.',
  },

  EXCHANGE_ACT_REGULATION_SHO: {
    citation: 'SEC Regulation SHO (17 C.F.R. § 242.200–.204)',
    title: 'Short Sale Requirements',
    summary:
      'Requires that short sellers have a "locate" (reasonable belief a security can ' +
      'be borrowed) before executing a short sale, and mandates close-out of ' +
      'failures-to-deliver within specified timeframes.',
    requirements: [
      'Locate rule: must locate borrowable shares before shorting',
      'Close-out rule: promptly close out failure-to-deliver positions',
      'Uptick rule (Rule 201): restrict short sales during circuit breaker conditions',
    ],
    relevance:
      'Cletus is LONG-only. Short selling is not supported. This eliminates all ' +
      'Regulation SHO compliance obligations.',
  },

  // ── Securities Act of 1933 ──────────────────────────────────────────────────

  SECURITIES_ACT_SECTION_5: {
    citation: 'Securities Act of 1933, § 5 (15 U.S.C. § 77e)',
    title: 'Registration Requirements for Securities Offerings',
    summary:
      'Any offer or sale of a security must be registered with the SEC or qualify ' +
      'for an exemption. Relevant to the $CLETUS token if it constitutes an ' +
      '"investment contract" under the Howey Test.',
    howeyTest: {
      citation: 'SEC v. W.J. Howey Co., 328 U.S. 293 (1946)',
      description:
        'A financial instrument is an "investment contract" (security) if it involves: ' +
        '(1) an investment of money, (2) in a common enterprise, (3) with a reasonable ' +
        'expectation of profits, (4) derived primarily from the entrepreneurial or ' +
        'managerial efforts of others.',
      application:
        'Each crypto token must be independently assessed under this test. Tokens with ' +
        'purely consumptive utility, decentralised governance, and no centralised profit ' +
        'scheme are less likely to qualify as securities.',
    },
  },

  SECURITIES_ACT_RULE_144: {
    citation: 'SEC Rule 144 (17 C.F.R. § 230.144)',
    title: 'Resale of Restricted and Control Securities',
    summary:
      'Establishes conditions under which restricted and control securities may be ' +
      'resold without registration. Relevant if $CLETUS tokens were issued in a ' +
      'private placement.',
    requirements: [
      'Holding period requirements (6–12 months depending on issuer type)',
      'Current public information requirements',
      'Volume limitations for affiliates',
      'Manner of sale requirements',
    ],
  },

  // ── Investment Advisers Act of 1940 ────────────────────────────────────────

  INVESTMENT_ADVISERS_ACT: {
    citation: 'Investment Advisers Act of 1940 (15 U.S.C. § 80b-1 et seq.)',
    title: 'Investment Adviser Registration and Conduct Standards',
    summary:
      'Any person providing investment advice about securities for compensation must ' +
      'register with the SEC (or state regulator for smaller advisers) unless exempt. ' +
      'Registered advisers owe clients a fiduciary duty of care and loyalty.',
    fiduciaryDuty: [
      'Duty of Care: provide advice in the client\'s best interest based on a reasonable ' +
        'understanding of their financial situation',
      'Duty of Loyalty: not place adviser\'s interests ahead of client interests; ' +
        'disclose and manage all material conflicts of interest',
    ],
    relevance:
      'If the Cletus platform is deemed to provide investment advice for compensation ' +
      '(e.g., fee-based signal access), investment adviser registration may be required. ' +
      'Legal counsel should assess this based on the platform\'s specific fee structure.',
  },

  // ── Dodd-Frank Act ─────────────────────────────────────────────────────────

  DODD_FRANK_SECTION_747: {
    citation: 'Dodd-Frank Wall Street Reform and Consumer Protection Act, § 747 (2010)',
    title: 'Anti-Manipulation for Swaps and Security-Based Swaps',
    summary:
      'Extends anti-manipulation and anti-fraud provisions to swap transactions. ' +
      'Relevant if Cletus ever trades any swap or derivatives instruments.',
    prohibitions: [
      'Intentional or reckless use of any manipulative device in connection with a swap',
      'Price manipulation in commodity markets that could affect related securities',
    ],
  },

  DODD_FRANK_VOLCKER_RULE: {
    citation: 'Dodd-Frank Act § 619 — Volcker Rule (12 U.S.C. § 1851)',
    title: 'Prohibitions on Proprietary Trading by Banking Entities',
    summary:
      'Prohibits banking entities from engaging in proprietary trading of securities, ' +
      'derivatives, and certain other instruments. Not directly applicable to non-banking ' +
      'algorithmic trading systems, but informs best-practice risk separation principles.',
    relevance: 'Not applicable to Cletus (non-banking entity).',
  },

  // ── Commodity Exchange Act / CFTC ──────────────────────────────────────────

  COMMODITY_EXCHANGE_ACT: {
    citation: 'Commodity Exchange Act, § 4c, 4s, 9 (7 U.S.C. § 6c, 6s, 13)',
    title: 'CFTC Anti-Manipulation and Anti-Fraud for Commodity Markets',
    summary:
      'The CFTC has asserted jurisdiction over crypto assets deemed commodities ' +
      '(Bitcoin, Ether, and potentially most utility tokens on Solana). CEA § 9 ' +
      'prohibits manipulation, false reporting, and wash trading in commodity markets.',
    relevance:
      'Even tokens outside SEC jurisdiction are subject to CFTC anti-manipulation rules. ' +
      'The same wash-trading, manipulation, and fraud prohibitions apply.',
    note:
      'SOL and most Solana DeFi tokens are more likely to be CFTC-regulated commodities ' +
      'than SEC-regulated securities, although jurisdictional boundaries remain unsettled.',
  },

  // ── Regulation Best Execution ───────────────────────────────────────────────

  REGULATION_BEST_EXECUTION: {
    citation: 'SEC Regulation Best Execution (Release No. 34-96496, 2023)',
    title: 'Best Execution Obligation',
    summary:
      'Broker-dealers and covered entities must establish and maintain policies and ' +
      'procedures reasonably designed to obtain the most favourable terms reasonably ' +
      'available for customer orders.',
    requirement:
      'Cletus routes all swap orders through Jupiter Aggregator, which automatically ' +
      'finds the best available price across Solana DEX liquidity sources — consistent ' +
      'with best-execution principles.',
  },

  // ── Regulation ATS ─────────────────────────────────────────────────────────

  REGULATION_ATS: {
    citation: 'SEC Regulation ATS (17 C.F.R. § 242.300–.303)',
    title: 'Alternative Trading System Registration',
    summary:
      'Systems that match orders for securities must register as exchanges or ' +
      'broker-dealers under Regulation ATS. Fully autonomous DEX trading using ' +
      'public liquidity pools (not order-book matching) is generally outside ATS scope.',
    relevance:
      'Cletus uses Jupiter DEX aggregator (AMM liquidity pools), not a centralised ' +
      'order-matching system. Regulation ATS registration is not required.',
  },

  // ── Bank Secrecy Act / AML ─────────────────────────────────────────────────

  BANK_SECRECY_ACT_AML: {
    citation: 'Bank Secrecy Act (31 U.S.C. § 5311 et seq.) / FinCEN Guidance FIN-2019-G001',
    title: 'Anti-Money Laundering and Know-Your-Customer Requirements',
    summary:
      'Financial institutions and Money Services Businesses (MSBs) must implement ' +
      'AML programs, KYC procedures, and file Suspicious Activity Reports (SARs) ' +
      'for transactions indicating money laundering. Crypto exchanges and platforms ' +
      'accepting user funds may qualify as MSBs.',
    requirements: [
      'Customer identification and verification (KYC) for users accessing live trading',
      'Suspicious Activity Report (SAR) filing for transactions with money laundering indicators',
      'Transaction monitoring for structuring, layering, or integration patterns',
      'Recordkeeping of transactions over applicable thresholds',
    ],
    relevance:
      'Platform operators accepting staking deposits or trading capital from users should ' +
      'assess MSB registration obligations with qualified legal counsel.',
  },

} as const;

// ── Compliance Check Types ────────────────────────────────────────────────────

export interface ComplianceResult {
  /** True if no violations were detected. */
  compliant: boolean;
  /** Rule violations that must block the trade. */
  violations: string[];
  /** Warnings that should be logged but do not block. */
  warnings: string[];
  /** SEC/regulatory rule citations for any violations or warnings. */
  rules: string[];
}

export interface TradeRecord {
  tokenAddress: string;
  side: 'buy' | 'sell';
  timestamp: number; // Unix ms
}

// ── Position Concentration Check ─────────────────────────────────────────────

/**
 * Ensures the proposed trade does not represent a manipulative concentration
 * of buying power relative to token liquidity and volume.
 *
 * Derived from Exchange Act § 9 (market manipulation) and Rule 10b-5.
 *
 * Configurable limits (env vars):
 *   SEC_MAX_VOLUME_SHARE    — max fraction of 24h volume (default 5%)
 *   SEC_MAX_LIQUIDITY_SHARE — max fraction of pool liquidity (default 10%)
 */
export function checkPositionConcentration(
  amountUsd: number,
  tokenVolume24hUsd: number,
  tokenLiquidityUsd: number,
): ComplianceResult {
  const violations: string[] = [];
  const warnings: string[] = [];

  const maxVolumeShare    = parseFloat(process.env.SEC_MAX_VOLUME_SHARE    ?? '0.05');
  const maxLiquidityShare = parseFloat(process.env.SEC_MAX_LIQUIDITY_SHARE ?? '0.10');

  if (tokenVolume24hUsd > 0) {
    const volumeShare = amountUsd / tokenVolume24hUsd;
    if (volumeShare > maxVolumeShare) {
      violations.push(
        `Trade ($${amountUsd.toFixed(0)}) exceeds ${(maxVolumeShare * 100).toFixed(0)}% of 24h volume ` +
        `($${tokenVolume24hUsd.toFixed(0)}) — market manipulation risk (Exchange Act § 9)`,
      );
    } else if (volumeShare > maxVolumeShare * 0.7) {
      warnings.push(
        `Trade is ${(volumeShare * 100).toFixed(1)}% of 24h volume — approaching ${(maxVolumeShare * 100).toFixed(0)}% concentration limit`,
      );
    }
  }

  if (tokenLiquidityUsd > 0) {
    const liquidityShare = amountUsd / tokenLiquidityUsd;
    if (liquidityShare > maxLiquidityShare) {
      violations.push(
        `Trade ($${amountUsd.toFixed(0)}) exceeds ${(maxLiquidityShare * 100).toFixed(0)}% of pool liquidity ` +
        `($${tokenLiquidityUsd.toFixed(0)}) — liquidity manipulation risk (Exchange Act § 9)`,
      );
    } else if (liquidityShare > maxLiquidityShare * 0.7) {
      warnings.push(
        `Trade is ${(liquidityShare * 100).toFixed(1)}% of pool liquidity — approaching ${(maxLiquidityShare * 100).toFixed(0)}% limit`,
      );
    }
  }

  return {
    compliant: violations.length === 0,
    violations,
    warnings,
    rules: ['Exchange Act § 9 (15 U.S.C. § 78i)', 'Rule 10b-5 (17 C.F.R. § 240.10b-5)'],
  };
}

// ── Wash Trading Detection ────────────────────────────────────────────────────

/**
 * Detects potential wash trading: buying the same token shortly after selling
 * it, which creates artificial volume and a misleading appearance of market
 * activity in violation of Exchange Act § 9(a)(1).
 *
 * Configurable:
 *   SEC_WASH_TRADE_WINDOW_MINUTES — look-back window in minutes (default 60)
 */
export function checkWashTrading(
  tokenAddress: string,
  recentTrades: TradeRecord[],
): ComplianceResult {
  const violations: string[] = [];
  const warnings: string[] = [];

  const windowMinutes = parseInt(process.env.SEC_WASH_TRADE_WINDOW_MINUTES ?? '60', 10);
  const windowMs = windowMinutes * 60_000;
  const cutoff = Date.now() - windowMs;

  const tokenTrades = recentTrades.filter(
    (t) => t.tokenAddress === tokenAddress && t.timestamp >= cutoff,
  );

  const hasBuy  = tokenTrades.some((t) => t.side === 'buy');
  const hasSell = tokenTrades.some((t) => t.side === 'sell');

  // Attempting to buy a token that was both bought and sold within the window
  // is the hallmark of wash-trade cycling.
  if (hasBuy && hasSell) {
    violations.push(
      `Both buy and sell activity detected for this token within the last ${windowMinutes} min — ` +
      `potential wash trading pattern (Exchange Act § 9(a)(1))`,
    );
  } else if (hasSell && !hasBuy) {
    // Sold recently, now trying to buy again — rapid re-entry warning
    warnings.push(
      `Token was sold within the last ${windowMinutes} min — immediate re-entry may create ` +
      `an appearance of wash trading. Ensure genuine investment intent (Exchange Act § 9)`,
    );
  }

  const shortWindow = 5 * 60_000; // 5 minutes
  const rapidTrades = tokenTrades.filter((t) => t.timestamp >= Date.now() - shortWindow);
  if (rapidTrades.length >= 3) {
    warnings.push(
      `${rapidTrades.length} trades in 5 min for the same token — monitor for artificial activity (Exchange Act § 9)`,
    );
  }

  return {
    compliant: violations.length === 0,
    violations,
    warnings,
    rules: ['Exchange Act § 9(a)(1) (15 U.S.C. § 78i(a)(1))'],
  };
}

// ── Trading Velocity Check ────────────────────────────────────────────────────

/**
 * Ensures the overall trading velocity does not simulate artificial market
 * activity across all tokens, in violation of Exchange Act § 9.
 *
 * Configurable:
 *   SEC_MAX_TRADES_PER_5MIN — maximum trades in any 5-minute window (default 8)
 */
export function checkTradingVelocity(recentTrades: TradeRecord[]): ComplianceResult {
  const violations: string[] = [];
  const warnings: string[] = [];

  const windowMs  = 5 * 60_000;
  const maxTrades = parseInt(process.env.SEC_MAX_TRADES_PER_5MIN ?? '8', 10);
  const cutoff    = Date.now() - windowMs;

  const windowTrades = recentTrades.filter((t) => t.timestamp >= cutoff);

  if (windowTrades.length >= maxTrades) {
    violations.push(
      `${windowTrades.length} trades executed in the last 5 min — exceeds velocity ceiling ` +
      `(${maxTrades}) designed to prevent artificial trading activity (Exchange Act § 9)`,
    );
  } else if (windowTrades.length >= Math.ceil(maxTrades * 0.75)) {
    warnings.push(
      `Trading velocity: ${windowTrades.length}/${maxTrades} trades in last 5 min — approaching limit`,
    );
  }

  return {
    compliant: violations.length === 0,
    violations,
    warnings,
    rules: ['Exchange Act § 9 (15 U.S.C. § 78i)'],
  };
}

// ── Aggregate Compliance Gate ─────────────────────────────────────────────────

/**
 * Run all applicable SEC compliance checks for a proposed buy trade.
 * Returns a merged ComplianceResult — compliant only if ALL checks pass.
 */
export function runSecComplianceChecks(params: {
  tokenAddress: string;
  amountUsd: number;
  tokenVolume24hUsd: number;
  tokenLiquidityUsd: number;
  recentTrades: TradeRecord[];
}): ComplianceResult {
  const { tokenAddress, amountUsd, tokenVolume24hUsd, tokenLiquidityUsd, recentTrades } = params;

  const results = [
    checkPositionConcentration(amountUsd, tokenVolume24hUsd, tokenLiquidityUsd),
    checkWashTrading(tokenAddress, recentTrades),
    checkTradingVelocity(recentTrades),
  ];

  const allViolations = results.flatMap((r) => r.violations);
  const allWarnings   = results.flatMap((r) => r.warnings);
  const allRules      = [...new Set(results.flatMap((r) => r.rules))];

  return {
    compliant: allViolations.length === 0,
    violations: allViolations,
    warnings: allWarnings,
    rules: allRules,
  };
}

// ── AI Brain Knowledge Context ────────────────────────────────────────────────

/**
 * Returns the full SEC regulatory knowledge summary for injection into
 * the Cletus AI Brain system prompt. This is the "regulatory memory"
 * that governs all AI responses and advisory outputs.
 */
export function getSecComplianceContext(): string {
  return `
## U.S. SEC & Federal Securities Law Compliance Framework

Cletus is built to operate in compliance with U.S. federal securities laws and CFTC commodity regulations. Every action Cletus takes is governed by the following regulatory framework.

### Core Prohibitions (Always Enforced)

**1. Market Manipulation — Exchange Act § 9 / Rule 10b-5**
No wash trading, matched orders, or trading designed to create a false appearance of market activity. Every trade must reflect genuine investment intent. Cletus limits each trade to ≤5% of 24h volume and ≤10% of available pool liquidity to prevent price manipulation.

**2. Insider Trading — Rule 10b5-1 (17 C.F.R. § 240.10b5-1)**
Cletus uses only publicly available on-chain data (DexScreener, Rugcheck.xyz). No trading on material non-public information (MNPI). The fully pre-programmed, signal-based approach aligns with the Rule 10b5-1 safe harbour for automated trading plans.

**3. Anti-Fraud — Rule 10b-5 (17 C.F.R. § 240.10b-5)**
No misrepresentation of trading activity, token performance, or platform capabilities. All AI responses must be accurate and not misleading regarding investment risks.

**4. Wash Trading Prevention — Exchange Act § 9(a)(1)**
Cletus tracks recent trades per token. If a token was both bought and sold within the last 60 minutes, re-entry is blocked as a potential wash-trade pattern.

**5. Trading Velocity Control — Exchange Act § 9**
Cletus caps total trades at 8 per 5-minute window to prevent creating artificial market activity patterns.

### Regulatory Architecture Controls (Rule 15c3-5 Aligned)

Cletus implements the following pre-trade risk controls, consistent with SEC Rule 15c3-5 (Market Access Rule):
- Pre-trade security audit: rugcheck.xyz + DexScreener heuristics on every token
- Signal score minimum gate (MIN_COMPOSITE_SCORE): only high-conviction entries
- Maximum open positions cap (MAX_OPEN_POSITIONS): limits portfolio concentration
- Position sizing limits tied to cumulative PnL milestones
- Kill switch: single-call endpoint to close all positions immediately
- SEC compliance checks: position concentration, wash-trading, velocity — enforced pre-trade

### Token Classification — Howey Test (SEC v. W.J. Howey Co., 328 U.S. 293 (1946))

A financial instrument is a "security" (investment contract) if it involves:
1. An investment of money
2. In a common enterprise
3. With a reasonable expectation of profits
4. Derived primarily from the efforts of others

**$CLETUS token**: May be subject to SEC registration requirements if it satisfies the Howey Test (users invest money expecting profits from developers' efforts). Legal counsel should assess this.

**Traded Solana DeFi tokens**: Classification varies by token. Most utility/governance tokens with decentralised development and no central profit scheme are less likely to be securities. However, the CFTC asserts jurisdiction over crypto commodities regardless of SEC classification — and prohibits manipulation under the Commodity Exchange Act § 9 (7 U.S.C. § 13).

### Investment Adviser Considerations

Under the Investment Advisers Act of 1940, anyone providing investment advice about securities for compensation must register with the SEC. The Cletus platform's signal-sharing and AI advisory features may trigger this requirement depending on fee structure. Platform operators should consult qualified securities law counsel.

### Short Selling

Cletus is LONG-only. Short selling is not supported, eliminating all SEC Regulation SHO obligations (locate requirements, close-out rules, uptick rule).

### Best Execution

All trades are routed through Jupiter Aggregator, which sources best-available price across Solana DEX liquidity — consistent with SEC Regulation Best Execution (2023) principles.

### Anti-Money Laundering

Platform operators accepting staking deposits or trading capital from users should assess Money Services Business (MSB) registration under the Bank Secrecy Act and FinCEN guidance FIN-2019-G001, including KYC procedures and SAR filing obligations.

### CFTC Dual Jurisdiction

Most Solana DeFi tokens are more likely regulated as commodities under CFTC jurisdiction than as securities under SEC jurisdiction — though this boundary is unsettled. All CFTC anti-manipulation and anti-fraud provisions of the Commodity Exchange Act apply regardless of classification.

### Disclaimer

This compliance framework represents best-effort encoding of applicable regulations. It does not constitute legal advice. Cletus users and platform operators must consult qualified U.S. securities law counsel for definitive compliance guidance applicable to their specific circumstances.
`.trim();
}
