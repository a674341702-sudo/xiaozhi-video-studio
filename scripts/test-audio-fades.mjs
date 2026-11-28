import assert from 'node:assert/strict';
import { getAudioFadeKeyframes } from '../src/audio-fades.js';

const music = getAudioFadeKeyframes(30, 0.12, 1.2, 1.2);
assert.deepEqual(music.map(point => point.time), [0, 1.2, 28.8, 30]);
assert.deepEqual(music.map(point => point.value), [0, 0.12, 0.12, 0]);

const voice = getAudioFadeKeyframes(12, 1, 0.18, 0.18);
assert.deepEqual(voice.map(point => point.time), [0, 0.18, 11.82, 12]);
assert.equal(voice[1].value, 1);

const short = getAudioFadeKeyframes(0.3, 0.7, 1.2, 1.2);
assert.deepEqual(short.map(point => point.time), [0, 0.1, 0.2, 0.3]);
assert.deepEqual(short.map(point => point.value), [0, 0.7, 0.7, 0]);

assert.deepEqual(getAudioFadeKeyframes(0, 1), []);
assert.deepEqual(getAudioFadeKeyframes(-2, 1), []);
assert.deepEqual(getAudioFadeKeyframes(2, 3).map(point => point.value), [0, 1.5, 1.5, 0], 'fade gain must clamp to the supported 150% maximum');
assert.deepEqual(getAudioFadeKeyframes(2, 1.2).map(point => point.value), [0, 1.2, 1.2, 0], 'narration gain above 100% must survive fade keyframes');
assert.deepEqual(getAudioFadeKeyframes(2, 1.5).map(point => point.value), [0, 1.5, 1.5, 0], 'maximum supported narration gain must survive fade keyframes');
assert.ok(getAudioFadeKeyframes(0.01, 0.5).every(point => Number.isFinite(point.time)));
console.log('音频淡入淡出关键帧测试通过');
