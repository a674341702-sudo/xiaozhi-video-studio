import assert from 'node:assert/strict';
import { captureCanvasBlob } from '../src/abortable-canvas-blob.js';

const blob = new Blob(['frame'], { type: 'image/jpeg' });
const successful = await captureCanvasBlob({
  toBlob(callback, type, quality) {
    assert.equal(type, 'image/jpeg');
    assert.equal(quality, 0.8);
    callback(blob);
  }
}, 'image/jpeg', 0.8);
assert.equal(successful, blob);

const controller = new AbortController();
let completeCapture;
const pending = captureCanvasBlob({
  toBlob(callback) { completeCapture = callback; }
}, 'image/jpeg', 0.8, controller.signal);
controller.abort();
await assert.rejects(pending, error => error?.name === 'AbortError');
completeCapture(blob); // A late browser callback must not settle the promise twice.

const stalledCapture = captureCanvasBlob({
  toBlob() { /* Simulate a mobile browser that never calls the callback. */ }
}, 'image/jpeg', 0.8, undefined, 5);
await assert.rejects(stalledCapture, /画面帧超时/);

await assert.rejects(
  captureCanvasBlob({ toBlob() {} }, 'image/jpeg', 0.8, undefined, 0),
  /timeout must be a positive number/
);

const alreadyAborted = new AbortController();
alreadyAborted.abort();
await assert.rejects(
  captureCanvasBlob({ toBlob() { assert.fail('must not capture'); } }, 'image/jpeg', 0.8, alreadyAborted.signal),
  error => error?.name === 'AbortError'
);

console.log('Abortable canvas capture tests passed.');
