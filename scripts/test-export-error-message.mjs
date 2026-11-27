import assert from 'node:assert/strict';
import { getExportErrorMessage } from '../src/export-error-message.js';

assert.match(getExportErrorMessage(new Error('Out of memory')), /手机可用内存不足/);
assert.match(getExportErrorMessage(new Error('Unsupported codec')), /MP4（H.264）/);
assert.match(getExportErrorMessage(new Error('Video decode failed')), /无法正常读取/);
assert.match(getExportErrorMessage(new Error('SecurityError: canvas is tainted')), /浏览器安全限制/);
assert.match(getExportErrorMessage(new Error('FFmpeg load failed: Failed to fetch')), /导出引擎下载失败/);
assert.match(getExportErrorMessage(new Error('NetworkError when attempting to fetch resource')), /切换稳定网络/);
assert.equal(getExportErrorMessage(new Error('Unexpected worker error')), 'Unexpected worker error');
assert.match(getExportErrorMessage('allocation failed'), /手机可用内存不足/);
console.log('视频导出错误提示测试通过');
