import assert from 'node:assert/strict';
import { LiveAudioMixer } from '../src/live-audio-mixer.js';

function createFakeContext() {
  const calls = { sources: 0, connected: 0, resumed: 0 };
  const context = {
    state: 'suspended',
    currentTime: 4,
    destination: {},
    createDynamicsCompressor() {
      const node = { threshold: { value: 0 }, knee: { value: 0 }, ratio: { value: 0 }, attack: { value: 0 }, release: { value: 0 }, connect() { calls.connected++; } };
      calls.masterBus = node;
      return node;
    },
    createMediaElementSource() {
      calls.sources++;
      return { connect() { calls.connected++; } };
    },
    createGain() {
      return { gain: {
        value: 1,
        setTargetAtTime(value, time, constant) {
          this.value = value;
          this.lastTarget = [value, time, constant];
        }
      }, connect() { calls.connected++; } };
    },
    async resume() { calls.resumed++; this.state = 'running'; }
  };
  return { context, calls };
}

const { context, calls } = createFakeContext();
const mixer = new LiveAudioMixer({ audioContextFactory: () => context });
const element = {};
assert.equal(mixer.connect(element), true);
assert.equal(mixer.masterBus.limited, true, 'live preview should route through a shared peak-control stage');
assert.equal(calls.masterBus.threshold.value, -3);
assert.equal(calls.masterBus.ratio.value, 12);
assert.equal(mixer.connect(element), true, 'same media element must reuse its existing source node');
assert.equal(calls.sources, 1, 'a media element source can only be created once');
assert.equal(mixer.setGain(element, 1.5), true);
assert.deepEqual(mixer.routes.get(element).gain.gain.lastTarget, [1.5, 4, 0.015]);
mixer.setGain(element, 4);
assert.equal(mixer.routes.get(element).gain.gain.value, 1.5, 'gain must cap at 150%');
mixer.setGain(element, -2);
assert.equal(mixer.routes.get(element).gain.gain.value, 0, 'negative gain must clamp to silence');
await mixer.resume();
assert.equal(calls.resumed, 1, 'suspended audio context resumes from playback activation');

const unsupported = new LiveAudioMixer({ audioContextFactory: () => null });
assert.equal(unsupported.connect({}), false, 'unsupported browsers must use native-volume fallback');
assert.equal(unsupported.setGain({}, 1.2), false);

const gainOutputFailure = {
  state: 'running',
  currentTime: 0,
  destination: {},
  createGain() { return { gain: { value: 1 }, connect() { throw new Error('destination unavailable'); } }; },
  createMediaElementSource() { throw new Error('source should not be created before output is ready'); }
};
const safeFallback = new LiveAudioMixer({ audioContextFactory: () => gainOutputFailure });
assert.equal(safeFallback.connect({}), false, 'prepare output before creating a media source');

const directOutputContext = {
  state: 'running',
  currentTime: 0,
  destination: {},
  createGain() { return { gain: { value: 1 }, connect() {} }; },
  createMediaElementSource() {
    return { connect(target) {
      if (target !== directOutputContext.destination) throw new Error('gain input rejected');
      directOutputContext.directConnected = true;
    } };
  }
};
const directOutputMixer = new LiveAudioMixer({ audioContextFactory: () => directOutputContext });
const directElement = {};
assert.equal(directOutputMixer.connect(directElement), true, 'partially failed gain routing should keep direct audio output');
assert.equal(directOutputContext.directConnected, true);
assert.equal(directOutputMixer.setGain(directElement, 1.5), false, 'direct fallback intentionally uses unity gain');

console.log('Live Web Audio mixer tests passed.');
