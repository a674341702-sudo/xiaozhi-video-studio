import assert from 'node:assert/strict';
import { getClipPlaybackState } from '../src/keyframes.js';

const music = {
  startTime: 0, duration: 30, trimStart: 0, trimEnd: 30,
  loop: true, volume: 0.22,
  keyframes: { volume: [
    { time: 0, value: 0, easing: 'linear' },
    { time: 1, value: 0.22, easing: 'linear' },
    { time: 29, value: 0.22, easing: 'linear' },
    { time: 30, value: 0, easing: 'linear' }
  ]}
};
assert.deepEqual(getClipPlaybackState(music, 9, 8), {
  active: true, loop: true, sourceTime: 1, sourceEnded: false,
  volume: 0.22, timelineEnd: 30
});
assert.equal(getClipPlaybackState(music, 30, 8).active, false);
assert.equal(getClipPlaybackState(music, 0.5, 8).volume, 0.11);

const voice = { startTime: 2, duration: 5, trimStart: 1, trimEnd: 6, volume: 1 };
const voiceAt = getClipPlaybackState(voice, 4, 8);
assert.equal(voiceAt.active, true);
assert.equal(voiceAt.sourceTime, 3);
assert.equal(voiceAt.loop, false);
assert.equal(getClipPlaybackState(voice, 8, 8).sourceEnded, true);

const trimmedLoop = { startTime: 0, duration: 20, trimStart: 2, trimEnd: 6, loop: true };
assert.equal(getClipPlaybackState(trimmedLoop, 5, 10).sourceTime, 3);
assert.equal(getClipPlaybackState(trimmedLoop, 8, 10).sourceTime, 2);

console.log('Live preview audio sync tests passed.');

const boostedVoice = { startTime: 0, duration: 4, trimStart: 0, trimEnd: 4, volume: 1.5 };
assert.equal(getClipPlaybackState(boostedVoice, 2, 4).volume, 1.5, 'preview must preserve supported 150% narration gain');
const excessiveVoice = { ...boostedVoice, volume: 3 };
assert.equal(getClipPlaybackState(excessiveVoice, 2, 4).volume, 1.5, 'preview gain must use the same 150% safety cap as export');
const silentVoice = { ...boostedVoice, volume: -1 };
assert.equal(getClipPlaybackState(silentVoice, 2, 4).volume, 0, 'negative preview gain must be clamped to silence');
console.log('Preview/export narration gain parity tests passed.');
