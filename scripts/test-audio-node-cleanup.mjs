import assert from 'node:assert/strict';
import { releaseRenderedAudioNodes } from '../src/audio-node-cleanup.js';

function fakeNodes() {
  const events=[];
  const nodes=[{source:{buffer:{decoded:true},stop(){events.push('stop')},disconnect(){events.push('source-disconnect')}},gain:{disconnect(){events.push('gain-disconnect')}}}];
  return {events,nodes};
}
const success=fakeNodes();
releaseRenderedAudioNodes(success.nodes);
assert.deepEqual(success.events,['stop','source-disconnect','gain-disconnect']);
assert.equal(success.nodes.length,0);
const interrupted=fakeNodes();
releaseRenderedAudioNodes(interrupted.nodes);
assert.deepEqual(interrupted.events,['stop','source-disconnect','gain-disconnect'],'the same cleanup helper is used by renderMixedAudio finally for cancel/error paths');
const partial=[{source:{buffer:{decoded:true},disconnect(){throw new Error('already disconnected')}},gain:{disconnect(){events.push('gain-after-error')}}}];
const events=[];
releaseRenderedAudioNodes(partial);
assert.equal(partial.length,0);
assert.ok(events.includes('gain-after-error'));
releaseRenderedAudioNodes(null);
console.log('Offline audio node cleanup tests passed.');
