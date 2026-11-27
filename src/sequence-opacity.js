/**
 * Fade only the opening and closing edges of the whole sequence.
 * Internal shot boundaries stay fully opaque to prevent a black flash.
 */
export function getSequenceEdgeOpacity(index, total, startTime, duration, fadeDuration) {
  const count = Math.max(0, Math.floor(Number(total) || 0));
  const position = Math.floor(Number(index) || 0);
  if (!count || position < 0 || position >= count) return null;
  const start = Number(startTime) || 0;
  const length = Math.max(0, Number(duration) || 0);
  const fade = Math.min(Math.max(0, Number(fadeDuration) || 0), length / 4);
  const frames = [];
  if (position === 0) {
    frames.push({ time: start, value: 0, easing: 'easeOut' });
    frames.push({ time: start + fade, value: 1, easing: 'easeInOut' });
  }
  if (position === count - 1) {
    if (!frames.length) frames.push({ time: start, value: 1, easing: 'easeInOut' });
    frames.push({ time: start + length - fade, value: 1, easing: 'easeInOut' });
    frames.push({ time: start + length, value: 0, easing: 'easeIn' });
  }
  return frames.length ? frames : null;
}
