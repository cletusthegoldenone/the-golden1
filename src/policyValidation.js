function validatePairByPolicy(constraints, pair) {
  if (!pair) {
    return { allowed: false, reasonCode: 'INVALID_PAIR' };
  }

  if (constraints.whitelistMode) {
    const allowed = constraints.allowedPairs.includes(pair);
    if (!allowed) {
      return { allowed: false, reasonCode: 'PAIR_NOT_WHITELISTED' };
    }
  }

  if (constraints.blocklistMode) {
    const blocked = constraints.blockedPairs.includes(pair);
    if (blocked) {
      return { allowed: false, reasonCode: 'PAIR_BLOCKLISTED' };
    }
  }

  return { allowed: true, reasonCode: 'ALLOWED' };
}

module.exports = {
  validatePairByPolicy
};
