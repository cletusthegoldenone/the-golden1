const crypto = require('crypto');

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

function decodeBase58(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('INVALID_BASE58');
  }

  let bytes = [0];
  for (const char of value.trim()) {
    const index = BASE58_ALPHABET.indexOf(char);
    if (index === -1) throw new Error('INVALID_BASE58');

    let carry = index;
    for (let i = 0; i < bytes.length; i += 1) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }

  let zeros = 0;
  while (zeros < value.length && value[zeros] === '1') zeros += 1;
  return Buffer.from([...new Array(zeros).fill(0), ...bytes.reverse()]);
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

function decodeSignature(signature) {
  if (!signature || typeof signature !== 'string') {
    throw new Error('AUTH_SIGNATURE_REQUIRED');
  }

  const trimmed = signature.trim();
  try {
    const buffer = Buffer.from(trimmed, 'base64');
    if (buffer.length > 0) return buffer;
  } catch (_) {
    // fall through
  }

  const decoded = decodeBase58(trimmed);
  if (!decoded.length) {
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
