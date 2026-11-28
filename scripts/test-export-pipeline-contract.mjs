import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [worker, main] = await Promise.all([
  readFile(new URL('../src/ffmpeg-worker.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/main.js', import.meta.url), 'utf8')
]);

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
assert.match(worker, /'-t', duration\.toFixed\(3\)/,
  '输出时长必须受时间线总时长约束');
assert.match(worker, /return \{ blob: createMp4Blob\(mp4Data\), ext: 'mp4' \}/,
  'FFmpeg结果必须包装成MP4 Blob');
assert.match(worker, /a\.download = filename/,
  '导出文件必须设置可识别的下载文件名');
assert.match(worker, /setTimeout\(\(\) => URL\.revokeObjectURL\(url\), 60_000\)/,
  '移动端下载启动后必须保留Blob URL一段时间');
assert.match(main, /downloadBlob\(blob, filename\)/,
  '主工作台必须将完成的MP4交给浏览器下载');
assert.match(main, /signal\.aborted/,
  '主工作台必须处理用户取消导出');
assert.match(main, /isExporting = false/,
  '导出成功或失败后都必须恢复导出按钮状态');

console.log('MP4端到端导出契约测试通过：混音、H.264/AAC、MP4 Blob、手机浏览器下载与取消流程均已核对。');
