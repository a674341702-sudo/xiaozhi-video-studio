import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/auto-workflow.js', import.meta.url), 'utf8');
assert.match(source, /let captionsManuallyEdited = false;/);
assert.match(source, /xzw-captions'\)\.addEventListener\('input', \(\) => \{[\s\S]*?captionsManuallyEdited = true;[\s\S]*?invalidateProductionPreview\(\)/);
assert.match(source, /captionsManuallyEdited = false;/);
assert.match(source, /if \(!captionsManuallyEdited\)\s*\{[\s\S]*?makeCaptions\(profile, files\.length\)/);
console.log('Merchant generated caption refresh tests passed.');
