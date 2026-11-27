/**
 * Build safe audio gain keyframes for a clip-local timeline.
 * Fade durations shrink automatically for short clips and never exceed
 * one third of the clip, leaving a stable middle section when possible.
 */
export function getAudioFadeKeyframes(duration, peakVolume = 1, fadeInSeconds = 0.2, fadeOutSeconds = 0.35) {
  const length = Number.isFinite(Number(duration)) ? Math.max(0, Number(duration)) : 0;
  if (length <= 0) return [];
  const peak = Number.isFinite(Number(peakVolume))
    ? Math.max(0, Math.min(1, Number(peakVolume)))
    : 1;
  const fadeIn = Math.min(Math.max(0, Number(fadeInSeconds) || 0), length / 3);
  const fadeOut = Math.min(Math.max(0, Number(fadeOutSeconds) || 0), length / 3);
  const holdStart = fadeIn;
  const holdEnd = Math.max(holdStart, length - fadeOut);
  return [
    { time: 0, value: 0, easing: 'easeOut' },
    { time: holdStart, value: peak, easing: 'easeInOut' },
    { time: holdEnd, value: peak, easing: 'easeInOut' },
    { time: length, value: 0, easing: 'easeIn' }
  ];
}
