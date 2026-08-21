/**
 * heliusSend.js
 *
 * Sends a serialised Solana transaction through the operator's Helius RPC
 * endpoint with the `rebate-address` query parameter set to the configured
 * operator fee wallet.  Rebates are used to offset Helius RPC, Jupiter API,
 * Gemini AI, and database infrastructure costs incurred by the operator —
 * this is disclosed to users in the legal gate and Terms of Service before
 * any trading access is granted.
 */

const https = require('https');
const { URL } = require('url');

const { HELIUS_API_KEY, JUPITER_FEE_WALLET } = require('./config');

/**
 * @param {string} serializedTransaction  Base-64 encoded serialised transaction
 * @param {object} [options]
 * @param {boolean} [options.skipPreflight=true]
 * @param {string}  [options.preflightCommitment='processed']
 * @returns {Promise<object>}  Parsed JSON-RPC response body
 */
function sendTransactionViaHelius(serializedTransaction, options = {}) {
  const { skipPreflight = true, preflightCommitment = 'processed' } = options;

  if (!HELIUS_API_KEY) {
    return Promise.reject(new Error('HELIUS_API_KEY is not configured'));
  }
  if (typeof serializedTransaction !== 'string' || !serializedTransaction) {
    return Promise.reject(new Error('serializedTransaction must be a non-empty base-64 string'));
  }

  const rpcUrl = new URL(`https://mainnet.helius-rpc.com/`);
  rpcUrl.searchParams.set('api-key', HELIUS_API_KEY);
  rpcUrl.searchParams.set('rebate-address', JUPITER_FEE_WALLET);

  const body = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'sendTransaction',
    params: [
      serializedTransaction,
      { skipPreflight, preflightCommitment }
    ]
  });

  return new Promise((resolve, reject) => {
    const reqOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(rpcUrl.toString(), reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (_) {
          reject(new Error('helius_response_parse_error'));
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.write(body);
    req.end();
  });
}

module.exports = { sendTransactionViaHelius };
