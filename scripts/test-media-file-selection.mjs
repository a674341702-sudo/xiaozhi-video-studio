import assert from 'node:assert/strict';
import { takeSelectedFiles, isSupportedReferenceVideoFile } from '../src/media-file-selection.js';

const selected = [
  { name: '门店照片1.jpg', size: 1024 },
  { name: '门店照片2.jpg', size: 2048 },
  { name: '门店照片3.jpg', size: 3072 }
];
let liveFiles = selected;
const input = {
  get files() { return liveFiles; },
  set value(value) {
    assert.equal(value, '', 'picker should be reset after snapshot');
    liveFiles = [];
  }
};

const snapshot = takeSelectedFiles(input);
assert.deepEqual(snapshot, selected);
assert.equal(snapshot.length, 3);
assert.equal(liveFiles.length, 0, 'test picker simulates a live FileList cleared by input reset');
assert.notEqual(snapshot, liveFiles, 'snapshot must be independent from the picker FileList');

assert.equal(isSupportedReferenceVideoFile({ name: 'reference.mp4', type: 'application/octet-stream' }), true);
assert.equal(isSupportedReferenceVideoFile({ name: 'reference.mov', type: '' }), true);
assert.equal(isSupportedReferenceVideoFile({ name: 'reference.webm', type: 'video/webm' }), true);
assert.equal(isSupportedReferenceVideoFile({ name: 'reference.avi', type: 'application/octet-stream' }), false);

console.log('Mobile multi-file picker and Android reference-video fallback tests passed.');
