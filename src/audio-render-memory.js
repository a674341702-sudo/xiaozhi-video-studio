/** Estimate the float32 stereo OfflineAudioContext output before allocating it. */
export function getAudioRenderMemoryEstimate(duration, sampleRate = 48000, channels = 2) {
  if (!Number.isFinite(duration) || duration <= 0 ||
      !Number.isSafeInteger(sampleRate) || sampleRate <= 0 ||
      !Number.isSafeInteger(channels) || channels < 1 || channels > 2) {
    throw new Error('音频渲染内存估算参数无效，请检查视频时长后重试。');
  }
  const frames = Math.ceil(duration * sampleRate);
  const bytes = frames * channels * Float32Array.BYTES_PER_ELEMENT;
  if (!Number.isSafeInteger(frames) || frames <= 0 || !Number.isSafeInteger(bytes)) {
    throw new Error('音频时长过长，无法安全分配手机音频内存，请缩短视频后重试。');
  }
  return bytes;
}
