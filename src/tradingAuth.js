const {
  JUPITER_FEE_WALLET,
  FEE_ROUTING_ENABLED,
  FEE_ROUTING_BPS,
  ENABLE_KILL_SWITCH,
  TRIAL_DAYS,
  MONTHLY_GROSS_PROFIT_CAP_USD,
  WEEKLY_PASS_USDC
} = require('./config');
const { state } = require('./store');
const { validatePairByPolicy } = require('./policyValidation');

function deny(reasonCode, reason, extra = {}) {
  return {
    allowed: false,
    reasonCode,
    reason,
    ...extra
  };
}

function isWithinTrial(user, now = new Date()) {
  const start = new Date(user.trialStartedAt);
  const diffDays = (now - start) / (1000 * 60 * 60 * 24);
  return diffDays <= TRIAL_DAYS;
}

function hasValidWeeklyPass(user, now = new Date()) {
  if (!user.weeklyPassPaidAt) return false;
  const paid = new Date(user.weeklyPassPaidAt);
  const diffDays = (now - paid) / (1000 * 60 * 60 * 24);
  return diffDays <= 7;
}

function evaluateTradeAuthorization(
  user,
  { pair, expectedGrossProfitUsd = 0, action = 'swap', tradeSizeUsd = 0 },
  now = new Date()
) {
  if (ENABLE_KILL_SWITCH && state.operatorFlags.killSwitch) {
    return deny('GLOBAL_KILL_SWITCH_ACTIVE', 'Trading is currently paused by operator kill switch.');
  }

  const routeCheck = validatePairByPolicy(user.constraints, pair);
  if (!routeCheck.allowed) {
    return deny(routeCheck.reasonCode, 'Pair policy denied this trade request.');
  }

  if (!user.wallet.mode) {
    return deny('WALLET_MODE_REQUIRED', 'Wallet mode must be configured before trading.');
  }

  if (user.wallet.mode === 'external') {
    const permission = user.wallet.delegatedPermission;
    if (!permission) {
      return deny('DELEGATION_REQUIRED', 'External wallet trading requires delegated permission.');
    }
    if (permission.revokedAt) {
      return deny('DELEGATION_REVOKED', 'Delegated permission has been revoked.');
    }
    if (permission.expiresAt && new Date(permission.expiresAt) <= now) {
      return deny('DELEGATION_EXPIRED', 'Delegated permission has expired.');
    }
    if (Array.isArray(permission.allowedActions) && !permission.allowedActions.includes(action)) {
      return deny('DELEGATION_ACTION_NOT_ALLOWED', 'Requested action is outside delegated scope.');
    }
    if (permission.maxTradeSizeUsd != null && tradeSizeUsd > permission.maxTradeSizeUsd) {
      return deny('DELEGATION_MAX_TRADE_EXCEEDED', 'Requested trade size exceeds delegation limit.');
    }
  }

  const trial = isWithinTrial(user, now);
  if (!trial && !user.stakeActive) {
    return deny('TRIAL_ENDED_STAKE_REQUIRED', 'Trial window ended and stake is required.');
  }

  const projectedGrossProfit = user.monthlyGrossProfitUsd + expectedGrossProfitUsd;
  if (projectedGrossProfit > MONTHLY_GROSS_PROFIT_CAP_USD && !hasValidWeeklyPass(user, now)) {
    return deny(
      'MONTHLY_GROSS_PROFIT_CAP_WEEKLY_PASS_REQUIRED',
      'Monthly gross-profit cap reached; weekly pass is required.',
      {
        weeklyPassCostUsdc: WEEKLY_PASS_USDC
      }
    );
  }

  if (!FEE_ROUTING_ENABLED) {
    return deny('FEE_ROUTING_DISABLED', 'Trading temporarily unavailable while fee routing is disabled.');
  }

  return {
    allowed: true,
    reasonCode: 'AUTHORIZED',
    reason: 'Trade request is authorized under current policy.',
    feeRouting: {
      enabled: FEE_ROUTING_ENABLED,
      feeBps: FEE_ROUTING_BPS,
      destinationWallet: JUPITER_FEE_WALLET
    }
  };
}

module.exports = {
  evaluateTradeAuthorization,
  TRIAL_DAYS,
  MONTHLY_GROSS_PROFIT_CAP_USD,
  WEEKLY_PASS_USDC,
  hasValidWeeklyPass,
  isWithinTrial
};
