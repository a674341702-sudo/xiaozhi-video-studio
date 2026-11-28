import assert from 'node:assert/strict';
import { LiveAudioMixer } from '../src/live-audio-mixer.js';

function createFakeContext() {
  const calls = { sources: 0, connected: 0, resumed: 0 };
  const context = {
    state: 'suspended',
    currentTime: 4,
    destination: {},
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
console.log('Live Web Audio mixer tests passed.');
