import assert from 'node:assert/strict';
import { createProjectBundle, readProjectBundle } from '../src/project-bundle.js';

const project = {
  name: '测试商家项目',
  version: 2,
  width: 720,
  height: 1280,
  tracks: [],
  clips: [{ id: 'clip-001', type: 'image', name: '门店照片', startTime: 0, duration: 3 }],
  selectedClipId: 'clip-001'
};
const sourceBlob = new Blob(['小智视频项目素材校验'], { type: 'text/plain' });
const bundle = await createProjectBundle(project, [{
  clipId: 'clip-001',
  name: '门店照片.txt',
  type: 'text/plain',
  blob: sourceBlob
}]);
assert.equal(bundle.type, 'application/zip');
const restored = await readProjectBundle(bundle);
assert.equal(restored.project.name, project.name);
assert.equal(restored.project.width, 720);
assert.equal(restored.media.length, 1);
assert.equal(restored.media[0].clipId, 'clip-001');
assert.equal(restored.media[0].name, '门店照片.txt');
assert.equal(await restored.media[0].blob.text(), await sourceBlob.text());

const damaged = new Uint8Array(await bundle.arrayBuffer());
const marker = new TextEncoder().encode('小智视频项目素材校验');
let markerOffset = -1;
for (let i = 0; i <= damaged.length - marker.length; i++) {
  let match = true;
  for (let j = 0; j < marker.length; j++) {
    if (damaged[i + j] !== marker[j]) { match = false; break; }
  }
  if (match) { markerOffset = i; break; }
}
assert.notEqual(markerOffset, -1);
damaged[markerOffset] ^= 1;
await assert.rejects(() => readProjectBundle(new Blob([damaged])), /校验失败/);

const emptyBundle = await createProjectBundle(project, []);
const emptyRestored = await readProjectBundle(emptyBundle);
assert.equal(emptyRestored.media.length, 0);

console.log('项目包 ZIP 导入/导出往返测试通过');
