import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MAX_IMAGE_PIXELS, validateImageDimensions } from '../src/image-dimensions.js';

assert.equal(MAX_IMAGE_PIXELS, 40_000_000);
assert.deepEqual(validateImageDimensions(6000, 4000), {
  valid: true, pixels: 24_000_000, maxPixels: MAX_IMAGE_PIXELS
});
assert.equal(validateImageDimensions(8000, 5000).valid, true, 'exactly 40MP is allowed');
assert.equal(validateImageDimensions(8001, 5000).valid, false, 'images above 40MP are rejected');
assert.equal(validateImageDimensions(0, 4000).valid, false);
assert.equal(validateImageDimensions(-1, 4000).valid, false);
assert.equal(validateImageDimensions('not-a-number', 4000).valid, false);
assert.equal(validateImageDimensions(100, 100, 0).valid, false);

const source = readFileSync(new URL('../src/media-manager.js', import.meta.url), 'utf8');
assert.ok(source.includes("validateImageDimensions(img.naturalWidth, img.naturalHeight)"));
assert.ok(source.includes("import { cleanupFailedMediaElement } from './media-element-cleanup.js'"));
assert.ok(source.includes("cleanupFailedMediaElement(img, objectUrl, 'image')"));
assert.ok(source.includes('图片分辨率过高'));
console.log('Mobile image dimension and import cleanup tests passed.');
