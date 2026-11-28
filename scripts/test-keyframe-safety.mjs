import assert from 'node:assert/strict';
import { evaluateKeyframes, getAnimatedValue } from '../src/keyframes.js';

const unsorted = [
  { time: 10, value: 100 },
  { time: 0, value: 0 },
  { time: 5, value: 50 }
];
const originalOrder = JSON.stringify(unsorted);
assert.equal(evaluateKeyframes({ opacity: unsorted }, 'opacity', 2.5), 25);
assert.equal(JSON.stringify(unsorted), originalOrder, 'evaluation must not mutate saved keyframe order');

const duplicateTimes = [
  { time: 0, value: 0 },
  { time: 2, value: 20 },
  { time: 2, value: 40 },
  { time: 4, value: 80 }
];
assert.equal(evaluateKeyframes({ x: duplicateTimes }, 'x', 2), 40, 'last duplicate timestamp wins');
assert.equal(evaluateKeyframes({ x: duplicateTimes }, 'x', 3), 60, 'duplicate timestamps must not create NaN interpolation');

const malformed = [
  null,
  { time: 'bad', value: 2 },
  { time: 1, value: Infinity },
  { time: 0, value: 0 },
  { time: 2, value: 20 }
];
assert.equal(evaluateKeyframes({ scale: malformed }, 'scale', 1), 10, 'invalid points are ignored');
assert.equal(evaluateKeyframes({ scale: [{ time: NaN, value: 1 }] }, 'scale', 1), null);
assert.equal(evaluateKeyframes({ scale: unsorted }, 'scale', NaN), null);
assert.equal(getAnimatedValue({ keyframes: { opacity: [{ time: 0, value: NaN }] } }, 'opacity', 1, 0.75), 0.75);

console.log('Keyframe immutability, duplicate timestamp and malformed-data tests passed.');
