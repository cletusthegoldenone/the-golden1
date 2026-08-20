const crypto = require('crypto');
const bs58 = require('bs58');

const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

function decodeBase58(value) {
  if (typeof value !== 'string' || !value.trim()) {
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
    const verifierKey = crypto.createPublicKey(normalized);
    const der = verifierKey.export({ format: 'der', type: 'spki' });
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

const ED25519_SIGNATURE_LENGTH = 64;

function decodeSignature(signature) {
  if (!signature || typeof signature !== 'string') {
    throw new Error('AUTH_SIGNATURE_REQUIRED');
  }

  const trimmed = signature.trim();

  // Only accept base64 if it decodes to exactly 64 bytes (ed25519 signature length).
  if (/^[A-Za-z0-9+/]*={0,2}$/.test(trimmed)) {
    const buffer = Buffer.from(trimmed, 'base64');
    if (buffer.length === ED25519_SIGNATURE_LENGTH) return buffer;
  }

  // Fall back to Base58 (also must be exactly 64 bytes).
  let decoded;
  try {
    decoded = decodeBase58(trimmed);
  } catch (_) {
    throw new Error('AUTH_SIGNATURE_INVALID');
  }
  if (decoded.length !== ED25519_SIGNATURE_LENGTH) {
    throw new Error('AUTH_SIGNATURE_INVALID');
  }
  return decoded;
}

module.exports = {
  decodeBase58,
  decodeSignature,
  parseWalletPublicKey,
  walletIdentity
};
