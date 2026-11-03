// Peer companies for the Models page (api/model-data.js), from Yahoo's "recommended symbols" for a ticker.
// Shaped like the old FMP peers payload ({ peers: [{ symbol, peersList }] }) so the page needs no change.
const MAX_PEERS = 10;

function buildPeers(symbol, recommendation) {
  const self = String(symbol).toUpperCase();
  const list = recommendation && Array.isArray(recommendation.recommendedSymbols) ? recommendation.recommendedSymbols : [];
  const peersList = [];
  for (const item of list) {
    const peer = item && typeof item.symbol === 'string' ? item.symbol.toUpperCase() : null;
    if (!peer || peer === self || peersList.includes(peer)) continue;
    peersList.push(peer);
    if (peersList.length === MAX_PEERS) break;
  }
  return { peers: [{ symbol: self, peersList }] };
}

module.exports = { buildPeers };
