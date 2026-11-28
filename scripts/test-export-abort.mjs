import assert from 'node:assert/strict';
import { rethrowExportAbort } from '../src/ffmpeg-worker.js';

const abort = new Error('user cancelled');
abort.name = 'AbortError';
assert.throws(() => rethrowExportAbort(abort), error => error === abort && error.name === 'AbortError');
assert.doesNotThrow(() => rethrowExportAbort(new Error('decode failed')));
assert.doesNotThrow(() => rethrowExportAbort(null));
console.log('Export cancellation propagation tests passed.');

const workerSource = await (await import('node:fs/promises')).readFile(new URL('../src/ffmpeg-worker.js', import.meta.url), 'utf8');
assert.match(workerSource, /abortSignal\.addEventListener\('abort', terminateEncoder, \{ once: true \}\);[\s\S]*?mp4Data = await encoder\.readFile\('export\.mp4'\);[\s\S]*?checkAborted\(\);/);
console.log('MP4 readback cancellation guard tests passed.');
