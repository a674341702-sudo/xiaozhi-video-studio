import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const worker = await readFile(new URL('../src/ffmpeg-worker.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../src/style.css', import.meta.url), 'utf8');

assert.match(html, /id="export-download-fallback"[^>]*hidden/);
assert.match(main, /const downloadUrl = downloadBlob\(blob, filename\)/);
assert.match(main, /downloadFallback\.href = downloadUrl/);
assert.match(main, /downloadFallback\.download = filename/);
assert.match(main, /downloadFallback\.hidden = false/);
assert.match(main, /5 \* 60 \* 1000/);
assert.match(worker, /return url;/);
assert.match(worker, /5 \* 60 \* 1000/);
assert.match(css, /\.export-download-fallback\s*\{/);
assert.match(css, /env\(safe-area-inset-bottom\)/);
console.log('Mobile export download fallback tests passed.');

assert.match(main, /let exportDownloadFallbackTimer = null/);
assert.match(main, /downloadFallback\.onclick = event =>/);
assert.match(main, /event\.preventDefault\(\)/);
assert.match(main, /const retryUrl = downloadBlob\(blob, filename\)/);
assert.match(main, /if \(exportDownloadFallbackTimer\) clearTimeout\(exportDownloadFallbackTimer\)/);
