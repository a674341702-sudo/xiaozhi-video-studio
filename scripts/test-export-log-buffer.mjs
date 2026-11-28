import assert from 'node:assert/strict';
import { appendBoundedExportLog } from '../src/export-log-buffer.js';

const logs = [];
for (let i = 0; i < 1000; i++) appendBoundedExportLog(logs, 'log-' + i);
assert.equal(logs.length, 30);
assert.equal(logs[0], 'log-970');
assert.equal(logs.at(-1), 'log-999');
appendBoundedExportLog(logs, 'final', 5);
assert.equal(logs.length, 5);
assert.equal(logs[0], 'log-996');
assert.equal(logs.at(-1), 'final');
console.log('Bounded export log tests passed.');
