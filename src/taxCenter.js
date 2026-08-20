const TAX_DISCLAIMER = 'Educational only. Not legal or tax advice. Consult a qualified CPA/tax attorney.';

function toCsv(rows) {
  const header = 'timestamp,status,reasonCode,pair,inputMint,outputMint,amount,tradeSizeUsd,txSignature,side,quantity,priceUsd,realizedPnlUsd';
  const body = rows
    .map((r) => [
      r.timestamp || r.createdAt || '',
      r.status || '',
      r.reasonCode || '',
      r.pair || '',
      r.inputMint || '',
      r.outputMint || '',
      r.amount ?? '',
      r.tradeSizeUsd ?? '',
      r.txSignature || '',
      r.side || '',
      r.quantity ?? '',
      r.priceUsd ?? '',
      r.realizedPnlUsd ?? ''
    ].join(','))
    .join('\n');
  return `${header}${body ? `\n${body}` : ''}`;
}

function summarize(transactions) {
  const realized = transactions.reduce((sum, tx) => sum + (tx.realizedPnlUsd || 0), 0);
  const unrealized = transactions.reduce((sum, tx) => sum + (tx.unrealizedPnlUsd || 0), 0);
  return {
    realizedPnlUsd: realized,
    unrealizedPnlUsd: unrealized,
    mappingReferences: ['Form 8949', 'Schedule D'],
    disclaimer: TAX_DISCLAIMER
  };
}

module.exports = {
  TAX_DISCLAIMER,
  toCsv,
  summarize
};
