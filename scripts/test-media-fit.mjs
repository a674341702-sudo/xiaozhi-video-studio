import assert from 'node:assert/strict';
import { getMediaDrawGeometry } from '../src/media-fit.js';

const contain = getMediaDrawGeometry(1920, 1080, 0, 0, 1080, 1920, 'contain');
assert.equal(contain.sx, 0);
assert.equal(contain.sy, 0);
assert.equal(contain.sw, 1920);
assert.equal(contain.sh, 1080);
assert.equal(contain.dx, 0);
assert.equal(contain.dw, 1080);
assert.equal(contain.dh, 607.5);
assert.equal(contain.dy, 656.25, '横版素材在竖屏中应完整居中');

const cover = getMediaDrawGeometry(1920, 1080, 0, 0, 1080, 1920, 'cover');
assert.equal(cover.dx, 0);
assert.equal(cover.dy, 0);
assert.equal(cover.dw, 1080);
assert.equal(cover.dh, 1920);
assert.equal(cover.sx, 656.25);
assert.equal(cover.sw, 607.5, 'cover 会裁切横版素材两侧');

const portrait = getMediaDrawGeometry(1080, 1920, 10, 20, 1080, 1920, 'contain');
assert.deepEqual(portrait, { sx: 0, sy: 0, sw: 1080, sh: 1920, dx: 10, dy: 20, dw: 1080, dh: 1920 });
console.log('素材完整画面适配测试通过');
