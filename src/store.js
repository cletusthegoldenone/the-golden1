const state = {
  users: new Map(),
  consentLogs: [],
  transactions: new Map(),
  operatorFlags: {
    killSwitch: false
  }
};

function getUser(identity) {
  if (!state.users.has(identity)) {
    state.users.set(identity, {
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
    });
  }
  return state.users.get(identity);
}

module.exports = {
  state,
  getUser
};
