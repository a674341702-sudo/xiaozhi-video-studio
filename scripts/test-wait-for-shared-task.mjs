import assert from 'node:assert/strict';
import { waitForSharedTask } from '../src/wait-for-shared-task.js';

const controller = new AbortController();
let resolveShared;
const shared = new Promise(resolve => { resolveShared = resolve; });
const waiting = waitForSharedTask(shared, controller.signal);
controller.abort();
await assert.rejects(waiting, error => error?.name === 'AbortError');
resolveShared('background preload survives');
assert.equal(await shared, 'background preload survives');

const completed = await waitForSharedTask(Promise.resolve('ready'), new AbortController().signal);
assert.equal(completed, 'ready');

const alreadyAborted = new AbortController();
alreadyAborted.abort();
await assert.rejects(
  waitForSharedTask(Promise.resolve('unused'), alreadyAborted.signal),
  error => error?.name === 'AbortError'
);

console.log('Shared task cancellation tests passed.');
