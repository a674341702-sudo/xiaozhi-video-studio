/**
 * Explain whether the uploaded narration covers the generated video timeline.
 * A small tolerance avoids warnings caused by container duration rounding.
 */
export function getVoiceCoverageNote(voiceDuration, timelineDuration, tolerance = 0.75) {
  const voice = Number(voiceDuration);
  const timeline = Number(timelineDuration);
  if (!Number.isFinite(voice) || voice <= 0 || !Number.isFinite(timeline) || timeline <= 0) return '';
  const difference = timeline - voice;
  const threshold = Math.max(0, Number(tolerance) || 0);
  if (difference > threshold) {
    return '配音比视频短约 ' + difference.toFixed(1) + ' 秒，结尾可能出现无配音画面；建议补录或缩短成片。';
  }
  if (difference < -threshold) {
    return '配音比视频长约 ' + Math.abs(difference).toFixed(1) + ' 秒，超出部分不会进入成片。';
  }
  return '';
}

/** Limit narration to the main story, leaving a branded end card voice-free. */
export function getVoiceClipDuration(voiceDuration, narrationDuration) {
  const voice = Number(voiceDuration);
  const narration = Number(narrationDuration);
  if (!Number.isFinite(voice) || voice <= 0 || !Number.isFinite(narration) || narration <= 0) return 0;
  return Math.min(voice, narration);
}
