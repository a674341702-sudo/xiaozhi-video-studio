import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, main, workflow, referenceStudio] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../src/main.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/auto-workflow.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/reference-video-studio.js', import.meta.url), 'utf8')
]);

const actions = [...html.matchAll(/data-home-action="([^"]+)"/g)].map(match => match[1]);
for (const action of ['viral', 'smart', 'materials', 'document', 'projects', 'editor']) {
  assert.ok(actions.includes(action), `主页缺少入口：${action}`);
}

for (const targetId of ['xzw-reference-studio', 'xzw-files', 'xzw-brief-file']) {
  assert.ok((workflow + referenceStudio).includes(`id="${targetId}"`), `工作台缺少目标控件：${targetId}`);
  assert.ok(main.includes(`'${targetId}'`), `主页入口没有关联目标控件：${targetId}`);
}

assert.match(main, /const modal = document\.getElementById\('xiaozhi-workflow'\)/,
  '主页入口必须直接查找工作台弹层');
assert.match(main, /modal\.classList\.add\('open'\)/,
  '主页入口必须直接打开工作台弹层');
assert.doesNotMatch(main, /launcher\.click\(\)/,
  '主页入口不能依赖隐藏的悬浮按钮模拟点击');

const handler = main.slice(main.indexOf('function bindHomeDashboard'), main.indexOf('// --- Initialization ---'));
assert.match(handler, /if \(action === 'materials'\)[\s\S]*?target\.click\(\)/,
  '商家素材入口必须在用户点击时调起文件选择器');
assert.match(handler, /else if \(action === 'document'\)[\s\S]*?target\.click\(\)/,
  '商家文档入口必须在用户点击时调起文件选择器');

assert.match(workflow, /initReferenceVideoStudio\(modal\)/, '参考视频研究室必须在工作台初始化时挂载');

console.log('主页入口回归测试通过：6个入口、工作台目标控件、直接打开弹层和手机文件选择器链路均已核对。');
