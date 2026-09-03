/**
 * rpcSend.js
 *
 * Sends a serialised Solana transaction through the configured Solana RPC
 * endpoint. When the endpoint is Helius-backed, the operator rebate address is
 * added automatically so Helius rebates can offset infrastructure costs.
 */

const https = require('https');
const { URL } = require('url');

const { SOLANA_SEND_RPC_URL, JUPITER_FEE_WALLET } = require('./config');

/**
 * @param {string} serializedTransaction  Base-64 encoded serialised transaction
 * @param {object} [options]
 * @param {boolean} [options.skipPreflight=true]
 * @param {string}  [options.preflightCommitment='processed']
 * @returns {Promise<object>}  Parsed JSON-RPC response body
 */
function sendTransactionViaRpc(serializedTransaction, options = {}) {
  const { skipPreflight = true, preflightCommitment = 'processed' } = options;

  if (typeof serializedTransaction !== 'string' || !serializedTransaction) {
    return Promise.reject(new Error('serializedTransaction must be a non-empty base-64 string'));
  }

  const rpcUrl = new URL(SOLANA_SEND_RPC_URL);
  if (rpcUrl.hostname.endsWith('helius-rpc.com')) {
    rpcUrl.searchParams.set('rebate-address', JUPITER_FEE_WALLET);
  }

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
          reject(new Error('rpc_response_parse_error'));
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.write(body);
    req.end();
  });
}

module.exports = { sendTransactionViaRpc };
