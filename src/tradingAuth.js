const { JUPITER_FEE_WALLET } = require('./config');
const { state } = require('./store');
const { validatePairByPolicy } = require('./policyValidation');

const TRIAL_DAYS = 30;
const MONTHLY_GROSS_PROFIT_CAP_USD = 10000;
const WEEKLY_PASS_USDC = 20;

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

function evaluateTradeAuthorization(user, { pair, expectedGrossProfitUsd = 0 }, now = new Date()) {
  if (state.operatorFlags.killSwitch) {
    return { allowed: false, reasonCode: 'GLOBAL_KILL_SWITCH_ACTIVE' };
  }

  const routeCheck = validatePairByPolicy(user.constraints, pair);
  if (!routeCheck.allowed) {
    return { allowed: false, reasonCode: routeCheck.reasonCode };
  }

  const trial = isWithinTrial(user, now);
  if (!trial && !user.stakeActive) {
    return { allowed: false, reasonCode: 'TRIAL_ENDED_STAKE_REQUIRED' };
  }

  const projectedGrossProfit = user.monthlyGrossProfitUsd + expectedGrossProfitUsd;
  if (projectedGrossProfit > MONTHLY_GROSS_PROFIT_CAP_USD && !hasValidWeeklyPass(user, now)) {
    return {
      allowed: false,
      reasonCode: 'MONTHLY_GROSS_PROFIT_CAP_WEEKLY_PASS_REQUIRED',
      weeklyPassCostUsdc: WEEKLY_PASS_USDC
    };
  }

  return {
    allowed: true,
    reasonCode: 'AUTHORIZED',
    feeRouting: {
      feeBps: 50,
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
