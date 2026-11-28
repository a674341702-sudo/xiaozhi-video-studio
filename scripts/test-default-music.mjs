import assert from 'node:assert/strict';
import {
  DEFAULT_MUSIC_LOOP_SECONDS,
  DEFAULT_MUSIC_SAMPLE_RATE,
  getDefaultMusicChordPlan,
  encodeAudioBufferAsWav,
  createDefaultMusicFile,
  normalizeAudioBufferPeak
} from '../src/default-music.js';

const plan = getDefaultMusicChordPlan();
const normalizationChannels = [
  Float32Array.from([0.1, -0.05, 0.025]),
  Float32Array.from([0.02, -0.08, 0.04])
];
const normalization = normalizeAudioBufferPeak({
  numberOfChannels: 2,
  length: 3,
  getChannelData: index => normalizationChannels[index]
}, 0.85);
assert.ok(Math.abs(normalizationChannels[0][0] - 0.85) < 1e-6,
  'generated music should be normalized before the timeline gain is applied');
assert.ok(Math.abs(Math.max(...normalizationChannels.flatMap(channel => Array.from(channel, Math.abs))) - 0.85) < 1e-6,
  'normalization must target a safe peak without clipping');
assert.equal(normalizeAudioBufferPeak({
  numberOfChannels: 1, length: 2, getChannelData: () => new Float32Array(2)
}).gain, 1, 'silence must remain silence');
assert.equal(plan.length, 4, 'the original ambient bed should use a four-chord loop');
assert.equal(plan[0].start, 0);
assert.equal(plan.at(-1).end, DEFAULT_MUSIC_LOOP_SECONDS);
assert.ok(plan.every((chord, index) =>
  chord.notes.length === 4 &&
  chord.end > chord.start &&
  (index === 0 || chord.start === plan[index - 1].end)
), 'chord segments must be continuous and contain four notes');
assert.equal(DEFAULT_MUSIC_SAMPLE_RATE, 22050);

const channels = [
  Float32Array.from([0, 0.5, -0.5, 1]),
  Float32Array.from([0.25, -0.25, 0.75, -1])
];
const wav = encodeAudioBufferAsWav({
  numberOfChannels: 2,
  length: 4,
  sampleRate: 22050,
  getChannelData: index => channels[index]
});
assert.equal(wav.type, 'audio/wav');
assert.equal(wav.size, 44 + 4 * 2 * 2);
const bytes = new Uint8Array(await wav.arrayBuffer());
assert.equal(new TextDecoder().decode(bytes.slice(0, 4)), 'RIFF');
assert.equal(new TextDecoder().decode(bytes.slice(8, 12)), 'WAVE');
assert.equal(new DataView(bytes.buffer).getUint16(22, true), 2);
assert.equal(new DataView(bytes.buffer).getUint32(24, true), 22050);

const originalOffline = globalThis.OfflineAudioContext;
const originalWebkitOffline = globalThis.webkitOfflineAudioContext;
const originalFile = globalThis.File;
let oscillatorCount = 0;
let renderShape = null;
class TestFile extends Blob {
  constructor(parts, name, options = {}) {
    super(parts, options);
    this.name = name;
    this.lastModified = options.lastModified ?? Date.now();
  }
}
class TestOfflineAudioContext {
  constructor(channels, frames, sampleRate) {
    renderShape = { channels, frames, sampleRate };
    this.destination = {};
  }
  createGain() {
    return {
      gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {} },
      connect() {}
    };
  }
  createOscillator() {
    oscillatorCount++;
    return {
      type: '',
      frequency: { value: 0 },
      connect() {},
      start() {},
      stop() {}
    };
  }
  async startRendering() {
    const channels = [
      new Float32Array([0, 0.1]),
      new Float32Array([0, -0.1])
    ];
    return {
      numberOfChannels: 2,
      length: 2,
      sampleRate: DEFAULT_MUSIC_SAMPLE_RATE,
      getChannelData: channel => channels[channel]
    };
  }
}
try {
  globalThis.OfflineAudioContext = TestOfflineAudioContext;
  globalThis.webkitOfflineAudioContext = undefined;
  globalThis.File = TestFile;
  const generated = await createDefaultMusicFile();
  assert.equal(oscillatorCount, 16, 'the generator should schedule four notes for each of four chords');
  assert.deepEqual(renderShape, {
    channels: 2,
    frames: DEFAULT_MUSIC_SAMPLE_RATE * DEFAULT_MUSIC_LOOP_SECONDS,
    sampleRate: DEFAULT_MUSIC_SAMPLE_RATE
  });
  assert.equal(generated.name, 'xiaozhi-original-ambient-bed.wav');
  assert.equal(generated.type, 'audio/wav');
  assert.ok(generated.size > 44, 'generated file must contain PCM audio data');
  const generatedWav = new DataView(await generated.arrayBuffer());
  const generatedPcmPeak = Math.max(
    Math.abs(generatedWav.getInt16(44, true) / 32768),
    Math.abs(generatedWav.getInt16(46, true) / 32768),
    Math.abs(generatedWav.getInt16(48, true) / 32768),
    Math.abs(generatedWav.getInt16(50, true) / 32768)
  );
  assert.ok(generatedPcmPeak > 0.8, 'generated background music must not be nearly silent before timeline volume control');
} finally {
  if (originalOffline === undefined) delete globalThis.OfflineAudioContext;
  else globalThis.OfflineAudioContext = originalOffline;
  if (originalWebkitOffline === undefined) delete globalThis.webkitOfflineAudioContext;
  else globalThis.webkitOfflineAudioContext = originalWebkitOffline;
  if (originalFile === undefined) delete globalThis.File;
  else globalThis.File = originalFile;
}

console.log('内置原创配乐结构与 WAV 编码测试通过');
