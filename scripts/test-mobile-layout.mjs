import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const mobile = css.slice(css.indexOf('@media (max-width: 700px)'), css.indexOf('/* Merchant project library */'));
assert.match(mobile, /\.add-media-btn\s*\{[^}]*min-height:\s*44px/s, 'mobile media actions must be thumb friendly');
assert.match(mobile, /\.transport-btn\s*\{[^}]*width:\s*44px/s, 'mobile transport buttons must be thumb friendly');
assert.match(mobile, /\.timeline-panel\s*\{[^}]*clamp\(112px,19dvh,156px\)/s, 'mobile timeline must scale with viewport height');
assert.match(mobile, /overflow-x:\s*auto/s, 'timeline must remain horizontally scrollable on mobile');
assert.match(mobile, /safe-area-inset-bottom/s, 'mobile tool drawer must respect device safe area');
assert.match(html, /id="btn-mobile-tools"[^>]*aria-controls="mobile-tools-panel"/, 'mobile tools launcher must be associated with its panel');
assert.match(html, /id="btn-mobile-tools-close"/, 'mobile tools drawer must have a close control');
assert.match(html, /backdrop\.addEventListener\('click',\s*\(\)\s*=>\s*setOpen\(false\)\)/, 'mobile tools drawer must close from backdrop');
console.log('Mobile layout regression tests passed.');
