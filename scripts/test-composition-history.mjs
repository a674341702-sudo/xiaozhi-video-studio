import assert from 'node:assert/strict';
import { Composition } from '../src/composition.js';

const composition = new Composition(720, 1280);
assert.equal(composition.history.stack.length, 1, 'initial state should seed history');

const mediaElement = { marker: 'original-media-element' };
const createdElements = [];
globalThis.document = {
  createElement(type) {
    const element = { tagName: type.toUpperCase(), src: '', preload: '', playsInline: false, muted: false };
    createdElements.push(element);
    return element;
  }
};
globalThis.Image = class ImageMock {
  constructor() { this.tagName = 'IMG'; this.src = ''; createdElements.push(this); }
};
globalThis.Audio = class AudioMock {
  constructor(src) { this.tagName = 'AUDIO'; this.src = src; this.preload = ''; createdElements.push(this); }
};
const mediaFile = new Blob(['original media'], { type: 'video/mp4' });
const clip = composition.addClip({
  id: 'history-video',
  trackId: 'v1',
  type: 'video',
  name: '门店视频',
  startTime: 0,
  duration: 4,
  src: 'blob:history-video',
  file: mediaFile,
  element: mediaElement
});

assert.equal(composition.clips.length, 1);
assert.equal(composition.canUndo(), true);
assert.equal(composition.undo(), true, 'undo should revert the first added clip');
assert.equal(composition.clips.length, 0);
assert.equal(composition.redo(), true, 'redo should restore the added clip');
assert.equal(composition.clips.length, 1);
assert.notEqual(composition.getClip('history-video').element, mediaElement, 'redo should recreate rather than retain a decoded media element');
assert.equal(composition.getClip('history-video').element.src, 'blob:history-video');
assert.equal(composition._lastHistorySnapshot.clips[0].element, null, 'history snapshots must not retain DOM media elements');
assert.equal(composition.getClip('history-video').file, mediaFile, 'redo must preserve the source file');

// Deleting a media clip must be reversible without losing its source File or URL; its DOM element is recreated.
assert.equal(composition.removeClip('history-video'), true);
assert.equal(composition.clips.length, 0);
assert.equal(composition.undo(), true);
assert.notEqual(composition.getClip('history-video').element, mediaElement);
assert.equal(composition.getClip('history-video').element.src, 'blob:history-video');
assert.equal(composition.getClip('history-video').file, mediaFile);
assert.equal(composition.redo(), true);
assert.equal(composition.clips.length, 0);
assert.equal(composition.undo(), true);

// Grouped timeline/canvas gestures produce one history entry and restore both ends.
const beforeBatchCount = composition.history.stack.length;
const restoredClip = composition.getClip('history-video');
composition.startBatch('move and resize');
restoredClip.startTime = 2.5;
restoredClip.x = 120;
restoredClip.y = 240;
assert.equal(composition.commitBatch(), true);
assert.equal(composition.history.stack.length, beforeBatchCount, 'new edit after undo should replace the abandoned redo branch');
assert.equal(composition.canRedo(), false, 'committing a new edit must clear redo history');
assert.equal(composition.undo(), true);
assert.equal(composition.getClip('history-video').startTime, 0);
assert.notEqual(composition.getClip('history-video').x, 120);
assert.equal(composition.redo(), true);
assert.equal(composition.getClip('history-video').startTime, 2.5);
assert.equal(composition.getClip('history-video').x, 120);

// A no-op batch should not pollute undo history.
const noOpCount = composition.history.stack.length;
composition.startBatch('no-op');
assert.equal(composition.commitBatch(), false);
assert.equal(composition.history.stack.length, noOpCount);

// Cancel must restore the batch start without creating an undo entry.
const beforeCancel = composition.getClip('history-video').startTime;
composition.startBatch('cancelled move');
composition.getClip('history-video').startTime = 8;
assert.equal(composition.cancelBatch(), true);
assert.equal(composition.getClip('history-video').startTime, beforeCancel);
assert.equal(composition.history.stack.length, noOpCount);

console.log('Composition undo/redo, media restoration, grouped edits and cancel tests passed.');
