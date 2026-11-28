import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/auto-workflow.js', import.meta.url), 'utf8');
const keys = source.indexOf("const profileKeys = ['shop','industry','product','address','offer','copy','brief','style','length','cta'];");
const listeners = source.indexOf('profileKeys.forEach(key => {', keys);
assert.ok(keys >= 0 && listeners > keys, 'merchant profile fields must invalidate a previously approved production preview');
const profileBlock = source.slice(listeners, source.indexOf('const readProfile', listeners));
assert.match(profileBlock, /addEventListener\('input', invalidateProductionPreview\)/);
assert.match(profileBlock, /addEventListener\('change', invalidateProductionPreview\)/);
assert.match(profileBlock, /xzw-captions/);
assert.match(profileBlock, /captionsManuallyEdited = true/);
assert.match(profileBlock, /xzw-requirements/);
assert.match(profileBlock, /xzw-media-map/);
assert.match(profileBlock, /xzw-ratio/);
assert.match(profileBlock, /xzw-branded-outro/);
console.log('Merchant production preview invalidation tests passed.');
