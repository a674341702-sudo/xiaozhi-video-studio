import assert from 'node:assert/strict';
import { getPreciseMediaDuration, isUsableMediaDuration } from '../src/media-duration.js';

assert.equal(getPreciseMediaDuration(20.6), 20.6, 'keep fractional seconds');
assert.equal(getPreciseMediaDuration(20.04), 20.04, 'keep small fractional precision');
assert.equal(getPreciseMediaDuration(1), 1, 'keep whole seconds');
assert.equal(getPreciseMediaDuration(0), 10, 'use fallback for zero duration');
assert.equal(getPreciseMediaDuration(NaN), 10, 'use fallback for invalid duration');
assert.equal(getPreciseMediaDuration(Infinity), 10, 'use fallback for infinite duration');
assert.equal(getPreciseMediaDuration(-2, 7), 7, 'allow explicit safe fallback');
assert.equal(getPreciseMediaDuration(0, 0), 10, 'never return a non-positive duration');

console.log('media duration precision tests passed');

assert.equal(isUsableMediaDuration(0.25), true, 'accept a short but valid video');
assert.equal(isUsableMediaDuration(0), false, 'reject zero duration');
assert.equal(isUsableMediaDuration(NaN), false, 'reject unknown duration');
assert.equal(isUsableMediaDuration(Infinity), false, 'reject infinite duration');
assert.equal(isUsableMediaDuration(-1), false, 'reject negative duration');

import { readFileSync } from 'node:fs';

const mediaManagerSource = readFileSync(new URL('../src/media-manager.js', import.meta.url), 'utf8');
for (const mediaType of ['video', 'audio']) {
  assert.ok(mediaManagerSource.includes(`if (!isUsableMediaDuration(${mediaType}.duration))`),
    `${mediaType} imports must reject missing or invalid real duration`);
  assert.ok(mediaManagerSource.includes(`cleanupFailedMediaElement(${mediaType}, objectUrl, '${mediaType}')`),
    `${mediaType} imports must release failed elements and object URLs`);
}
assert.ok(mediaManagerSource.includes('getPreciseMediaDuration(audio.duration)'),
  'audio imports must use the verified duration rather than a guessed fallback');
assert.ok(!mediaManagerSource.includes('getPreciseMediaDuration(audio.duration, 10)'),
  'audio imports must not silently substitute a guessed ten-second duration');

assert.ok(mediaManagerSource.includes('const videoDimensions = validateImageDimensions(vW, vH)'),
  'video imports must validate decoded source dimensions before adding the clip');
assert.ok(mediaManagerSource.includes('if (!videoDimensions.valid)'),
  'video imports must reject extreme source dimensions');
assert.ok(mediaManagerSource.includes("cleanupFailedMediaElement(video, objectUrl, 'video')"),
  'rejected oversized videos must release the media element and object URL');

console.log('video/audio import duration guard contract tests passed');
