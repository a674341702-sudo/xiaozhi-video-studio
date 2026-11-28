import assert from 'node:assert/strict';
import { validateMp4Output } from '../src/mp4-output-validation.js';

const valid = new Uint8Array(24);
const view = new DataView(valid.buffer);
view.setUint32(0, 24, false);
valid.set([0x66, 0x74, 0x79, 0x70], 4); // ftyp
valid.set([0x69, 0x73, 0x6f, 0x6d], 8); // isom
view.setUint32(12, 0, false);
valid.set([0x69, 0x73, 0x6f, 0x6d, 0x61, 0x76, 0x63, 0x31], 16);
assert.equal(validateMp4Output(valid), true);
assert.equal(validateMp4Output(valid.subarray(0, 24)), true);

assert.throws(() => validateMp4Output(new Uint8Array(0)), /长度不足/);
assert.throws(() => validateMp4Output(new Uint8Array(12)), /长度不足/);
const wrongType = valid.slice();
wrongType.set([0x6d, 0x6f, 0x6f, 0x76], 4);
assert.throws(() => validateMp4Output(wrongType), /有效的 MP4 文件头/);
const tooLarge = valid.slice();
new DataView(tooLarge.buffer).setUint32(0, 99, false);
assert.throws(() => validateMp4Output(tooLarge), /有效的 MP4 文件头/);
const invalidBrand = valid.slice();
invalidBrand.set([0, 0, 0, 0], 8);
assert.throws(() => validateMp4Output(invalidBrand), /编码标识无效/);

console.log('MP4 output signature validation tests passed.');
