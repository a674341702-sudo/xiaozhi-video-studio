import assert from 'node:assert/strict';
import { getSubtitleSafeLayout, wrapTextLines } from '../src/text-layout.js';

const ctx = { measureText: value => ({ width: Array.from(value).length * 10 }) };
assert.deepEqual(wrapTextLines(ctx, '昆明特色美食探店体验', 50, 3), ['昆明特色美', '食探店体', '验']);
assert.deepEqual(wrapTextLines(ctx, '第一行\n第二行', 100, 3), ['第一行', '第二行']);
assert.deepEqual(wrapTextLines(ctx, '这是一段非常非常长的中文宣传文案', 50, 2), ['这是一段非', '常…']);
const layout = getSubtitleSafeLayout(1080, 1920);
assert.equal(layout.x, 76);
assert.equal(layout.width, 929);
assert.equal(layout.height, 346);
assert.equal(layout.y + layout.height, 1574);
assert.ok(layout.y + layout.height <= 1920 * 0.82);
console.log('Subtitle text layout tests passed.');
