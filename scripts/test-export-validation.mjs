import assert from 'node:assert/strict';
import { validateCompositionMedia } from '../src/ffmpeg-worker.js';

assert.throws(() => validateCompositionMedia({ clips: [] }), /还没有画面内容/);
assert.throws(() => validateCompositionMedia({ clips: [{ type: 'audio', startTime: 0, duration: 5, file: new Blob(['audio']) }] }), /还没有画面内容/);
assert.equal(validateCompositionMedia({ clips: [{ type: 'text', startTime: 0, duration: 3 }] }), true);

assert.equal(validateCompositionMedia({ clips: [{
  type: 'video', name: '门店视频', startTime: 0, duration: 5,
  element: { videoWidth: 1280, videoHeight: 720 }
}] }), true);

assert.equal(validateCompositionMedia({ clips: [{
  type: 'image', name: '门店照片', startTime: 0, duration: 5,
  element: { naturalWidth: 1200, naturalHeight: 800 }
}] }), true);

assert.equal(validateCompositionMedia({ clips: [{
  type: 'audio', name: '配乐', startTime: 0, duration: 5, file: new Blob(['audio'])
}] }), true);

assert.throws(() => validateCompositionMedia(null), /项目时间线数据无效/);
assert.throws(() => validateCompositionMedia({ clips: [{
  type: 'video', name: '丢失的视频', startTime: 0, duration: 5, element: null
}] }), /原始文件已丢失/);
assert.throws(() => validateCompositionMedia({ clips: [{
  type: 'image', name: '未加载的照片', startTime: 0, duration: 5,
  element: { naturalWidth: 0, naturalHeight: 0 }
}] }), /尚未加载/);
assert.throws(() => validateCompositionMedia({ clips: [{
  type: 'audio', name: '丢失的配音', startTime: 0, duration: 5
}] }), /缺少原始文件/);
assert.throws(() => validateCompositionMedia({ clips: [{
  type: 'image', name: '时间错误', startTime: -1, duration: 5,
  element: { naturalWidth: 100, naturalHeight: 100 }
}] }), /时间或时长无效/);
assert.throws(() => validateCompositionMedia({ clips: [{
  type: 'video', name: '时长错误', startTime: 0, duration: 0,
  element: { videoWidth: 100, videoHeight: 100 }
}] }), /时间或时长无效/);

console.log('Export media preflight validation tests passed.');
