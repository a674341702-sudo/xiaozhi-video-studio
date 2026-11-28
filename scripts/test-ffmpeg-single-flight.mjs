import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/ffmpeg-worker.js', import.meta.url), 'utf8');
assert.match(source, /let ffmpegLoadPromise = null;/);
assert.match(source, /if \(ffmpegLoadPromise\) \{/);
assert.match(source, /const instance = await ffmpegLoadPromise;/);
assert.match(source, /const pending = loadFFmpegInternal\(onProgress, abortSignal\);/);
assert.match(source, /if \(ffmpegLoadPromise === pending\) ffmpegLoadPromise = null;/);
assert.match(source, /async function loadFFmpegInternal\(onProgress, abortSignal\)/);
console.log('FFmpeg single-flight initialization tests passed.');
