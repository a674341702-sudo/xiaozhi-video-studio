import assert from 'node:assert/strict';
import { cleanupFailedMediaElement } from '../src/media-element-cleanup.js';

const originalRevoke = URL.revokeObjectURL;
const revoked = [];
URL.revokeObjectURL = value => revoked.push(value);
try {
  for (const type of ['video', 'audio', 'image']) {
    const calls = [];
    const element = {
      pause: () => calls.push('pause'),
      removeAttribute: name => calls.push('remove:' + name),
      load: () => calls.push('load')
    };
    cleanupFailedMediaElement(element, 'blob:' + type, type);
    assert.ok(calls.includes('remove:src'));
    assert.ok(calls.includes('load'));
    if (type !== 'image') assert.ok(calls.includes('pause'));
  }
  const broken = { removeAttribute() { throw new Error('test'); } };
  cleanupFailedMediaElement(broken, 'blob:broken', 'video');
  assert.deepEqual(revoked, ['blob:video', 'blob:audio', 'blob:image', 'blob:broken']);
} finally {
  URL.revokeObjectURL = originalRevoke;
}
console.log('Failed media import cleanup tests passed.');
