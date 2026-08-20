const crypto = require('crypto');
const bs58 = require('bs58');
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');
const MAX_BASE58_LENGTH = 128;
const ED25519_SIGNATURE_LENGTH = 64;
const STRICT_BASE64_RE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

function decodeBase58(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('INVALID_BASE58');
  }
  if (value.trim().length > MAX_BASE58_LENGTH) {
    throw new Error('INVALID_BASE58');
  }

  try {
    return Buffer.from(bs58.decode(value.trim()));
  } catch (_) {
    throw new Error('INVALID_BASE58');
  }
}

function rawPublicKeyToSpki(rawPublicKey) {
  if (!Buffer.isBuffer(rawPublicKey) || rawPublicKey.length !== 32) {
    throw new Error('INVALID_WALLET_PUBLIC_KEY');
  }
  return Buffer.concat([ED25519_SPKI_PREFIX, rawPublicKey]);
}

function parseWalletPublicKey(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('AUTH_WALLET_PUBLIC_KEY_REQUIRED');
  }

  if (typeof input.walletPublicKey === 'string' && input.walletPublicKey.trim()) {
    const normalized = input.walletPublicKey.trim();
    let rawPublicKey;
    try {
      rawPublicKey = decodeBase58(normalized);
    } catch (_) {
      throw new Error('AUTH_WALLET_PUBLIC_KEY_INVALID');
    }
    if (rawPublicKey.length !== 32) {
      throw new Error('AUTH_WALLET_PUBLIC_KEY_INVALID');
    }
    return {
      format: 'solana_base58',
      normalized,
      rawPublicKey,
      verifierKey: crypto.createPublicKey({
        key: rawPublicKeyToSpki(rawPublicKey),
        format: 'der',
        type: 'spki'
      })
    };
  }

  if (typeof input.walletPublicKeyPem === 'string' && input.walletPublicKeyPem.trim()) {
    const normalized = input.walletPublicKeyPem.trim();
    let verifierKey, der;
    try {
      verifierKey = crypto.createPublicKey(normalized);
      if (verifierKey.asymmetricKeyType !== 'ed25519') {
        throw new Error('not ed25519');
      }
      der = verifierKey.export({ format: 'der', type: 'spki' });
    } catch (_) {
      throw new Error('AUTH_WALLET_PUBLIC_KEY_INVALID');
    }
    const rawPublicKey = Buffer.from(der.slice(-32));
    return {
      format: 'pem',
      normalized,
      rawPublicKey,
      verifierKey
    };
  }

  throw new Error('AUTH_WALLET_PUBLIC_KEY_REQUIRED');
}

function walletIdentity(walletInput) {
  const { rawPublicKey } = parseWalletPublicKey(walletInput);
  return `wallet:${crypto.createHash('sha256').update(rawPublicKey).digest('hex').slice(0, 32)}`;
}

function decodeCanonicalBase64(value) {
  if (!STRICT_BASE64_RE.test(value)) return null;
  const buffer = Buffer.from(value, 'base64');
  return buffer.length === ED25519_SIGNATURE_LENGTH ? buffer : null;
}

function decodeSignature(signature) {
  if (!signature || typeof signature !== 'string') {
    throw new Error('AUTH_SIGNATURE_REQUIRED');
  }

  const trimmed = signature.trim();
  const base64 = decodeCanonicalBase64(trimmed);
  if (base64) return base64;

  try {
    const decoded = decodeBase58(trimmed);
    if (decoded.length === ED25519_SIGNATURE_LENGTH) return decoded;
  } catch (_) {
    // fall through
  }

  throw new Error('AUTH_SIGNATURE_INVALID');
}

module.exports = {
  decodeBase58,
  decodeSignature,
  parseWalletPublicKey,
  walletIdentity
};
