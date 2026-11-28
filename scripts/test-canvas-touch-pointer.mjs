import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/canvas-preview.js', import.meta.url), 'utf8');
const pointerBlock = source.slice(source.indexOf("this.canvas.addEventListener('pointerdown'"), source.indexOf('this._handlePointerMove ='));
assert.match(pointerBlock, /e\.isPrimary === false/, 'secondary touch pointers must not replace the active canvas gesture');
assert.match(pointerBlock, /e\.pointerType === 'touch' && e\.cancelable\) e\.preventDefault\(\)/, 'cancelable touch pointerdown must prevent page gestures');
assert.match(source, /this\.activePointerId !== e\.pointerId/, 'only the active pointer may move the selected canvas clip');
assert.match(source, /setPointerCapture\?\.\(e\.pointerId\)/, 'canvas should capture the active pointer when supported');
assert.match(source, /window\.addEventListener\('pointercancel', this\._handlePointerEnd\)/, 'cancelled canvas gestures must release the transform state');
console.log('Canvas touch pointer regression tests passed.');
