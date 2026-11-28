import assert from 'node:assert/strict';
import { createMp4Blob } from '../src/ffmpeg-worker.js';

const source = new Uint8Array([9, 1, 2, 3, 8]);
const view = source.subarray(1, 4);
const blob = createMp4Blob(view);
assert.equal(blob.type, 'video/mp4');
assert.deepEqual([...new Uint8Array(await blob.arrayBuffer())], [1, 2, 3]);
assert.throws(() => createMp4Blob(new Uint8Array()), /failed to produce output MP4/i);
console.log('MP4 Blob memory-path tests passed.');
