import assert from 'node:assert/strict';
import { getSequenceEdgeOpacity } from '../src/sequence-opacity.js';
const first = getSequenceEdgeOpacity(0, 3, 0, 4, 0.4);
assert.deepEqual(first, [
  { time: 0, value: 0, easing: 'easeOut' },
  { time: 0.4, value: 1, easing: 'easeInOut' }
]);
assert.equal(getSequenceEdgeOpacity(1, 3, 4, 4, 0.4), null);
assert.deepEqual(getSequenceEdgeOpacity(2, 3, 8, 4, 0.4), [
  { time: 8, value: 1, easing: 'easeInOut' },
  { time: 11.6, value: 1, easing: 'easeInOut' },
  { time: 12, value: 0, easing: 'easeIn' }
]);
assert.deepEqual(getSequenceEdgeOpacity(0, 1, 2, 4, 0.4), [
  { time: 2, value: 0, easing: 'easeOut' },
  { time: 2.4, value: 1, easing: 'easeInOut' },
  { time: 5.6, value: 1, easing: 'easeInOut' },
  { time: 6, value: 0, easing: 'easeIn' }
]);
assert.equal(getSequenceEdgeOpacity(0, 0, 0, 4, 0.4), null);
console.log('Sequence edge opacity tests passed.');
