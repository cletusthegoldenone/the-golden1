const { createFilePersistence } = require('./persistence');
const { PERSISTENCE_FILE_PATH } = require('./config');

const persistence = createFilePersistence(PERSISTENCE_FILE_PATH);

function defaultUser(identity) {
  return {
    id: identity,
    createdAt: new Date().toISOString(),
    profile: null,
    onboarding: {
      legalAccepted: false,
      accountCreated: false,
      profileInitialized: false,
      walletModeSelected: false,
      constraintsConfigured: false,
      walletFundedOrLinked: false,
      completed: false
    },
    wallet: {
      mode: null,
      managedWalletId: null,
      delegatedPermission: null
    },
    constraints: {
      maxTradeSizeUsd: null,
      maxDailyTrades: null,
      whitelistMode: false,
      blocklistMode: false,
      allowedPairs: [],
      blockedPairs: []
    },
    trialStartedAt: new Date().toISOString(),
    stakeActive: false,
    weeklyPassPaidAt: null,
    monthlyGrossProfitUsd: 0
  };
}

function emptyState() {
  return {
    users: new Map(),
    consentLogs: [],
    transactions: new Map(),
    operatorFlags: {
      killSwitch: false
    }
  };
}

function fromSnapshot(snapshot) {
  const base = emptyState();
  if (!snapshot || typeof snapshot !== 'object') return base;

  if (Array.isArray(snapshot.users)) {
    for (const user of snapshot.users) {
      if (user && typeof user.id === 'string') {
        base.users.set(user.id, user);
      }
    }
  }

  if (Array.isArray(snapshot.consentLogs)) {
    base.consentLogs = snapshot.consentLogs;
  }

  if (Array.isArray(snapshot.transactions)) {
    for (const entry of snapshot.transactions) {
      if (!entry || typeof entry.userId !== 'string' || !Array.isArray(entry.records)) continue;
      base.transactions.set(entry.userId, entry.records);
    }
  }

  if (snapshot.operatorFlags && typeof snapshot.operatorFlags === 'object') {
    base.operatorFlags = {
      killSwitch: !!snapshot.operatorFlags.killSwitch
    };
  }

  return base;
}

function toSnapshot(current) {
  return {
    users: Array.from(current.users.values()),
    consentLogs: current.consentLogs,
    transactions: Array.from(current.transactions.entries()).map(([userId, records]) => ({ userId, records })),
    operatorFlags: {
      killSwitch: !!current.operatorFlags.killSwitch
    }
  };
}

const state = fromSnapshot(persistence.load());

function saveState() {
  persistence.save(toSnapshot(state));
}

function getUser(identity) {
  if (!state.users.has(identity)) {
    state.users.set(identity, defaultUser(identity));
    saveState();
  }
  return state.users.get(identity);
}

function setTransactions(identity, records) {
  state.transactions.set(identity, records);
  saveState();
}

function resetState({ clearPersistence = true } = {}) {
  state.users.clear();
  state.consentLogs.length = 0;
  state.transactions.clear();
  state.operatorFlags.killSwitch = false;
  if (clearPersistence) {
    persistence.clear();
  }
}

module.exports = {
  state,
  getUser,
  saveState,
  setTransactions,
  resetState,
  persistence
};
