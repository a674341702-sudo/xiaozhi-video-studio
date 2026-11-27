import assert from 'node:assert/strict';
import { rethrowExportAbort } from '../src/ffmpeg-worker.js';

const abort = new Error('user cancelled');
abort.name = 'AbortError';
assert.throws(() => rethrowExportAbort(abort), error => error === abort && error.name === 'AbortError');
assert.doesNotThrow(() => rethrowExportAbort(new Error('decode failed')));
assert.doesNotThrow(() => rethrowExportAbort(null));
console.log('Export cancellation propagation tests passed.');
