import assert from 'node:assert/strict';
import { assertProjectMediaComplete } from '../src/project-media-integrity.js';

const project = {
  clips: [
    { id: 'photo-1', type: 'image', name: '门店照片' },
    { id: 'music-1', type: 'audio', name: '背景音乐' },
    { id: 'title-1', type: 'text', name: '字幕' }
  ]
};
const media = [
  { clipId: 'photo-1', blob: new Blob(['photo']) },
  { clipId: 'music-1', blob: new Blob(['music']) }
];
assert.equal(assertProjectMediaComplete(project, media), true);

assert.throws(
  () => assertProjectMediaComplete(project, [media[0]]),
  /背景音乐.*无法读取/
);
assert.throws(
  () => assertProjectMediaComplete(project, [
    ...media,
    { clipId: 'photo-1', blob: new Blob(['duplicate']) }
  ]),
  /无效/
);
assert.throws(
  () => assertProjectMediaComplete(project, [
    ...media,
    { clipId: 'orphan', blob: new Blob(['orphan']) }
  ]),
  /不匹配/
);
assert.throws(
  () => assertProjectMediaComplete(project, [
    { clipId: 'photo-1', blob: new Blob([]) },
    media[1]
  ]),
  /无效/
);
assert.equal(assertProjectMediaComplete({ clips: [] }, []), true);

console.log('Project autosave media-integrity tests passed.');
