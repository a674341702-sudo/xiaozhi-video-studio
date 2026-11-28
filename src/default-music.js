/**
 * Creates a short, original ambient music bed locally in the browser.
 * No third-party track, network request, or external music license is involved.
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

export async function createDefaultMusicFile() {
  const OfflineContext = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
  if (!OfflineContext || typeof globalThis.File !== 'function') return null;
  const sampleRate = DEFAULT_MUSIC_SAMPLE_RATE;
  const frameCount = sampleRate * DEFAULT_MUSIC_LOOP_SECONDS;
  const context = new OfflineContext(2, frameCount, sampleRate);
  const master = context.createGain();
  master.gain.value = 0.72;
  master.connect(context.destination);

  for (const chord of getDefaultMusicChordPlan()) {
    for (const [noteIndex, frequency] of chord.notes.entries()) {
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      const start = chord.start;
      const end = chord.end;
      const level = noteIndex === 0 ? 0.105 : 0.075;
      envelope.gain.setValueAtTime(0, start);
      envelope.gain.linearRampToValueAtTime(level, start + 0.45);
      envelope.gain.setValueAtTime(level, end - 0.45);
      envelope.gain.linearRampToValueAtTime(0, end);
      oscillator.connect(envelope);
      envelope.connect(master);
      oscillator.start(start);
      oscillator.stop(end + 0.01);
    }
  }

  const rendered = await context.startRendering();
  const wav = encodeAudioBufferAsWav(rendered);
  return new File([wav], 'xiaozhi-original-ambient-bed.wav', {
    type: 'audio/wav',
    lastModified: 0
  });
}
