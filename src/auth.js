const crypto = require('crypto');
const { SESSION_SECRET, SESSION_TTL_SECONDS, SESSION_COOKIE_NAME } = require('./config');

function base64UrlEncode(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(value) {
  const padded = value + '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64').toString('utf8');
}

function sign(value) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(value).digest('base64url');
}

function createSessionToken(identity, now = Date.now()) {
  const payload = {
    sub: identity,
    iat: Math.floor(now / 1000),
    exp: Math.floor(now / 1000) + SESSION_TTL_SECONDS
  };
  const encoded = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(encoded);
  return `${encoded}.${signature}`;
}

function verifySessionToken(token, now = Date.now()) {
  if (!token || typeof token !== 'string') {
    return { ok: false, reasonCode: 'AUTH_REQUIRED' };
  }

  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { ok: false, reasonCode: 'AUTH_INVALID' };
  }

  const [payloadEncoded, signature] = parts;
  const expected = sign(payloadEncoded);
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);

  if (expectedBuffer.length !== signatureBuffer.length || !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)) {
    return { ok: false, reasonCode: 'AUTH_INVALID' };
  }

  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(payloadEncoded));
  } catch (_) {
    return { ok: false, reasonCode: 'AUTH_INVALID' };
  }

  if (!payload.sub || typeof payload.sub !== 'string') {
    return { ok: false, reasonCode: 'AUTH_INVALID' };
  }

  const nowSeconds = Math.floor(now / 1000);
  if (!Number.isFinite(payload.exp) || payload.exp <= nowSeconds) {
    return { ok: false, reasonCode: 'AUTH_EXPIRED' };
  }

  return { ok: true, identity: payload.sub };
}

function parseCookies(req) {
  const raw = req.headers.cookie || '';
  return raw.split(';').reduce((acc, pair) => {
    const index = pair.indexOf('=');
    if (index === -1) return acc;
    const key = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    if (key) acc[key] = value;
    return acc;
  }, {});
}

function tokenFromRequest(req) {
  const cookies = parseCookies(req);
  if (cookies[SESSION_COOKIE_NAME]) return cookies[SESSION_COOKIE_NAME];

  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length).trim();
  }

  return null;
}

function sessionCookie(token) {
  const maxAge = Math.max(1, Math.floor(SESSION_TTL_SECONDS));
  return `${SESSION_COOKIE_NAME}=${token}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${maxAge}`;
}

module.exports = {
  createSessionToken,
  verifySessionToken,
  tokenFromRequest,
  sessionCookie
};
