import assert from 'node:assert/strict';
import { audioBufferToWav } from '../src/ffmpeg-worker.js';

function makeBuffer(length) {
  const left = new Float32Array(length);
  const right = new Float32Array(length);
  left.fill(0.5);
  right.fill(-0.5);
  return {
    length,
    numberOfChannels: 2,
    sampleRate: 48000,
    getChannelData(channel) { return channel === 0 ? left : right; }
  };
}

const wav = await audioBufferToWav(makeBuffer(16), undefined, 4);
assert.equal(wav.type, 'audio/wav');
assert.equal(wav.size, 44 + 16 * 4);
const header = new DataView(await wav.arrayBuffer());
assert.equal(String.fromCharCode(...new Uint8Array(header.buffer, 0, 4)), 'RIFF');
assert.equal(String.fromCharCode(...new Uint8Array(header.buffer, 8, 4)), 'WAVE');

const controller = new AbortController();
const pending = audioBufferToWav(makeBuffer(50000), controller.signal, 128);
setTimeout(() => controller.abort(), 0);
await assert.rejects(pending, error => error?.name === 'AbortError',
  'WAV conversion should stop when cancellation arrives between chunks');

console.log('Abortable WAV conversion tests passed.');
