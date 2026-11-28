import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync(new URL('../.github/workflows/tts-wasm-experiment.yml', import.meta.url), 'utf8');
const doc = readFileSync(new URL('../docs/TTS_ON_DEVICE_SPIKE.md', import.meta.url), 'utf8');
const browserSmoke = readFileSync(new URL('./smoke-sherpa-tts-browser.mjs', import.meta.url), 'utf8');

for (const token of [
  'workflow_dispatch:',
  'k2-fsa/sherpa-onnx',
  '4ef1e51d7f177e426bf5e72243604b1249ec315c',
  'emsdk install 4.0.23',
  'matcha-icefall-zh-baker.tar.bz2',
  'ae70096b19c6e283ea351a26b8a718ce6427c8bde8c1da22eb46a5478d39a69b',
  'vocos-22khz-univ.onnx',
  'sha256sum -c',
  'modelType = 2',
  'sherpa-onnx-wasm-main-tts.wasm',
  'sherpa-onnx-wasm-main-tts.data',
  'OUT="build-wasm-simd-tts/install/bin/wasm/tts"',
  'assets && sha256sum -c',
  'timeout-minutes: 90',
  'for asset in model-steps-3.onnx tokens.txt lexicon.txt phone.fst date.fst number.fst; do',
  "find . -type f ! -name 'SHA256SUMS.txt' ! -name 'FILE_SIZES.txt' ! -name 'BUILD-NOTES.txt' -print0 | sort -z | xargs -0 sha256sum",
  'Install headless browser for real TTS smoke test',
  'playwright@1.52.0',
  'npx playwright install --with-deps chromium',
  'node scripts/smoke-sherpa-tts-browser.mjs',
  'actions/upload-artifact@v4',
  'retention-days: 7',
  'does NOT prove availability on mainland China networks',
  'Do not deploy this artifact to the production Pages site.'
]) assert.ok(workflow.includes(token), 'workflow missing required safety/build contract: '+token);

for (const token of [
  'modelType=2',
  '512MB',
  'piper-phonemize',
  '中国大陆',
  '商用范围',
  'workflow_dispatch'
]) assert.ok(doc.toLowerCase().includes(token.toLowerCase()), 'technical record missing: '+token);

assert.ok(!/uses:\s*[^\n]*(deploy-pages|gh-pages|cloudflare|vercel)/i.test(workflow), 'experimental workflow must not deploy');
console.log('Chinese Matcha WASM workflow contract tests passed.');
