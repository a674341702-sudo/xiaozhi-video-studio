import assert from 'node:assert/strict';
import { getDefaultExportFrameBudget } from '../src/export-memory-budget.js';

const mib = 1024 * 1024;
assert.equal(getDefaultExportFrameBudget(undefined), 160 * mib, 'unknown device memory should use a conservative mobile budget');
assert.equal(getDefaultExportFrameBudget(0), 160 * mib);
assert.equal(getDefaultExportFrameBudget(2), 96 * mib);
assert.equal(getDefaultExportFrameBudget(3), 128 * mib);
assert.equal(getDefaultExportFrameBudget(4), 160 * mib);
assert.equal(getDefaultExportFrameBudget(8), 256 * mib);
assert.equal(getDefaultExportFrameBudget(16), 256 * mib);
assert.equal(getDefaultExportFrameBudget(undefined, false), 768 * mib, 'desktop override should retain the larger budget');
console.log('Device-aware export memory budget tests passed.');

import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../src/ffmpeg-worker.js', import.meta.url), 'utf8');
assert.match(source, /getDefaultExportFrameBudget\(deviceMemory, options\.mobileSafe !== false\)/);
console.log('Device-aware export memory budget integration tests passed.');
