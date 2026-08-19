const { POLICY_VERSIONS } = require('./config');
const { state, getUser } = require('./store');

function recordConsent({ identity, accepted, ip, userAgent }) {
  const timestampUtc = new Date().toISOString();
  const log = {
    identity,
    acceptanceStatus: accepted ? 'accepted' : 'declined',
    policyVersions: { ...POLICY_VERSIONS },
    timestampUtc,
    metadata: {
      ip: ip || null,
      userAgent: userAgent || null
    }
  };

  state.consentLogs.push(log);
  const user = getUser(identity);
  user.onboarding.legalAccepted = !!accepted;
  return log;
}

function hasAcceptedLatest(identity) {
  const userLogs = state.consentLogs
    .filter((log) => log.identity === identity && log.acceptanceStatus === 'accepted')
    .reverse();

  if (!userLogs.length) return false;

  const latest = userLogs[0];
  return Object.entries(POLICY_VERSIONS).every(
    ([key, value]) => latest.policyVersions[key] === value
  );
}

module.exports = {
  recordConsent,
  hasAcceptedLatest
};
