import assert from 'node:assert/strict';
import { createImportGeneration } from '../src/media-import-generation.js';

const imports = createImportGeneration();
const firstBatch = imports.capture();
assert.equal(imports.isCurrent(firstBatch), true, 'new import batch should start current');

const secondToken = imports.cancel();
assert.equal(secondToken, firstBatch + 1, 'cancel should advance the generation');
assert.equal(imports.isCurrent(firstBatch), false, 'previous in-flight import must become stale');

const nextBatch = imports.capture();
assert.equal(imports.isCurrent(nextBatch), true, 'new project imports should use the new generation');

// A multi-file selection keeps its original token: later files must not spill
// into a project opened while the first file was still loading.
const batchToken = imports.capture();
imports.cancel();
assert.equal(imports.isCurrent(batchToken), false, 'remaining files in an old batch must be rejected');
assert.equal(imports.isCurrent(imports.capture()), true, 'a fresh batch remains valid');

console.log('Media import generation tests passed.');
