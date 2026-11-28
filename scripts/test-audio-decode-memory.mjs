import assert from 'node:assert/strict';
import { decodeAudioData } from '../src/ffmpeg-worker.js';

const input = new ArrayBuffer(32);
let receivedInput = null;
let closeStarted = false;
let closeFinished = false;

class FakeAudioContext {
  async decodeAudioData(buffer) {
    receivedInput = buffer;
    return { duration: 1, sampleRate: 48000 };
  }
  async close() {
    closeStarted = true;
    await Promise.resolve();
    closeFinished = true;
  }
}

const decoded = await decodeAudioData(input, FakeAudioContext);
assert.equal(decoded.duration, 1);
assert.equal(receivedInput, input, 'decode should use the original buffer without a full-size slice copy');
assert.equal(closeStarted, true);
assert.equal(closeFinished, true, 'decoder context cleanup must finish before resolving');

console.log('Audio decode memory tests passed.');
