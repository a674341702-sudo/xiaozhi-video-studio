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

for (const targetId of ['xzw-shop', 'xzw-files', 'xzw-brief-file']) {
  const hasStaticId = (workflow + referenceStudio).includes(`id="${targetId}"`);
  const hasDynamicId = referenceStudio.includes(`section.id = '${targetId}'`);
  assert.ok(hasStaticId || hasDynamicId, `工作台缺少目标控件：${targetId}`);
  assert.ok(main.includes('HOME_ACTION_TARGETS[action]'), `主页入口没有使用集中路由配置：${targetId}`);
}

assert.match(main, /import \{ HOME_ACTION_TARGETS \} from '\.\/home-action-targets\.js';/, '主页入口必须使用可测试的路由配置');
assert.match(main, /const modal = document\.getElementById\('xiaozhi-workflow'\)/,
  '主页入口必须直接查找工作台弹层');
assert.match(main, /modal\.classList\.add\('open'\)/,
  '主页入口必须直接打开工作台弹层');
assert.doesNotMatch(main, /launcher\.click\(\)/,
  '主页入口不能依赖隐藏的悬浮按钮模拟点击');

const handler = main.slice(main.indexOf('function bindHomeDashboard'), main.indexOf('// --- Initialization ---'));
assert.match(handler, /if \(action === 'smart' \|\| action === 'materials'\)[\s\S]*?target\.click\(\)/,
  '素材智能成片和商家素材入口必须在用户点击时调起文件选择器');
assert.match(handler, /else if \(action === 'document'\)[\s\S]*?target\.click\(\)/,
  '商家文档入口必须在用户点击时调起文件选择器');

assert.match(workflow, /initReferenceVideoStudio\(modal\)/, '参考视频研究室必须在工作台初始化时挂载');
assert.match(workflow, /const closeWorkflow = \(\) => \{[\s\S]*?closeMediaPreview\(\);[\s\S]*?modal\.classList\.remove\('open'\);/, '关闭制作窗口必须同时停止素材预览');
assert.match(workflow, /modal\.querySelector\('\.xzw-close'\)\.addEventListener\('click', closeWorkflow\)/, '关闭按钮必须调用统一关闭逻辑');
assert.match(workflow, /document\.addEventListener\('keydown',[\s\S]*?event\.key !== 'Escape'[\s\S]*?closeWorkflow\(\)/, '手机键盘/返回键 Escape 必须能够关闭制作窗口');
assert.match(workflow, /if \(mediaPreview\.classList\.contains\('open'\)\) closeMediaPreview\(\)/, 'Escape 应优先关闭素材放大预览');


console.log('主页入口回归测试通过：6个入口、商家资料/素材/文档目标控件、直接打开弹层和手机文件选择器链路均已核对。');
