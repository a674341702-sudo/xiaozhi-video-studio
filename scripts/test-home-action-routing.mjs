import assert from 'node:assert/strict';
import { HOME_ACTION_TARGETS } from '../src/home-action-targets.js';

assert.equal(HOME_ACTION_TARGETS.viral, 'xzw-shop', 'viral video entry must start the actual merchant workflow, not the optional reference-video study panel');
assert.equal(HOME_ACTION_TARGETS.smart, 'xzw-files');
assert.equal(HOME_ACTION_TARGETS.materials, 'xzw-files');
assert.equal(HOME_ACTION_TARGETS.document, 'xzw-brief-file');
assert.notEqual(HOME_ACTION_TARGETS.viral, 'xzw-reference-studio');

console.log('Home action routing tests passed.');
