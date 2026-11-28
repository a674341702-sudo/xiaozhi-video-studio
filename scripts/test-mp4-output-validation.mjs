import assert from 'node:assert/strict';
import { validateMp4Output } from '../src/mp4-output-validation.js';

function box(type, payload = [1, 2, 3, 4]) {
  const bytes = new Uint8Array(8 + payload.length);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, bytes.length, false);
  bytes.set([...type].map(char => char.charCodeAt(0)), 4);
  bytes.set(payload, 8);
  return bytes;
}
function join(...parts) {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

const ftyp = box('ftyp', [0x69, 0x73, 0x6f, 0x6d, 0, 0, 0, 0]);
const moov = box('moov');
const mdat = box('mdat');
const valid = join(ftyp, moov, mdat);
assert.equal(validateMp4Output(valid), true);
assert.equal(validateMp4Output(valid.subarray(0)), true);

assert.throws(() => validateMp4Output(new Uint8Array(0)), /长度不足/);
assert.throws(() => validateMp4Output(new Uint8Array(12)), /长度不足/);

const wrongType = valid.slice();
wrongType.set([0x6d, 0x6f, 0x6f, 0x76], 4);
assert.throws(() => validateMp4Output(wrongType), /MP4 文件标识/);

const tooLarge = valid.slice();
new DataView(tooLarge.buffer).setUint32(0, 999, false);
assert.throws(() => validateMp4Output(tooLarge), /容器长度异常/);

const invalidBrand = valid.slice();
invalidBrand.set([0, 0, 0, 0], 8);
assert.throws(() => validateMp4Output(invalidBrand), /编码标识无效/);

assert.throws(() => validateMp4Output(join(ftyp, mdat)), /缺少必要的视频索引/);
assert.throws(() => validateMp4Output(join(ftyp, moov)), /缺少必要的视频索引/);
assert.throws(() => validateMp4Output(join(ftyp, moov, new Uint8Array([0, 0, 0, 8]))), /容器结构不完整/);

console.log('MP4 output container structure validation tests passed.');
