import assert from 'node:assert/strict';
import { getLocalStorageFailureMessage } from '../src/local-storage-diagnostics.js';

const quota = await getLocalStorageFailureMessage(
  { name: 'QuotaExceededError', message: 'The quota has been exceeded' },
  { usage: 95 * 1024 * 1024, quota: 100 * 1024 * 1024 }
);
assert.match(quota, /存储空间可能不足/);
assert.match(quota, /剩余空间约 5 MB/);
assert.match(quota, /完整项目包/);

const lowSpace = await getLocalStorageFailureMessage(
  { name: 'UnknownError', message: 'write failed' },
  { usage: 480 * 1024 * 1024, quota: 500 * 1024 * 1024 }
);
assert.match(lowSpace, /剩余空间约 20 MB/);

const generic = await getLocalStorageFailureMessage(
  { name: 'UnknownError', message: 'transaction aborted' },
  { usage: 10 * 1024 * 1024, quota: 500 * 1024 * 1024 }
);
assert.match(generic, /transaction aborted/);
assert.match(generic, /剩余空间约 490 MB/);

const noEstimate = await getLocalStorageFailureMessage(
  { name: 'QuotaExceededError', message: '' },
  null
);
assert.match(noEstimate, /存储空间可能不足/);

console.log('Local storage quota diagnostics tests passed.');
