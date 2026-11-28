import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(repoRoot, 'public', 'tts-models', 'manifest.json');
assert.ok(existsSync(manifestPath), 'TTS asset manifest is missing');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
assert.equal(manifest.schema_version, 1, 'Unsupported TTS manifest schema');
assert.ok(['not-ready', 'ready'].includes(manifest.status), 'Invalid TTS manifest status');
assert.ok(Array.isArray(manifest.assets), 'manifest.assets must be an array');

const ids = new Set();
const paths = new Set();
for (const asset of manifest.assets) {
  for (const key of ['id', 'path', 'bytes', 'sha256', 'license', 'source_url', 'mainland_verified']) {
    assert.ok(asset[key] !== undefined && asset[key] !== null && asset[key] !== '', 'Asset is missing '+key);
  }
  assert.ok(!ids.has(asset.id), 'Duplicate TTS asset id: '+asset.id);
  assert.ok(!paths.has(asset.path), 'Duplicate TTS asset path: '+asset.path);
  ids.add(asset.id); paths.add(asset.path);
  assert.ok(Number.isSafeInteger(asset.bytes) && asset.bytes > 0, 'Invalid byte count for '+asset.id);
  assert.match(asset.sha256, /^[a-f0-9]{64}$/i, 'Invalid SHA-256 for '+asset.id);
  assert.match(asset.source_url, /^https:\/\//i, 'Asset source must be HTTPS: '+asset.id);
  assert.equal(typeof asset.mainland_verified, 'boolean', 'mainland_verified must be boolean');
  const relative = asset.path;
  assert.ok(!relative.includes(String.fromCharCode(92)), 'Asset paths must use forward slashes: '+asset.path);
  assert.ok(relative.startsWith('public/tts-models/'), 'Asset must live under public/tts-models/: '+asset.path);
  assert.ok(!relative.split('/').includes('..') && !path.isAbsolute(relative), 'Unsafe asset path: '+asset.path);
  const absolute = path.resolve(repoRoot, relative);
  assert.ok(absolute.startsWith(path.join(repoRoot, 'public', 'tts-models')+path.sep), 'Asset path escapes TTS asset directory');
  assert.ok(existsSync(absolute), 'Missing TTS asset file: '+asset.path);
  const stat = statSync(absolute);
  assert.ok(stat.isFile(), 'TTS asset is not a regular file: '+asset.path);
  assert.equal(stat.size, asset.bytes, 'File size mismatch: '+asset.id);
  const digest = createHash('sha256').update(readFileSync(absolute)).digest('hex');
  assert.equal(digest, asset.sha256.toLowerCase(), 'SHA-256 mismatch: '+asset.id);
  assert.ok(asset.license.trim().length > 0, 'Missing license details: '+asset.id);
}
if (manifest.status === 'ready') {
  assert.ok(manifest.assets.length > 0, 'Ready manifest cannot be empty');
  assert.ok(manifest.assets.every(asset => asset.mainland_verified === true), 'Ready manifest contains unverified mainland assets');
}
if (manifest.status === 'not-ready') {
  console.log('TTS assets are intentionally disabled: no approved model/runtime files are registered.');
} else {
  console.log('Verified '+manifest.assets.length+' TTS asset files and SHA-256 hashes.');
}
