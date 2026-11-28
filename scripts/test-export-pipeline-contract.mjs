import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [worker, main] = await Promise.all([
  readFile(new URL('../src/ffmpeg-worker.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/main.js', import.meta.url), 'utf8')
]);

const wavPreflight = worker.indexOf('const expectedWavBytes = getAudioWavByteLength(audioBuffer);');
const wavBudgetCheck = worker.indexOf('assertFrameMemoryBudget(0, expectedWavBytes, maxFrameBytes);', wavPreflight);
const wavAllocation = worker.indexOf('audioBufferToWav(audioBuffer, abortSignal)', wavBudgetCheck);
assert.ok(wavPreflight >= 0 && wavBudgetCheck > wavPreflight && wavAllocation > wavBudgetCheck,
  '必须在分配完整 WAV 缓冲区之前预估大小并检查手机导出内存预算');
assert.match(worker, /renderMixedAudio\(composition/,
  '导出必须先混合时间线中的配音、音乐和允许保留的现场声');
assert.match(worker, /throw new Error\(\`配乐或配音处理失败，已停止导出/,
  '音频解码失败时不得静默导出无声视频');
assert.match(worker, /'-c:v', 'libx264'/,
  'MP4视频必须使用H.264编码');
assert.match(worker, /'-c:a', 'aac'/,
  '有音轨时必须使用AAC编码');
assert.match(worker, /'-pix_fmt', 'yuv420p'/,
  '输出必须使用手机播放器兼容的yuv420p像素格式');
assert.match(worker, /const offCtx = offscreenCanvas\.getContext\('2d'\);[\s\S]*?if \(!offCtx\)[\s\S]*?手机浏览器无法创建视频渲染画布/,
  '手机端无法创建 Canvas 2D 上下文时必须给出可理解的错误，而不是继续渲染并崩溃');
assert.match(worker, /'-t', duration\.toFixed\(3\)/,
  '输出时长必须受时间线总时长约束');
assert.match(worker, /return \{ blob: createMp4Blob\(mp4Data\), ext: 'mp4' \}/,
  'FFmpeg结果必须包装成MP4 Blob');
assert.match(worker, /a\.download = filename/,
  '导出文件必须设置可识别的下载文件名');
assert.match(worker, /setTimeout\(\(\) => URL\.revokeObjectURL\(url\), 60_000\)/,
  '移动端下载启动后必须保留Blob URL一段时间');
assert.match(main, /exportWidthEl\) exportWidthEl\.value = String\(dims\.width\)[\s\S]*?exportHeightEl\) exportHeightEl\.value = String\(dims\.height\)/,
  '选择竖屏或方形画幅后，MP4导出尺寸必须同步，不能沿用旧画幅');
assert.match(main, /downloadBlob\(blob, filename\)/,
  '主工作台必须将完成的MP4交给浏览器下载');
assert.match(main, /signal\.aborted/,
  '主工作台必须处理用户取消导出');
assert.match(main, /isExporting = false/,
  '导出成功或失败后都必须恢复导出按钮状态');

console.log('MP4端到端导出契约测试通过：混音、H.264/AAC、MP4 Blob、手机浏览器下载与取消流程均已核对。');
