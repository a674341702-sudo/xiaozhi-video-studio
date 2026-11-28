import assert from 'node:assert/strict';
import { cleanupProxyFFmpeg } from '../src/proxy-ffmpeg-cleanup.js';

const events = [];
const handler = () => {};
const fake = {
  off: (name, fn) => events.push(['off', name, fn === handler]),
  deleteFile: async name => { events.push(['delete', name]); if (name === 'broken.tmp') throw new Error('already removed'); },
  terminate: () => events.push(['terminate'])
};
await cleanupProxyFFmpeg(fake, ['input.tmp', 'broken.tmp', 'output.tmp'], handler);
assert.deepEqual(events, [
  ['off', 'log', true],
  ['delete', 'input.tmp'],
  ['delete', 'broken.tmp'],
  ['delete', 'output.tmp'],
  ['terminate']
], 'worker terminates even when an individual temporary-file cleanup fails');

const loadFailureEvents = [];
await cleanupProxyFFmpeg({ terminate: () => loadFailureEvents.push('terminated') }, ['partial.tmp']);
assert.deepEqual(loadFailureEvents, ['terminated'], 'partially initialized worker is terminated too');
await cleanupProxyFFmpeg(null, ['ignored']);
console.log('Proxy FFmpeg cleanup tests passed.');
