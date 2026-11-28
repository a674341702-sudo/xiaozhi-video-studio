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
assert.match(workflow, /id="xzw-record-start"/,
  '工作台必须提供手机端直接录音入口');
assert.match(workflow, /id="xzw-record-stop"/,
  '工作台必须提供停止录音并使用的入口');
assert.match(workflow, /navigator\.mediaDevices\?\.getUserMedia/,
  '录音必须使用浏览器本机麦克风能力');
assert.match(workflow, /echoCancellation: true, noiseSuppression: true, autoGainControl: true/,
  '录音应请求浏览器基础回声与噪声抑制');
assert.match(workflow, /new File\(\[blob\], '小智手机录音\.'/,
  '录音结果必须进入现有配音文件导入流程');
assert.match(workflow, /URL\.revokeObjectURL\(voicePreviewUrl\)/,
  '录音试听 URL 必须在清理时释放，避免手机内存泄漏');
assert.match(workflow, /window\.isSecureContext/,
  '录音前必须检查 HTTPS 安全上下文');
assert.match(workflow, /formatVoiceRecordingTime/,
  '手机录音必须显示易读的录音计时');
assert.match(workflow, /voiceRecordingTimer = setInterval/,
  '录音计时必须在录音期间持续刷新');
assert.match(workflow, /stopVoiceRecordingTimer\(\)/,
  '录音结束、失败或关闭工作台时必须清理计时器');
const recorderErrorHandler = workflow.match(/voiceRecorder\.onerror = \(\) => \{([\s\S]*?)\n      \};/);
assert.ok(recorderErrorHandler, '必须定义录音错误处理器');
assert.match(recorderErrorHandler[1], /stopVoiceRecordingTimer\(\)/,
  '录音错误时必须停止计时器');
assert.match(recorderErrorHandler[1], /stopVoiceTracks\(\)/,
  '录音错误时必须释放麦克风轨道');
assert.match(recorderErrorHandler[1], /voiceRecorder\.onstop = null/,
  '录音错误后必须阻止后续 onstop 保存不完整音频');
assert.match(recorderErrorHandler[1], /voiceChunks = \[\]/,
  '录音错误后必须清空未完成的音频分片');
assert.match(recorderErrorHandler[1], /xzw-record-start'\)\.disabled = false/,
  '录音错误后必须重新启用开始录音按钮');
assert.match(recorderErrorHandler[1], /xzw-record-stop'\)\.disabled = true/,
  '录音错误后必须禁用停止录音按钮');
assert.match(workflow, /40 \* 1024 \* 1024/,
  '录音文件必须限制在手机端40MB以内');
assert.match(workflow, /已停用需要境外下载的旧配音引擎/,
  '工作台必须清楚说明旧境外配音引擎已停用');
assert.doesNotMatch(worker, /unpkg\.com|jsdelivr\.net|Hugging Face|esm\.sh/i,
  '视频导出不能回退到境外 CDN');
assert.doesNotMatch(proxy, /unpkg\.com|jsdelivr\.net|Hugging Face|esm\.sh/i,
  '代理视频处理不能回退到境外 CDN');
assert.doesNotMatch(indexHtml, /fonts\.googleapis\.com|fonts\.gstatic\.com/i,
  '首页不能依赖境外字体服务');
assert.match(worker, /本地视频导出组件加载失败/,
  '本地 FFmpeg 资源缺失时必须给出明确提示');

const pkg = JSON.parse(packageJson);
assert.match(pkg.scripts.build, /test-tts-workflow-bridge\.mjs/,
  '国内网络兼容检查必须纳入构建检查');

console.log('国内网络兼容检查通过：旧配音入口已停用、本地音频导入保留、FFmpeg 不再访问境外 CDN。');
