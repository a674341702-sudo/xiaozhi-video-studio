import assert from 'node:assert/strict';
import {
  DEFAULT_MUSIC_LOOP_SECONDS,
  DEFAULT_MUSIC_SAMPLE_RATE,
  getDefaultMusicChordPlan,
  encodeAudioBufferAsWav
} from '../src/default-music.js';

const plan = getDefaultMusicChordPlan();
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
console.log('内置原创配乐结构与 WAV 编码测试通过');
