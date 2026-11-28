import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../src/style.css', import.meta.url), 'utf8');
const landscape = css.slice(css.indexOf('/* Compact phone landscape:'), css.indexOf('/* Very narrow phones:'));
const narrow = css.slice(css.indexOf('/* Very narrow phones:'));
assert.match(landscape, /orientation:\s*landscape/);
assert.match(landscape, /max-height:\s*520px/);
assert.match(landscape, /\.preview-badge\s*\{\s*display:\s*none/);
assert.match(landscape, /\.timeline-panel\s*\{[^}]*clamp\(82px,23dvh,112px\)/s);
assert.match(landscape, /\.editor-sidebar\s*\{[^}]*86dvh/s);
assert.match(narrow, /max-width:\s*380px/);
assert.match(narrow, /grid-template-columns:\s*repeat\(2,minmax\(0,1fr\)\)/);
assert.match(narrow, /\.preview-time-display\s*\{[^}]*text-overflow:\s*ellipsis/s);
console.log('Compact phone responsive layout tests passed.');
