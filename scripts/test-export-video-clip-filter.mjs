import assert from 'node:assert/strict';
import { getExportableVideoClips } from '../src/export-video-clips.js';

const visibleElement = { currentTime: 0 };
const hiddenElement = { currentTime: 0 };
const composition = {
  tracks: [
    { id: 'v1', visible: true },
    { id: 'v2', visible: false },
    { id: 'v3', visible: true }
  ],
  clips: [
    { id: 'visible', type: 'video', trackId: 'v1', element: visibleElement },
    { id: 'hidden', type: 'video', trackId: 'v2', element: hiddenElement },
    { id: 'no-element', type: 'video', trackId: 'v3', element: null },
    { id: 'image', type: 'image', trackId: 'v1', element: visibleElement },
    { id: 'unknown-track', type: 'video', trackId: 'missing', element: visibleElement }
  ]
};

assert.deepEqual(getExportableVideoClips(composition).map(clip => clip.id), ['visible', 'unknown-track']);
assert.deepEqual(getExportableVideoClips({ clips: [] }), []);
assert.deepEqual(getExportableVideoClips(null), []);
console.log('Exportable video clip filter tests passed.');
