import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [tts, workflow, packageJson] = await Promise.all([
  readFile(new URL('../public/tts-lab.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/auto-workflow.js', import.meta.url), 'utf8'),
  readFile(new URL('../package.json', import.meta.url), 'utf8')
]);

const sizeGuard = tts.indexOf('if (blob.size > 40 * 1024 * 1024)');
const delivery = tts.indexOf("new BroadcastChannel('xiaozhi-tts-audio-v1')");
assert.ok(sizeGuard >= 0 && delivery > sizeGuard,
  '配音文件必须先检查40MB限制，再通过跨标签页通道发送');
assert.match(tts, /type: 'xiaozhi-tts-audio', blob, filename:/,
  '配音实验室必须发送约定的 WAV 消息');
assert.match(workflow, /new BroadcastChannel\('xiaozhi-tts-audio-v1'\)/,
  '商家工作台必须监听同一个配音通道');
assert.match(workflow, /data\.type !== 'xiaozhi-tts-audio'/,
  '工作台必须过滤无关消息');
assert.match(workflow, /pendingVoiceFile = file/,
  '尚未编排时间线时必须暂存配音文件');
assert.match(workflow, /pendingVoiceFile = null[\s\S]*xiaozhi-tts-audio-ack/,
  '配音成功导入后才能确认接收');
assert.match(workflow, /\$\('xzw-voice'\)\.files\?\.\[0\] \|\| pendingVoiceFile/,
  '自动编排必须使用已回传并暂存的配音');
const pkg = JSON.parse(packageJson);
assert.match(pkg.scripts.build, /test-tts-workflow-bridge\.mjs/,
  '配音跨页面回传测试必须纳入构建检查');

console.log('中文配音交付链路测试通过：文件大小边界、跨页面消息、暂存、确认和自动编排均已核对。');
