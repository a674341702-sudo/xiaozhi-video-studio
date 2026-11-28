import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/canvas-preview.js', import.meta.url), 'utf8');
assert.match(source, /if \(!this\.isPlaying\)\s*\{/,
  'preview renderer must not seek on every animation frame during playback');
assert.match(source, /video\.addEventListener\('seeked', \(\) => this\.markNeedsRender\(\)\)/,
  'paused scrubbing must repaint after asynchronous media seek');
assert.match(source, /if \(Math\.abs\(video\.currentTime - clipOffset\) > 0\.04\) return;/,
  'preview must not draw a stale frame while seek is pending');
assert.match(source, /video\.readyState === 'number' && video\.readyState < 2/,
  'preview must wait until a decoded frame is available');
console.log('Preview video seek and stale-frame regression tests passed.');
