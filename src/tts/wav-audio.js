/**
 * Convert mono Float32 TTS samples into a browser-native WAV File.
 * Pure byte conversion: no network, storage, or AudioContext side effects.
 */
export function encodePcm16Wav(samples, sampleRate) {
  if (!(samples instanceof Float32Array) || samples.length === 0) {
    throw new TypeError('TTS samples must be a non-empty Float32Array.');
  }
  if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 96000) {
    throw new RangeError('TTS sample rate must be an integer between 8000 and 96000 Hz.');
  }

  const bytesPerSample = 2;
  const dataBytes = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  const writeText = (offset, value) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };

  writeText(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeText(8, 'WAVE');
  writeText(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeText(36, 'data');
  view.setUint32(40, dataBytes, true);

  let sumSquares = 0;
  for (let i = 0; i < samples.length; i++) {
    const raw = samples[i];
    if (!Number.isFinite(raw)) throw new TypeError('TTS samples contain a non-finite value.');
    const sample = Math.max(-1, Math.min(1, raw));
    sumSquares += sample * sample;
    const pcm = sample < 0 ? Math.round(sample * 32768) : Math.round(sample * 32767);
    view.setInt16(44 + i * bytesPerSample, pcm, true);
  }
  const rms = Math.sqrt(sumSquares / samples.length);
  if (rms < 0.0005) throw new Error('TTS output is silent; please retry generation.');

  return new Blob([buffer], { type: 'audio/wav' });
}

export function createTtsVoiceFile(samples, sampleRate, now = Date.now()) {
  const wav = encodePcm16Wav(samples, sampleRate);
  const safeTimestamp = Number.isFinite(now) ? Math.max(0, Math.floor(now)) : Date.now();
  return new File([wav], `xiaozhi-ai-voice-${safeTimestamp}.wav`, {
    type: 'audio/wav',
    lastModified: safeTimestamp,
  });
}
