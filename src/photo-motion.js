/**
 * Build subtle, alternating Ken Burns keyframes for merchant photo shots.
 * Motion stays intentionally small so important products and shop details remain visible.
 */
export function getPhotoMotionKeyframes(index, width, height, startTime, duration) {
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const shotIndex = Math.abs(Math.trunc(finite(index))) % 4;
  const frameWidth = Math.max(0, finite(width));
  const frameHeight = Math.max(0, finite(height));
  const start = finite(startTime);
  const length = Math.max(0, finite(duration));
  const pattern = shotIndex;
  const horizontal = pattern === 0 || pattern === 2;
  const reverse = pattern === 1 || pattern === 2;
  const panX = frameWidth * 0.008;
  const panY = frameHeight * 0.006;
  const zoomIn = (shotIndex % 2) === 0;
  const startScale = zoomIn ? 1.035 : 1.075;
  const endScale = zoomIn ? 1.075 : 1.035;
  const fromX = horizontal ? (reverse ? panX : -panX) : 0;
  const toX = -fromX;
  const fromY = horizontal ? 0 : (reverse ? -panY : panY);
  const toY = -fromY;
  const endTime = start + length;
  const cleanZero = value => Object.is(value, -0) ? 0 : value;
  const pair = (from, to) => [
    { time: start, value: cleanZero(from), easing: 'easeInOut' },
    { time: endTime, value: cleanZero(to), easing: 'easeInOut' }
  ];
  return {
    scale: pair(startScale, endScale),
    x: pair(fromX, toX),
    y: pair(fromY, toY)
  };
}
