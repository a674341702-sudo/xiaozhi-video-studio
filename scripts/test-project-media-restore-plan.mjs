import assert from 'node:assert/strict';
import { buildProjectMediaRestorePlan } from '../src/project-media-restore-plan.js';

const clips = [
  { id: 'photo-1', type: 'image' },
  { id: 'video-1', type: 'video' },
  { id: 'music-1', type: 'audio' },
  { id: 'caption-1', type: 'text' }
];
const media = [
  { clipId: 'photo-1', blob: new Blob(['photo']) },
  { clipId: 'video-1', blob: new Blob(['video']) },
  { clipId: 'music-1', blob: new Blob(['music']) }
];
const complete = buildProjectMediaRestorePlan(clips, media);
assert.equal(complete.missingClipIds.length, 0);
assert.equal(complete.mediaByClip.size, 3);

const missing = buildProjectMediaRestorePlan(clips, [
  media[0],
  media[1],
  { clipId: 'music-1', blob: new Blob([]) }
]);
assert.deepEqual(missing.missingClipIds, ['music-1']);

const absent = buildProjectMediaRestorePlan(clips, [media[0]]);
assert.deepEqual(absent.missingClipIds, ['video-1', 'music-1']);

assert.throws(
  () => buildProjectMediaRestorePlan(clips, [media[0], media[0]]),
  /重复/
);
assert.throws(
  () => buildProjectMediaRestorePlan(clips, [{ clipId: '', blob: media[0].blob }]),
  /片段编号/
);

console.log('Local project media restore-plan tests passed.');
