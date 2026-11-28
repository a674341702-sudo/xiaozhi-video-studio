import assert from 'node:assert/strict';
import { createAudioMasterBus } from '../src/audio-master-bus.js';

const connected = [];
const context = {
  destination: { id: 'destination' },
  createDynamicsCompressor() {
    return {
      threshold: { value: 0 }, knee: { value: 0 }, ratio: { value: 0 },
      attack: { value: 0 }, release: { value: 0 },
      connect(node) { connected.push(node); }
    };
  }
};
const bus = createAudioMasterBus(context);
assert.equal(bus.limited, true);
assert.equal(bus.node.threshold.value, -3);
assert.equal(bus.node.knee.value, 6);
assert.equal(bus.node.ratio.value, 12);
assert.equal(bus.node.attack.value, 0.003);
assert.equal(bus.node.release.value, 0.15);
assert.deepEqual(connected, [context.destination]);

const unsupported = createAudioMasterBus({ destination: context.destination });
assert.deepEqual(unsupported, { node: context.destination, limited: false });
const failed = createAudioMasterBus({ destination: context.destination, createDynamicsCompressor() { throw new Error('unsupported'); } });
assert.deepEqual(failed, { node: context.destination, limited: false });

console.log('Shared audio master bus tests passed.');
