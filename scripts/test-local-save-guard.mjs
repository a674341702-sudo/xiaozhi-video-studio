import assert from 'node:assert/strict';
import { shouldWarnBeforeProjectExit } from '../src/local-save-guard.js';

assert.equal(shouldWarnBeforeProjectExit({}), false);
assert.equal(shouldWarnBeforeProjectExit({ dirty: true }), true);
assert.equal(shouldWarnBeforeProjectExit({ timerActive: true }), true);
assert.equal(shouldWarnBeforeProjectExit({ inProgress: true }), true);
assert.equal(shouldWarnBeforeProjectExit({ pendingCount: 1 }), true);
assert.equal(shouldWarnBeforeProjectExit({ pendingCount: 2 }), true);
assert.equal(shouldWarnBeforeProjectExit({ dirty: false, timerActive: false, inProgress: false, pendingCount: 0 }), false);
assert.equal(shouldWarnBeforeProjectExit({ pendingCount: -1 }), false);

console.log('Unsaved project exit warning tests passed.');
