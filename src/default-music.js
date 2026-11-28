/**
 * Creates a short, original instrumental bed locally in the browser.
 * The arrangement uses a warm filtered pad, soft bass and a repeating plucked
 * arpeggio. It makes no network request and uses no third-party music sample.
 */
export const DEFAULT_MUSIC_SAMPLE_RATE = 22050;
export const DEFAULT_MUSIC_LOOP_SECONDS = 12;

export function getDefaultMusicChordPlan() {
  return [
    { start: 0, end: 3, notes: [130.81, 164.81, 196.00, 246.94] },   // Cmaj7
    { start: 3, end: 6, notes: [110.00, 130.81, 164.81, 196.00] },  // Am7
    { start: 6, end: 9, notes: [87.31, 110.00, 130.81, 164.81] },   // Fmaj7
    { start: 9, end: 12, notes: [98.00, 123.47, 146.83, 220.00] }  // G6
  ];
}

export function encodeAudioBufferAsWav(buffer) {
  if (!buffer || !Number.isInteger(buffer.numberOfChannels) || buffer.numberOfChannels < 1 ||
      !Number.isInteger(buffer.length) || buffer.length < 1 ||
      !Number.isFinite(buffer.sampleRate) || buffer.sampleRate < 1) {
    throw new TypeError('无效的音频缓冲区');
  }
  const channels = buffer.numberOfChannels;
  const bytesPerSample = 2;
  const dataLength = buffer.length * channels * bytesPerSample;
  const output = new ArrayBuffer(44 + dataLength);
  const view = new DataView(output);
  const writeText = (offset, value) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  writeText(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeText(8, 'WAVE');
  writeText(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channels * bytesPerSample, true);
  view.setUint16(32, channels * bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeText(36, 'data');
  view.setUint32(40, dataLength, true);
  let offset = 44;
  const channelData = Array.from({ length: channels }, (_, channel) => buffer.getChannelData(channel));
  for (let frame = 0; frame < buffer.length; frame++) {
    for (let channel = 0; channel < channels; channel++) {
      const sample = Math.max(-1, Math.min(1, channelData[channel][frame] || 0));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += bytesPerSample;
    }
  }
  return new Blob([output], { type: 'audio/wav' });
}

/** Normalize generated music before the timeline's user-controlled music gain is applied. */
export function normalizeAudioBufferPeak(buffer, targetPeak = 0.85) {
  if (!buffer || !Number.isInteger(buffer.numberOfChannels) || buffer.numberOfChannels < 1 ||
      !Number.isInteger(buffer.length) || buffer.length < 1) {
    throw new TypeError('无效的音频缓冲区');
  }
  const target = Number.isFinite(Number(targetPeak))
    ? Math.max(0.1, Math.min(0.95, Number(targetPeak)))
    : 0.85;
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index));
  let peak = 0;
  for (const samples of channels) {
    for (let i = 0; i < samples.length; i++) {
      const sample = Number(samples[i]);
      if (Number.isFinite(sample)) peak = Math.max(peak, Math.abs(sample));
    }
  }
  if (peak > 0) {
    const gain = target / peak;
    for (const samples of channels) {
      for (let i = 0; i < samples.length; i++) {
        const sample = Number(samples[i]);
        samples[i] = Number.isFinite(sample) ? Math.max(-target, Math.min(target, sample * gain)) : 0;
      }
    }
  }
  return { peak, targetPeak: peak > 0 ? target : 0, gain: peak > 0 ? target / peak : 1 };
}

function schedulePad(context, destination, chord) {
  for (const [index, frequency] of chord.notes.entries()) {
    const oscillator = context.createOscillator();
    const filter = context.createBiquadFilter();
    const envelope = context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.value = frequency;
    filter.type = 'lowpass';
    filter.frequency.value = 720;
    filter.Q.value = 0.55;
    const level = index === 0 ? 0.045 : 0.032;
    envelope.gain.setValueAtTime(0.0001, chord.start);
    envelope.gain.linearRampToValueAtTime(level, chord.start + 0.65);
    envelope.gain.setValueAtTime(level, chord.end - 0.55);
    envelope.gain.linearRampToValueAtTime(0.0001, chord.end);
    oscillator.connect(filter);
    filter.connect(envelope);
    envelope.connect(destination);
    oscillator.start(chord.start);
    oscillator.stop(chord.end + 0.01);
  }
}

function scheduleBass(context, destination, chord) {
  const oscillator = context.createOscillator();
  const envelope = context.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.value = chord.notes[0] / 2;
  envelope.gain.setValueAtTime(0.0001, chord.start);
  envelope.gain.linearRampToValueAtTime(0.055, chord.start + 0.12);
  envelope.gain.setValueAtTime(0.055, chord.end - 0.2);
  envelope.gain.linearRampToValueAtTime(0.0001, chord.end);
  oscillator.connect(envelope);
  envelope.connect(destination);
  oscillator.start(chord.start);
  oscillator.stop(chord.end + 0.01);
}

function schedulePluck(context, destination, chord, chordIndex) {
  // A gentle four-note pattern adds movement without a harsh drum transient.
  const pattern = [0, 2, 1, 3];
  for (let beat = 0; beat < 4; beat++) {
    const start = chord.start + beat * 0.75 + (chordIndex % 2) * 0.08;
    const frequency = chord.notes[pattern[beat]] * 2;
    const oscillator = context.createOscillator();
    const filter = context.createBiquadFilter();
    const envelope = context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.value = frequency;
    filter.type = 'lowpass';
    filter.frequency.value = 1800;
    filter.Q.value = 0.45;
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.linearRampToValueAtTime(0.022, start + 0.018);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + 0.52);
    oscillator.connect(filter);
    filter.connect(envelope);
    envelope.connect(destination);
    oscillator.start(start);
    oscillator.stop(start + 0.55);
  }
}

export async function createDefaultMusicFile() {
  const OfflineContext = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
  if (!OfflineContext || typeof globalThis.File !== 'function') return null;
  const sampleRate = DEFAULT_MUSIC_SAMPLE_RATE;
  const frameCount = sampleRate * DEFAULT_MUSIC_LOOP_SECONDS;
  const context = new OfflineContext(2, frameCount, sampleRate);
  const master = context.createGain();
  master.gain.value = 0.78;
  master.connect(context.destination);

  getDefaultMusicChordPlan().forEach((chord, index) => {
    schedulePad(context, master, chord);
    scheduleBass(context, master, chord);
    schedulePluck(context, master, chord, index);
  });

  const rendered = await context.startRendering();
  normalizeAudioBufferPeak(rendered, 0.85);
  const wav = encodeAudioBufferAsWav(rendered);
  return new File([wav], 'xiaozhi-original-ambient-bed.wav', {
    type: 'audio/wav',
    lastModified: 0
  });
}
