/**
 * rugcheck.js
 *
 * RugCheck.xyz token audit integration.
 *
 * Used as a pre-flight safety check before executing any trade via Cletus.
 * Tokens that fail a minimum safety score threshold are blocked server-side
 * to protect users from known rug-pulls and honeypots.
 *
 * The RugCheck.xyz API is a paid operator service — its cost is offset by the
 * same fee-routing mechanism disclosed to users in the legal gate.
 */

const https = require('https');
const { RUGCHECK_API_KEY, RUGCHECK_MIN_SCORE, RUGCHECK_BLOCK_ON_ERROR } = require('./config');

const RUGCHECK_BASE = 'api.rugcheck.xyz';

/**
 * Fetch the RugCheck.xyz report for a Solana token mint address.
 *
 * @param {string} mintAddress  Solana token mint (base-58)
 * @returns {Promise<object>}   Raw RugCheck report object
 */
function fetchTokenReport(mintAddress) {
  if (!mintAddress || typeof mintAddress !== 'string') {
    return Promise.reject(new Error('mintAddress is required'));
  }

  return new Promise((resolve, reject) => {
    const path = '/v1/tokens/' + encodeURIComponent(mintAddress) + '/report/summary';
    const headers = { Accept: 'application/json' };
    if (RUGCHECK_API_KEY) {
      headers['Authorization'] = 'Bearer ' + RUGCHECK_API_KEY;
    }

    const reqOptions = {
      hostname: RUGCHECK_BASE,
      path,
      method: 'GET',
      headers
    };

    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 404) {
          return resolve({ unknown: true, mintAddress });
        }
        try {
          resolve(JSON.parse(data));
        } catch (_) {
          reject(new Error('rugcheck_response_parse_error'));
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.end();
  });
}

/**
 * Evaluate whether a token mint is safe to trade under the configured policy.
 *
 * @param {string} mintAddress  Solana token mint (base-58)
 * @returns {Promise<{ safe: boolean, score: number|null, risks: string[], raw: object }>}
 */
async function auditToken(mintAddress) {
  let raw;
  try {
    raw = await fetchTokenReport(mintAddress);
  } catch (err) {
    if (RUGCHECK_BLOCK_ON_ERROR) {
      return { safe: false, score: null, risks: ['RUGCHECK_UNAVAILABLE'], raw: null };
    }
    return { safe: true, score: null, risks: ['RUGCHECK_UNAVAILABLE_WARN'], raw: null };
  }

  if (raw.unknown) {
    return { safe: false, score: null, risks: ['TOKEN_NOT_INDEXED'], raw };
  }

  const score = typeof raw.score === 'number' ? raw.score : null;
  const risks = Array.isArray(raw.risks) ? raw.risks.map((r) => r.name || String(r)) : [];
  const safe = score !== null && score >= RUGCHECK_MIN_SCORE;

  return { safe, score, risks, raw };
}

module.exports = { auditToken, fetchTokenReport };
