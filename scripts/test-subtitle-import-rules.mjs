import assert from 'node:assert/strict';
import { applySubtitleTimeOffset, prepareSubtitleImportSegments } from '../src/subtitle-import-rules.js';

const prepared = prepareSubtitleImportSegments([
  { start: 4, end: 6, text: '后一句' },
  { start: 0.5, end: 2, text: '第一句' },
  { start: 2, end: 20, text: '超长并超出视频' },
  { start: 25, end: 27, text: '超出视频的句子' },
  { start: 3, end: 3, text: '无效时间' },
  { start: 1, end: 2, text: '   ' }
], 10);
assert.deepEqual(prepared.segments, [
  { text: '第一句', startTime: 0.5, duration: 1.5 },
  { text: '超长并超出视频', startTime: 2, duration: 8 },
  { text: '后一句', startTime: 4, duration: 2 }
]);
assert.equal(prepared.skippedEmpty, 1);
assert.equal(prepared.skippedInvalid, 1);
assert.equal(prepared.skippedOutOfRange, 1);
assert.equal(prepared.clippedToTimeline, 1);
assert.equal(prepared.cappedLong, 0, 'timeline clipping happens before the 12-second cap');
assert.equal(prepared.overlaps, 1, 'overlapping subtitle timing is reported rather than silently shifted');

const capped = prepareSubtitleImportSegments([{ start: 1, end: 20, text: '长字幕' }], 30);
assert.equal(capped.segments[0].duration, 12);
assert.equal(capped.cappedLong, 1);

const negativeStart = prepareSubtitleImportSegments([{ start: -1, end: 1, text: '从视频开头开始' }], 5);
assert.deepEqual(negativeStart.segments, [{ text: '从视频开头开始', startTime: 0, duration: 1 }]);
assert.equal(negativeStart.clippedToTimeline, 1);

const invalidTimeline = prepareSubtitleImportSegments([{ start: 0, end: 1, text: '字幕' }], 0);
assert.equal(invalidTimeline.segments.length, 0);
assert.equal(invalidTimeline.skippedInvalid, 1);

const sourceSegments = [{ start: 1.2, end: 2.4, text: '测试字幕' }];
assert.deepEqual(applySubtitleTimeOffset(sourceSegments, 0.5), [{ start: 1.7, end: 2.9, text: '测试字幕' }], 'positive offset delays subtitles');
assert.deepEqual(applySubtitleTimeOffset(sourceSegments, -0.3), [{ start: 0.8999999999999999, end: 2.1, text: '测试字幕' }], 'negative offset advances subtitles');
assert.deepEqual(sourceSegments, [{ start: 1.2, end: 2.4, text: '测试字幕' }], 'offset adjustment must not mutate ASR results');
assert.deepEqual(applySubtitleTimeOffset(sourceSegments, Number.NaN), sourceSegments, 'invalid offsets safely fall back to zero');
console.log('字幕导入时间校验测试通过');
