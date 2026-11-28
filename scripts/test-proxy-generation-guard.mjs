import assert from 'node:assert/strict';
import { isCurrentProxyGeneration } from '../src/proxy-generation-guard.js';

const cache = new Map();
const firstTask = { state: 'generating', url: null };
cache.set('blob:source', firstTask);
assert.equal(isCurrentProxyGeneration(cache, 'blob:source', firstTask), true);

cache.delete('blob:source');
assert.equal(isCurrentProxyGeneration(cache, 'blob:source', firstTask), false,
  'revoked generation must not restore its stale cache entry');

const secondTask = { state: 'generating', url: null };
cache.set('blob:source', secondTask);
assert.equal(isCurrentProxyGeneration(cache, 'blob:source', firstTask), false,
  'an older FFmpeg task must not overwrite a newer generation');
assert.equal(isCurrentProxyGeneration(cache, 'blob:source', secondTask), true);

console.log('Proxy generation guard tests passed.');
