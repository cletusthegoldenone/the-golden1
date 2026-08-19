const { POLICY_VERSIONS } = require('./config');
const { state, getUser, saveState } = require('./store');

function recordConsent({ identity, accepted, ip, userAgent, sessionId }) {
  const acceptedAtUtc = new Date().toISOString();
  const log = {
    userId: identity,
    sessionId: sessionId || null,
    acceptanceStatus: accepted ? 'accepted' : 'declined',
    policyVersions: { ...POLICY_VERSIONS },
    acceptedAtUtc,
    metadata: {
      ip: ip || null,
      userAgent: userAgent || null
    }
  };

  state.consentLogs.push(log);
  const user = getUser(identity);
  user.onboarding.legalAccepted = !!accepted;
  saveState();
  return log;
}

function hasAcceptedLatest(identity) {
  const userLogs = state.consentLogs
    .filter((log) => log.userId === identity && log.acceptanceStatus === 'accepted')
    .reverse();

  if (!userLogs.length) return false;

  const latest = userLogs[0];
  return Object.entries(POLICY_VERSIONS).every(
    ([key, value]) => latest.policyVersions[key] === value
  );
}

function getConsentHistory(identity) {
  return state.consentLogs
    .filter((log) => log.userId === identity)
    .sort((a, b) => new Date(b.acceptedAtUtc) - new Date(a.acceptedAtUtc));
}

module.exports = {
  recordConsent,
  hasAcceptedLatest,
  getConsentHistory
};
