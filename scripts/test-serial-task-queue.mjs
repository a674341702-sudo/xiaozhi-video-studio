import assert from 'node:assert/strict';
import { createSerialTaskQueue } from '../src/serial-task-queue.js';

const enqueue = createSerialTaskQueue();
const order = [];
let releaseFirst;
const firstGate = new Promise(resolve => { releaseFirst = resolve; });

const first = enqueue(async () => {
  order.push('first-start');
  await firstGate;
  order.push('first-end');
  return 'first-result';
});
const second = enqueue(async () => {
  order.push('second');
  return 'second-result';
});

await Promise.resolve();
assert.deepEqual(order, ['first-start'], 'second task must wait for the first task');
releaseFirst();
assert.equal(await first, 'first-result');
assert.equal(await second, 'second-result');
assert.deepEqual(order, ['first-start', 'first-end', 'second']);

// A failed save must not prevent a later save from executing.
await assert.rejects(() => enqueue(async () => { throw new Error('disk full'); }), /disk full/);
assert.equal(await enqueue(async () => 'recovered'), 'recovered');

console.log('Serial local save queue ordering and recovery tests passed.');
