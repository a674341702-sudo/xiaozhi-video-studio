/**
 * Keyframe system with interpolation.
 * Supports linear, ease-in, ease-out, and ease-in-out easing.
 */

export const EASING = {
  linear: (t) => t,
  easeIn: (t) => t * t,
  easeOut: (t) => 1 - (1 - t) * (1 - t),
  easeInOut: (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
};

export function evaluateKeyframes(keyframes, property, time) {
  const list = (keyframes?.[property] || []).sort((a, b) => a.time - b.time);
  if (list.length === 0) return null;

  // Before first keyframe
  if (time <= list[0].time) return list[0].value;
  // After last keyframe
  if (time >= list[list.length - 1].time) return list[list.length - 1].value;

  // Between two keyframes
  for (let i = 0; i < list.length - 1; i++) {
    const k1 = list[i];
    const k2 = list[i + 1];
    if (time >= k1.time && time <= k2.time) {
      const t = (time - k1.time) / (k2.time - k1.time);
      const easing = EASING[k2.easing] || EASING.linear;
      const et = easing(t);
      return k1.value + (k2.value - k1.value) * et;
    }
  }

  return list[list.length - 1].value;
}

export function setKeyframe(keyframes, property, time, value, easing = 'linear') {
  if (!keyframes) keyframes = {};
  if (!keyframes[property]) keyframes[property] = [];

  const existing = keyframes[property].findIndex(k => Math.abs(k.time - time) < 1e-6);
  if (existing >= 0) {
    keyframes[property][existing] = { time, value, easing };
  } else {
    keyframes[property].push({ time, value, easing });
  }

  keyframes[property].sort((a, b) => a.time - b.time);
  return keyframes;
}

export function removeKeyframe(keyframes, property, time) {
  if (!keyframes?.[property]) return keyframes;
  keyframes[property] = keyframes[property].filter(k => Math.abs(k.time - time) >= 1e-6);
  return keyframes;
}

export function getAnimatedValue(clip, property, time, defaultValue) {
  if (!clip.keyframes?.[property]?.length) return defaultValue;
  const val = evaluateKeyframes(clip.keyframes, property, time);
  return val !== null ? val : defaultValue;
}

export function applyClipTransformsAtTime(clip, time, out = {}) {
  out.x = getAnimatedValue(clip, 'x', time, clip.x);
  out.y = getAnimatedValue(clip, 'y', time, clip.y);
  out.scale = getAnimatedValue(clip, 'scale', time, 1);
  out.rotation = getAnimatedValue(clip, 'rotation', time, 0);
  out.opacity = getAnimatedValue(clip, 'opacity', time, clip.opacity ?? 1);
  out.volume = getAnimatedValue(clip, 'volume', time, clip.volume ?? 1);
  return out;
}

/**
 * Resolve an audio/video clip's source time and volume for live preview.
 * Timeline time is absolute; keyframe times use the same timeline coordinate.
 */
export function getClipPlaybackState(clip, timelineTime, mediaDuration = Infinity) {
  const start = Math.max(0, Number(clip?.startTime) || 0);
  const duration = Math.max(0, Number(clip?.duration) || 0);
  const trimStart = Math.max(0, Number(clip?.trimStart) || 0);
  const declaredTrimEnd = Number(clip?.trimEnd);
  const fallbackEnd = trimStart + duration;
  const trimEnd = Number.isFinite(declaredTrimEnd) && declaredTrimEnd > trimStart
    ? declaredTrimEnd
    : fallbackEnd;
  const sourceEnd = Number.isFinite(mediaDuration) && mediaDuration > 0
    ? Math.min(trimEnd, mediaDuration)
    : trimEnd;
  const sourceLength = Math.max(0, sourceEnd - trimStart);
  const localTime = Math.max(0, timelineTime - start);
  const active = timelineTime >= start && timelineTime < start + duration;
  const loop = clip?.loop === true && sourceLength > 0;
  const sourceTime = loop
    ? trimStart + (localTime % sourceLength)
    : Math.min(sourceEnd, trimStart + localTime);
  const sourceEnded = !loop && localTime >= sourceLength;
  const animatedVolume = evaluateKeyframes(clip?.keyframes, 'volume', timelineTime);
  const rawVolume = animatedVolume === null ? (clip?.volume ?? 1) : animatedVolume;
  const volume = Math.max(0, Math.min(1, Number(rawVolume) || 0));

  return {
    active,
    loop,
    sourceTime,
    sourceEnded,
    volume,
    timelineEnd: start + duration
  };
}
