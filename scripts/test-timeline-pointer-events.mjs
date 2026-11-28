import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/multi-timeline.js', import.meta.url), 'utf8');
const styles = await readFile(new URL('../src/style.css', import.meta.url), 'utf8');

assert.match(source, /rulerWrapper\.addEventListener\('pointerdown'/, 'ruler scrubbing must use Pointer Events');
assert.match(source, /e\.isPrimary === false/, 'secondary touch pointers must not start timeline gestures');
assert.equal((source.match(/if \(e\.cancelable\) e\.preventDefault\(\);/g) || []).length, 2, 'clip move and trim gestures must suppress native browser drag/selection');
assert.match(source, /tracksContent\.addEventListener\('pointerdown'/, 'clip drag and trim must use Pointer Events');
assert.match(source, /window\.addEventListener\('pointermove'/, 'active gestures must continue outside the original element');
assert.match(source, /window\.addEventListener\('pointerup'/, 'active gestures must finish on pointer up');
assert.match(source, /window\.addEventListener\('pointercancel'/, 'interrupted touch gestures must be cleaned up');
assert.match(source, /e\.pointerId === this\.dragTarget\.pointerId/, 'only the initiating pointer may move a clip');
assert.match(source, /e\.pointerId === this\.scrubPointerId/, 'only the initiating pointer may move the playhead');
assert.doesNotMatch(source, /addEventListener\('(mousedown|mousemove|mouseup)'/, 'legacy mouse-only drag handlers must not remain');
assert.match(styles, /\.mt-clip[\s\S]*?touch-action:\s*none/, 'clip gestures must not be hijacked by browser touch scrolling');
assert.match(styles, /\.multitimeline-ruler-wrapper[\s\S]*?touch-action:\s*none/, 'ruler scrubbing must be touch-friendly');

console.log('Timeline Pointer Events regression tests passed.');
