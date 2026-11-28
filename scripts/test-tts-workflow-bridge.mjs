import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [workflow, worker, proxy, indexHtml, packageJson] = await Promise.all([
  readFile(new URL('../src/auto-workflow.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/ffmpeg-worker.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/proxy.js', import.meta.url), 'utf8'),
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../package.json', import.meta.url), 'utf8')
]);

assert.doesNotMatch(workflow, /tts-lab\.html|xzw-send-tts|Hugging Face|esm\.sh/i,
  '商家工作台不能再暴露依赖境外下载的旧配音实验室');
assert.match(workflow, /id="xzw-voice" type="file" accept="audio\/\*"/,
  '工作台必须保留本机录音或已有配音文件导入');
assert.match(workflow, /已停用需要境外下载的旧配音引擎/,
  '工作台必须清楚说明旧境外配音引擎已停用');
assert.doesNotMatch(worker, /unpkg\.com|jsdelivr\.net|Hugging Face|esm\.sh/i,
  '视频导出不能回退到境外 CDN');
assert.doesNotMatch(proxy, /unpkg\\.com|jsdelivr\\.net|Hugging Face|esm\\.sh/i,\n  '代理视频处理不能回退到境外 CDN');\nassert.doesNotMatch(indexHtml, /fonts\\.googleapis\\.com|fonts\\.gstatic\\.com/i,\n  '首页不能依赖境外字体服务');\nassert.match(worker, /本地视频导出组件加载失败/,
  '本地 FFmpeg 资源缺失时必须给出明确提示');

const pkg = JSON.parse(packageJson);
assert.match(pkg.scripts.build, /test-tts-workflow-bridge\.mjs/,
  '国内网络兼容检查必须纳入构建检查');

console.log('国内网络兼容检查通过：旧配音入口已停用、本地音频导入保留、FFmpeg 不再访问境外 CDN。');
