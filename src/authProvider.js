const crypto = require('crypto');
const { AUTH_PROVIDER, AUTH_BOOTSTRAP_TOKEN, AUTH_CHALLENGE_TTL_SECONDS, IS_PRODUCTION } = require('./config');
const { decodeSignature, parseWalletPublicKey, walletIdentity } = require('./solanaWallet');

class AuthProviderError extends Error {
  constructor(reasonCode, status = 401) {
    super(reasonCode);
    this.reasonCode = reasonCode;
    this.status = status;
  }
}

function createWalletChallengeProvider(options = {}) {
  const randomBytes = options.randomBytes || crypto.randomBytes;
  const now = options.now || (() => Date.now());
  const challenges = new Map();

  function beginAuth(walletInput) {
    let wallet;
    try {
      wallet = parseWalletPublicKey(walletInput);
    } catch (error) {
      throw new AuthProviderError(error.message, error.message === 'AUTH_WALLET_PUBLIC_KEY_REQUIRED' ? 400 : 401);
    }
    const challengeId = randomBytes(12).toString('hex');
    const nonce = randomBytes(24).toString('base64url');
    const issuedAt = new Date(now()).toISOString();
    const expiresAtMs = now() + AUTH_CHALLENGE_TTL_SECONDS * 1000;
    const message = `The Golden1 authentication challenge\nnonce:${nonce}\nissuedAt:${issuedAt}`;

    challenges.set(challengeId, {
      wallet,
      message,
      expiresAtMs,
      used: false
    });

    return {
      challengeId,
      nonce,
      message,
      expiresAt: new Date(expiresAtMs).toISOString(),
      expiresInSeconds: AUTH_CHALLENGE_TTL_SECONDS
    };
  }

  function completeAuth({ challengeId, signature, ...walletInput }) {
    const entry = challenges.get(challengeId);
    if (!entry) throw new AuthProviderError('AUTH_CHALLENGE_INVALID');
    if (entry.used) throw new AuthProviderError('AUTH_CHALLENGE_REPLAYED');
    if (entry.expiresAtMs <= now()) throw new AuthProviderError('AUTH_CHALLENGE_EXPIRED');

    let wallet;
    try {
      wallet = parseWalletPublicKey(walletInput);
    } catch (error) {
      throw new AuthProviderError(error.message, error.message === 'AUTH_WALLET_PUBLIC_KEY_REQUIRED' ? 400 : 401);
    }
    if (entry.wallet.normalized !== wallet.normalized) throw new AuthProviderError('AUTH_CHALLENGE_INVALID');

    let signatureBuffer;
    try {
      signatureBuffer = decodeSignature(signature);
    } catch (_) {
      throw new AuthProviderError(!signature ? 'AUTH_SIGNATURE_REQUIRED' : 'AUTH_SIGNATURE_INVALID', !signature ? 400 : 401);
    }

    let verified = false;
    try {
      verified = crypto.verify(null, Buffer.from(entry.message), wallet.verifierKey, signatureBuffer);
    } catch (_) {
      throw new AuthProviderError('AUTH_SIGNATURE_INVALID');
    }
    if (!verified) throw new AuthProviderError('AUTH_SIGNATURE_INVALID');

    entry.used = true;
    return {
      identity: walletIdentity(walletInput),
      subject: wallet.normalized
    };
  }

  return {
    name: 'wallet_challenge',
    beginAuth,
    completeAuth,
    health: () => ({ ok: true, provider: 'wallet_challenge' })
  };
}

function createBootstrapProvider() {
  return {
    name: 'bootstrap',
    beginAuth() {
      throw new AuthProviderError('AUTH_FLOW_NOT_SUPPORTED', 405);
    },
    completeAuth({ identity, bootstrapToken }) {
      if (!bootstrapToken) throw new AuthProviderError('AUTH_BOOTSTRAP_REQUIRED');
      if (bootstrapToken !== AUTH_BOOTSTRAP_TOKEN) throw new AuthProviderError('AUTH_BOOTSTRAP_INVALID');
      if (!identity || typeof identity !== 'string' || !identity.trim()) throw new AuthProviderError('AUTH_IDENTITY_REQUIRED', 400);
      return { identity: identity.trim(), subject: identity.trim() };
    },
    health: () => ({ ok: true, provider: 'bootstrap' })
  };
}

function createAuthProvider() {
  if (AUTH_PROVIDER === 'wallet_challenge') return createWalletChallengeProvider();
  if (AUTH_PROVIDER === 'bootstrap') {
    if (IS_PRODUCTION) {
      return {
        name: 'bootstrap_disabled',
        beginAuth() {
          throw new AuthProviderError('AUTH_BOOTSTRAP_DISABLED', 403);
        },
        completeAuth() {
          throw new AuthProviderError('AUTH_BOOTSTRAP_DISABLED', 403);
        },
        health: () => ({ ok: false, provider: 'bootstrap', reasonCode: 'AUTH_BOOTSTRAP_DISABLED' })
      };
    }
    return createBootstrapProvider();
  }

  return {
    name: 'unavailable',
    beginAuth() {
      throw new AuthProviderError('AUTH_PROVIDER_UNAVAILABLE', 503);
    },
    completeAuth() {
      throw new AuthProviderError('AUTH_PROVIDER_UNAVAILABLE', 503);
    },
    health: () => ({ ok: false, provider: AUTH_PROVIDER, reasonCode: 'AUTH_PROVIDER_UNAVAILABLE' })
  };
}

module.exports = {
  AuthProviderError,
  createAuthProvider,
  walletIdentity
};
