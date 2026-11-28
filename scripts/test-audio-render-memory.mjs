import assert from 'node:assert/strict';
import { getAudioRenderMemoryEstimate } from '../src/audio-render-memory.js';

const mib = 1024 * 1024;
assert.equal(getAudioRenderMemoryEstimate(1), 48000 * 2 * 4);
assert.equal(getAudioRenderMemoryEstimate(10), 10 * 48000 * 2 * 4);
assert.equal(getAudioRenderMemoryEstimate(1, 44100, 1), 44100 * 4);
assert.throws(() => getAudioRenderMemoryEstimate(0), /参数无效/);
assert.throws(() => getAudioRenderMemoryEstimate(-1), /参数无效/);
assert.throws(() => getAudioRenderMemoryEstimate(Number.MAX_VALUE), /时长过长/);
assert.ok(getAudioRenderMemoryEstimate(30) < 96 * mib, '30-second stereo render should fit the smallest supported device budget');
assert.ok(getAudioRenderMemoryEstimate(180) > 96 * mib, 'long audio should be rejected before allocation on low-memory devices');
console.log('Offline audio render memory estimate tests passed.');

import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../src/ffmpeg-worker.js', import.meta.url), 'utf8');
const preflight = source.indexOf('const estimatedAudioBytes = getAudioRenderMemoryEstimate(duration)');
const allocation = source.indexOf('audioBuffer = await renderMixedAudio');
assert.ok(preflight >= 0 && allocation > preflight, 'audio memory must be checked before OfflineAudioContext rendering');
assert.match(source, /assertFrameMemoryBudget\(0, estimatedAudioBytes, maxFrameBytes\)/);
console.log('Offline audio allocation preflight integration tests passed.');
