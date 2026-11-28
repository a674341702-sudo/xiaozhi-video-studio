import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const start = source.indexOf('async function handleExport()');
const end = source.indexOf('\nfunction showProgress(', start);
assert.ok(start >= 0 && end > start, 'export handler must remain identifiable');
const handler = source.slice(start, end);
assert.match(handler, /isExporting = true/);
assert.match(handler, /exportAbortController = new AbortController\(\)/);
assert.match(handler, /catch \(err\)[\s\S]*?getExportErrorMessage\(err\)/);
assert.match(handler, /finally \{[\s\S]*?exportAbortController = null;[\s\S]*?isExporting = false;[\s\S]*?btnExport\.disabled = false/);
assert.ok(!handler.includes('composition.clear()'), 'failed export must preserve the editable timeline so the merchant can retry');
assert.match(handler, /progressCancelBtn\.disabled = true;[\s\S]*?progressCancelBtn\.textContent = '取消导出'/);
console.log('Export failure recovery and retry-state contract tests passed.');
