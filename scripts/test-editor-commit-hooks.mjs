import assert from 'node:assert/strict';
import { CanvasPreview } from '../src/canvas-preview.js';
import { MultiTimeline } from '../src/multi-timeline.js';

let canvasCommitted = 0;
let canvasCommitSawBatch = false;
const canvas = Object.create(CanvasPreview.prototype);
canvas.isDragging = true;
canvas.dragMode = 'move';
canvas.comp = {
  commitBatch() { canvasCommitSawBatch = true; },
  getSelectedClip() { return { id: 'canvas-clip' }; }
};
canvas.onCommitClipTransform = clip => {
  assert.equal(canvasCommitSawBatch, true, 'canvas history must commit before autosave callback');
  assert.equal(clip.id, 'canvas-clip');
  canvasCommitted++;
};
canvas._onMouseUp();
assert.equal(canvasCommitted, 1);
assert.equal(canvas.isDragging, false);
assert.equal(canvas.dragMode, null);

// Releasing the pointer without an active drag must not schedule a redundant save.
canvas._onMouseUp();
assert.equal(canvasCommitted, 1);

let timelineCommitted = 0;
let timelineCommitSawBatch = false;
const timeline = {
  dragTarget: { clipId: 'timeline-clip', mode: 'trimRight' },
  comp: {
    commitBatch() { timelineCommitSawBatch = true; },
    getClip(id) { return { id }; }
  },
  onCommitClipTime(clip, mode) {
    assert.equal(timelineCommitSawBatch, true, 'timeline history must commit before autosave callback');
    assert.equal(clip.id, 'timeline-clip');
    assert.equal(mode, 'trimRight');
    timelineCommitted++;
  }
};
MultiTimeline.prototype._onDragClipEnd.call(timeline);
assert.equal(timelineCommitted, 1);
assert.equal(timeline.dragTarget, null);
MultiTimeline.prototype._onDragClipEnd.call(timeline);
assert.equal(timelineCommitted, 1);

console.log('Canvas and timeline completed-edit persistence hooks tests passed.');
