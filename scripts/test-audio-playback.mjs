import assert from 'node:assert/strict';
import { getAudioClipPlaybackRange } from '../src/ffmpeg-worker.js';

assert.deepEqual(getAudioClipPlaybackRange({ startTime: 0, duration: 30 }, 8, 30),
  { start: 0, offset: 0, duration: 8, loop: false, loopStart: 0, loopEnd: 0 });
assert.deepEqual(getAudioClipPlaybackRange({ startTime: 0, duration: 30, loop: true }, 8, 30),
  { start: 0, offset: 0, duration: 30, loop: true, loopStart: 0, loopEnd: 8 });
assert.deepEqual(getAudioClipPlaybackRange({ startTime: 2, trimStart: 1, trimEnd: 4, duration: 30, loop: true }, 8, 30),
  { start: 2, offset: 1, duration: 28, loop: true, loopStart: 1, loopEnd: 4 });
assert.deepEqual(getAudioClipPlaybackRange({ startTime: 2, trimStart: 1, trimEnd: 4, duration: 30 }, 8, 30),
  { start: 2, offset: 1, duration: 3, loop: false, loopStart: 0, loopEnd: 0 });
assert.deepEqual(getAudioClipPlaybackRange({ startTime: 4, duration: 30 }, 8, 30),
  { start: 4, offset: 0, duration: 8, loop: false, loopStart: 0, loopEnd: 0 });
assert.equal(getAudioClipPlaybackRange({ startTime: 30, duration: 5, loop: true }, 8, 30), null);
assert.equal(getAudioClipPlaybackRange({ startTime: 0, duration: 5, trimStart: 8 }, 8, 30), null);
assert.equal(getAudioClipPlaybackRange({ startTime: 0, duration: 0 }, 8, 30), null);
assert.equal(getAudioClipPlaybackRange({ startTime: 0, duration: 5 }, 0, 30), null);

console.log('Audio playback range and background music loop tests passed.');
