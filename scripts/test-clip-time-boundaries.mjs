import assert from 'node:assert/strict';
import { Composition } from '../src/composition.js';

const composition = new Composition();
composition.clips = [
  { id: 'first', trackId: 'v1', type: 'video', startTime: 0, duration: 2 },
  { id: 'second', trackId: 'v2', type: 'video', startTime: 2, duration: 2 },
  { id: 'overlay', trackId: 'txt1', type: 'text', startTime: 1.5, duration: 1 }
];

assert.deepEqual(composition.getClipsAtTime(0).map(clip => clip.id), ['first']);
assert.deepEqual(composition.getClipsAtTime(1.999).map(clip => clip.id), ['first', 'overlay']);
assert.deepEqual(composition.getClipsAtTime(2).map(clip => clip.id), ['second', 'overlay'],
  'at a cut, the old clip must be inactive and the new clip active');
assert.deepEqual(composition.getClipsAtTime(3.5).map(clip => clip.id), ['second']);
assert.deepEqual(composition.getClipsAtTime(4), [],
  'clip end is exclusive to prevent a one-frame tail');
assert.deepEqual(composition.getClipsAtTime(2, 0.5).map(clip => clip.id), ['first', 'second', 'overlay'],
  'explicit overlap windows remain supported');

console.log('Timeline half-open clip boundary tests passed.');
