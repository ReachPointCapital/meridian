const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildPeers } = require('../api/_peers');

test('peers come back in the shape the Models page reads: { peers: [{ symbol, peersList }] }', () => {
  const rec = { symbol: 'AAPL', recommendedSymbols: [{ symbol: 'AMZN', score: 0.18 }, { symbol: 'TSLA', score: 0.17 }] };
  assert.deepEqual(buildPeers('aapl', rec), { peers: [{ symbol: 'AAPL', peersList: ['AMZN', 'TSLA'] }] });
});

test('the company itself and duplicates are dropped, and the list is capped at 10', () => {
  const many = Array.from({ length: 15 }, (_, i) => ({ symbol: String.fromCharCode(66 + i), score: 1 - i / 100 }));
  const rec = { recommendedSymbols: [{ symbol: 'AAPL', score: 1 }, { symbol: 'B', score: 0.5 }, ...many] };
  const { peers } = buildPeers('AAPL', rec);
  assert.equal(peers[0].peersList.length, 10);
  assert.ok(!peers[0].peersList.includes('AAPL'));
  assert.equal(new Set(peers[0].peersList).size, 10);
});

test('an unknown company or an empty answer still returns the same shape', () => {
  assert.deepEqual(buildPeers('ZZZ', undefined), { peers: [{ symbol: 'ZZZ', peersList: [] }] });
  assert.deepEqual(buildPeers('ZZZ', { recommendedSymbols: [null, {}, { symbol: 7 }] }), { peers: [{ symbol: 'ZZZ', peersList: [] }] });
});
