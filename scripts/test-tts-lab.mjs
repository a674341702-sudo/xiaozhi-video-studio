import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const html = readFileSync(new URL('../public/tts-lab/index.html', import.meta.url), 'utf8');
for (const token of [
  '中文配音实验室','WebAssembly.validate','Worker','AudioContext','indexedDB',
  'getDirectory','createObjectURL','revokeObjectURL','40*1024*1024',
  '不会联网下载模型','文件未上传','clearAudio','loadedmetadata',
  'player.addEventListener(\'error\'','file.size===0','暂不支持这个文件类型',
  '模型接入状态','尚未接入','待核验'
]) {
  assert.ok(html.includes(token), 'missing lab capability/privacy marker: '+token);
}
assert.ok(!/fetch\s*\(|XMLHttpRequest|https?:\/\//i.test(html), 'lab page must not fetch remote resources');
assert.ok(html.includes('audio/wav'), 'WAV/audio import control missing');
assert.ok(html.includes('file.size>40*1024*1024'), '40MB file-size guard missing');
assert.ok(html.includes('URL.revokeObjectURL(currentUrl)'), 'object URL cleanup missing'); 
console.log('TTS lab smoke checks passed');
