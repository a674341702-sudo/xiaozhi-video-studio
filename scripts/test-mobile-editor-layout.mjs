import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../src/style.css', import.meta.url), 'utf8');

assert.match(html, /id="btn-mobile-tools"/, 'mobile tools entry must be available in the editor header');
assert.match(html, /id="mobile-tools-panel"/, 'the original editor sidebar must remain the mobile tools panel');
assert.match(html, /id="btn-mobile-tools-close"/, 'mobile tools panel must have a close control');
assert.match(html, /id="mobile-tools-backdrop"/, 'mobile tools panel must have a dismissible backdrop');
assert.match(html, /aria-expanded/, 'mobile tools toggle must expose its expanded state');
assert.match(css, /#btn-mobile-tools, \.mobile-tools-header, \.mobile-tools-backdrop \{ display:none; \}/, 'mobile-only controls must be hidden on desktop');
assert.match(css, /body\.mobile-tools-open \.editor-sidebar \{ display:flex !important; \}/, 'mobile drawer must expose the complete original sidebar');
assert.match(css, /height:min\(74dvh,680px\)/, 'mobile tools drawer must fit within the phone viewport');
assert.match(css, /env\(safe-area-inset-bottom/, 'mobile drawer must respect device safe areas');
assert.match(css, /\.transport-btn \{ width:40px; height:40px; \}/, 'transport controls must have touch-friendly targets');
console.log('Responsive mobile editor layout tests passed.');
