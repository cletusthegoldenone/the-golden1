function numberFromEnv(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const POLICY_VERSIONS = {
  terms: process.env.POLICY_VERSION_TERMS || '2026-08-19',
  riskDisclaimer: process.env.POLICY_VERSION_RISK || '2026-08-19',
  tradingAuthorization: process.env.POLICY_VERSION_TRADING_AUTH || '2026-08-19',
  privacy: process.env.POLICY_VERSION_PRIVACY || '2026-08-19'
};

const JUPITER_FEE_WALLET = process.env.JUPITER_FEE_WALLET || 'h1vRxwsCLUtiD6UiKpSgNnTDUAqvXCxurFVUfvH1noj';
const FEE_ROUTING_ENABLED = process.env.FEE_ROUTING_ENABLED !== 'false';
const FEE_ROUTING_BPS = numberFromEnv(process.env.FEE_ROUTING_BPS, 50);
const TRIAL_DAYS = numberFromEnv(process.env.TRIAL_DAYS, 30);
const MONTHLY_GROSS_PROFIT_CAP_USD = numberFromEnv(process.env.MONTHLY_GROSS_PROFIT_CAP_USD, 10000);
const WEEKLY_PASS_USDC = numberFromEnv(process.env.WEEKLY_PASS_USDC, 20);

module.exports = {
  POLICY_VERSIONS,
  JUPITER_FEE_WALLET,
  FEE_ROUTING_ENABLED,
  FEE_ROUTING_BPS,
  TRIAL_DAYS,
  MONTHLY_GROSS_PROFIT_CAP_USD,
  WEEKLY_PASS_USDC
};
