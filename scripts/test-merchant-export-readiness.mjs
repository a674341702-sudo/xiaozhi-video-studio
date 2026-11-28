import assert from 'node:assert/strict';
import { getMerchantExportReadiness } from '../src/merchant-export-readiness.js';

const ready = getMerchantExportReadiness({
  clips: [{ type: 'image', startTime: 0, duration: 5 }],
  duration: 5, width: 720, height: 1280
});
assert.deepEqual(ready, { ready: true, reason: '' });

for (const composition of [
  null,
  {},
  { clips: [], duration: 0, width: 720, height: 1280 },
  { clips: [{ type: 'audio', startTime: 0, duration: 5 }], duration: 5, width: 720, height: 1280 },
  { clips: [{ type: 'text', startTime: 0, duration: 5 }], duration: 5, width: 720, height: 1280 },
  { clips: [{ type: 'video', startTime: 0, duration: 0 }], duration: 5, width: 720, height: 1280 },
  { clips: [{ type: 'video', startTime: 0, duration: 5 }], duration: 0, width: 720, height: 1280 },
  { clips: [{ type: 'video', startTime: 0, duration: 5 }], duration: 5, width: 0, height: 1280 }
]) {
  assert.equal(getMerchantExportReadiness(composition).ready, false);
}
assert.match(getMerchantExportReadiness({ clips: [], duration: 0 }).reason, /上传照片或视频/);
console.log('Merchant export readiness tests passed.');
