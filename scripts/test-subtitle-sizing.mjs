import assert from 'node:assert/strict';
import { getSubtitleFontSize } from '../src/subtitle-sizing.js';

assert.equal(getSubtitleFontSize('欢迎光临', 1080), 49, 'short captions keep the standard size');
assert.equal(getSubtitleFontSize('a'.repeat(54), 1080), 49, 'captions within the base capacity keep standard size');
assert.ok(getSubtitleFontSize('字'.repeat(80), 1080) < 49, 'long captions reduce font size');
assert.equal(getSubtitleFontSize('字'.repeat(108), 1080), 30, 'very long captions reach the minimum readable ratio');
assert.equal(getSubtitleFontSize('字'.repeat(200), 720), 20, 'small canvases retain a practical minimum size');
assert.equal(getSubtitleFontSize('', 1080), 49, 'empty captions use the standard size');
assert.equal(getSubtitleFontSize('测试', 0), 18, 'invalid canvas width is safely clamped');

console.log('subtitle sizing tests passed');
