import assert from 'node:assert/strict';
import { getPhotoMotionKeyframes } from '../src/photo-motion.js';

const first = getPhotoMotionKeyframes(0, 1080, 1920, 2, 4);
assert.deepEqual(first.scale.map(k => k.value), [1.035, 1.075]);
assert.deepEqual(first.x.map(k => k.value), [-8.64, 8.64]);
assert.deepEqual(first.y.map(k => k.value), [0, 0]);
assert.deepEqual(first.scale.map(k => k.time), [2, 6]);

const second = getPhotoMotionKeyframes(1, 1080, 1920, 0, 5);
assert.deepEqual(second.scale.map(k => k.value), [1.075, 1.035]);
assert.deepEqual(second.x.map(k => k.value), [0, 0]);
assert.deepEqual(second.y.map(k => k.value), [-11.52, 11.52]);

const third = getPhotoMotionKeyframes(2, 1000, 1000, 1, 3);
assert.deepEqual(third.x.map(k => k.value), [8, -8]);
assert.deepEqual(third.y.map(k => k.value), [0, 0]);
for (const frame of [...first.scale, ...first.x, ...first.y]) {
  assert.ok(Number.isFinite(frame.value));
  assert.equal(frame.easing, 'easeInOut');
}

const invalid = getPhotoMotionKeyframes(Number.NaN, Number.NaN, Infinity, Number.NaN, Infinity);
for (const frame of [...invalid.scale, ...invalid.x, ...invalid.y]) {
  assert.ok(Number.isFinite(frame.time), 'invalid timing must not produce non-finite keyframe timestamps');
  assert.ok(Number.isFinite(frame.value), 'invalid dimensions must not produce non-finite motion values');
}
assert.deepEqual(invalid.scale.map(frame => frame.time), [0, 0]);
const negativeDuration = getPhotoMotionKeyframes(0, 720, 1280, 3, -4);
assert.deepEqual(negativeDuration.scale.map(frame => frame.time), [3, 3], 'negative duration should collapse safely to a zero-length motion interval');

console.log('Gentle photo motion tests passed.');
