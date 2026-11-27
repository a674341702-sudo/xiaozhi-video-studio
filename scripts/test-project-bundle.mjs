import assert from 'node:assert/strict';
import { createProjectBundle, readProjectBundle } from '../src/project-bundle.js';

const project = {
  name: '测试商家项目',
  version: 2,
  width: 720,
  height: 1280,
  tracks: [],
  clips: [
    { id: 'clip-001', type: 'image', name: '门店照片', startTime: 0, duration: 3 },
    { id: 'clip-002', type: 'audio', name: '背景音乐', startTime: 0, duration: 3 }
  ],
  selectedClipId: 'clip-001'
};
const sourceBlob = new Blob(['小智视频项目素材校验'], { type: 'text/plain' });
const audioBlob = new Blob(['audio-bytes'], { type: 'audio/wav' });
const sourceMedia = [
  { clipId: 'clip-001', name: '门店照片.txt', type: 'text/plain', blob: sourceBlob },
  { clipId: 'clip-002', name: '背景音乐.wav', type: 'audio/wav', blob: audioBlob }
];
const bundle = await createProjectBundle(project, sourceMedia);
assert.equal(bundle.type, 'application/zip');
const restored = await readProjectBundle(bundle);
assert.equal(restored.project.name, project.name);
assert.equal(restored.project.width, 720);
assert.equal(restored.media.length, 2);
assert.equal(restored.media[0].clipId, 'clip-001');
assert.equal(restored.media[0].name, '门店照片.txt');
assert.equal(await restored.media[0].blob.text(), await sourceBlob.text());
assert.equal(await restored.media[1].blob.text(), await audioBlob.text());

await assert.rejects(
  () => createProjectBundle(project, [sourceMedia[0]]),
  /缺少素材文件/
);

function bytesOf(blob) {
  return blob.arrayBuffer().then(buffer => new Uint8Array(buffer));
}

function readU32(bytes, offset) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, true);
}

function readU16(bytes, offset) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(offset, true);
}

function writeU16(bytes, offset, value) {
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).setUint16(offset, value, true);
}

function findEndOffset(bytes) {
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (readU32(bytes, i) === 0x06054b50) return i;
  }
  throw new Error('test ZIP end record not found');
}

const damaged = await bytesOf(bundle);
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

const localNameMismatch = await bytesOf(bundle);
const firstLocalNameLength = readU16(localNameMismatch, 26);
assert.ok(firstLocalNameLength > 0);
localNameMismatch[30] ^= 1;
await assert.rejects(() => readProjectBundle(new Blob([localNameMismatch])), /文件名与目录文件名不一致/);

const duplicateCentralName = await bytesOf(bundle);
const endOffset = findEndOffset(duplicateCentralName);
const centralOffset = readU32(duplicateCentralName, endOffset + 16);
const manifestNameLength = readU16(duplicateCentralName, centralOffset + 28);
const mediaOneOffset = centralOffset + 46 + manifestNameLength;
const mediaOneLength = readU16(duplicateCentralName, mediaOneOffset + 28);
const mediaOneRecordLength = 46 + mediaOneLength + readU16(duplicateCentralName, mediaOneOffset + 30) + readU16(duplicateCentralName, mediaOneOffset + 32);
const mediaTwoOffset = mediaOneOffset + mediaOneRecordLength;
const mediaTwoLength = readU16(duplicateCentralName, mediaTwoOffset + 28);
assert.equal(mediaTwoLength, mediaOneLength);
duplicateCentralName.set(
  duplicateCentralName.slice(mediaOneOffset + 46, mediaOneOffset + 46 + mediaOneLength),
  mediaTwoOffset + 46
);
await assert.rejects(() => readProjectBundle(new Blob([duplicateCentralName])), /重复文件/);

const invalidPath = await bytesOf(bundle);
const pathEndOffset = findEndOffset(invalidPath);
const pathCentralOffset = readU32(invalidPath, pathEndOffset + 16);
const pathNameLength = readU16(invalidPath, pathCentralOffset + 28);
const traversal = new TextEncoder().encode('../' + 'x'.repeat(pathNameLength - 3));
invalidPath.set(traversal, pathCentralOffset + 46);
await assert.rejects(() => readProjectBundle(new Blob([invalidPath])), /不安全的文件路径/);

const invalidDirectoryCount = await bytesOf(bundle);
const countEndOffset = findEndOffset(invalidDirectoryCount);
writeU16(invalidDirectoryCount, countEndOffset + 8, 0);
await assert.rejects(() => readProjectBundle(new Blob([invalidDirectoryCount])), /分卷或多磁盘/);

const emptyProject = {
  name: '空项目',
  width: 720,
  height: 1280,
  clips: []
};
const emptyBundle = await createProjectBundle(emptyProject, []);
const emptyRestored = await readProjectBundle(emptyBundle);
assert.equal(emptyRestored.media.length, 0);

console.log('项目包往返、素材映射、CRC、路径、目录及本地文件头安全测试全部通过');
