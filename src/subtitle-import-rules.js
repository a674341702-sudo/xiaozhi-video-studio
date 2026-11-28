/**
 * Prepare recognized subtitle segments for a project's timeline.
 * Invalid and out-of-range segments are skipped; clipping and long-caption
 * limits are counted so the UI can tell the editor what changed.
 */
export function prepareSubtitleImportSegments(segments, timelineDuration, options = {}) {
  const timeline = Number(timelineDuration);
  const maxDuration = Math.max(0.2, Number(options.maxDuration) || 12);
  const minDuration = Math.max(0.05, Number(options.minDuration) || 0.2);
  const result = {
    segments: [],
    skippedEmpty: 0,
    skippedInvalid: 0,
    skippedOutOfRange: 0,
    clippedToTimeline: 0,
    cappedLong: 0,
    overlaps: 0
  };
  if (!Array.isArray(segments) || !Number.isFinite(timeline) || timeline < minDuration) {
    result.skippedInvalid = Array.isArray(segments) ? segments.length : 0;
    return result;
  }

  const prepared = [];
  segments.forEach((segment, index) => {
    const text = String(segment?.text ?? '').trim();
    if (!text) {
      result.skippedEmpty += 1;
      return;
    }
    const rawStart = Number(segment?.start);
    const rawEnd = Number(segment?.end);
    if (!Number.isFinite(rawStart) || !Number.isFinite(rawEnd) || rawEnd <= rawStart) {
      result.skippedInvalid += 1;
      return;
    }
    if (rawStart >= timeline || rawEnd <= 0) {
      result.skippedOutOfRange += 1;
      return;
    }
    const startTime = Math.max(0, rawStart);
    const endTime = Math.min(timeline, rawEnd);
    if (startTime !== rawStart || endTime !== rawEnd) result.clippedToTimeline += 1;
    const availableDuration = endTime - startTime;
    if (availableDuration < minDuration) {
      result.skippedOutOfRange += 1;
      return;
    }
    const duration = Math.min(maxDuration, availableDuration);
    if (availableDuration > maxDuration) result.cappedLong += 1;
    prepared.push({ text, startTime, duration, originalIndex: index });
  });

  prepared.sort((a, b) => a.startTime - b.startTime || a.originalIndex - b.originalIndex);
  for (let i = 1; i < prepared.length; i += 1) {
    const previous = prepared[i - 1];
    if (prepared[i].startTime < previous.startTime + previous.duration - 0.05) result.overlaps += 1;
  }
  result.segments = prepared.map(({ text, startTime, duration }) => ({ text, startTime, duration }));
  return result;
}
