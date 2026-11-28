import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseURL = process.env.TTS_SMOKE_URL || 'http://127.0.0.1:4179/';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
try {
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error)));
  page.on('requestfailed', request => {
    if (new URL(request.url()).origin === new URL(baseURL).origin && /\\.(js|wasm|data)$/.test(new URL(request.url()).pathname)) {
      pageErrors.push('Local request failed: '+request.url()+' '+request.failure()?.errorText);
    }
  });

  await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.locator('#text').waitFor({ state: 'visible', timeout: 30000 });
  const generate = page.locator('#generateBtn');
  await page.waitForFunction(() => {
    const button = document.querySelector('#generateBtn');
    return button && !button.disabled;
  }, undefined, { timeout: 8 * 60 * 1000 });

  await page.locator('#text').fill('你好，欢迎来到小智视频。让每一家好店都被更多人看见。');
  await generate.click();
  const audio = page.locator('#sound-clips audio').first();
  await audio.waitFor({ state: 'attached', timeout: 5 * 60 * 1000 });
  await page.waitForFunction(() => {
    const element = document.querySelector('#sound-clips audio');
    return element && element.src.startsWith('blob:') && Number.isFinite(element.duration) && element.duration > 0;
  }, undefined, { timeout: 30000 });

  const audioCheck = await page.evaluate(async () => {
    const element = document.querySelector('#sound-clips audio');
    const response = await fetch(element.src);
    const bytes = new Uint8Array(await response.arrayBuffer());
    const ascii = (start, end) => String.fromCharCode(...bytes.slice(start, end));
    return {
      byteLength: bytes.length,
      riff: ascii(0, 4),
      wave: ascii(8, 12),
      sampleRate: new DataView(bytes.buffer).getUint32(24, true),
      channels: new DataView(bytes.buffer).getUint16(22, true),
      bitsPerSample: new DataView(bytes.buffer).getUint16(34, true),
      dataBytes: new DataView(bytes.buffer).getUint32(40, true),
      duration: element.duration,
      rms: (() => {
        const view = new DataView(bytes.buffer, 44);
        const count = Math.floor((bytes.length - 44) / 2);
        let sum = 0;
        for (let i = 0; i < count; i++) {
          const sample = view.getInt16(i * 2, true) / 32768;
          sum += sample * sample;
        }
        return count ? Math.sqrt(sum / count) : 0;
      })()
    };
  });
  assert.ok(audioCheck.byteLength > 44, 'Generated WAV is empty');
  assert.equal(audioCheck.riff, 'RIFF', 'Generated audio is not a RIFF WAV');
  assert.equal(audioCheck.wave, 'WAVE', 'Generated audio is not a WAV container');
  assert.ok(audioCheck.sampleRate >= 16000, 'Unexpected generated sample rate');
  assert.equal(audioCheck.channels, 1, 'Expected mono speech audio');
  assert.equal(audioCheck.bitsPerSample, 16, 'Expected 16-bit PCM WAV');
  assert.ok(audioCheck.dataBytes > 0, 'WAV contains no PCM samples');
  assert.ok(audioCheck.duration > 0, 'Generated audio duration is invalid');
  assert.ok(audioCheck.rms > 0.001, 'Generated WAV is silent or nearly silent');
  assert.deepEqual(pageErrors, [], 'Browser reported runtime or local asset errors');
  console.log('Chinese Matcha browser smoke test passed:', JSON.stringify(audioCheck));
} finally {
  await browser.close();
}
