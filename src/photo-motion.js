/**
 * Build subtle, alternating Ken Burns keyframes for merchant photo shots.
 * Motion stays intentionally small so important products and shop details remain visible.
 */
export function getPhotoMotionKeyframes(index, width, height, startTime, duration) {
  const pattern = Math.abs(Number(index) || 0) % 4;
  const horizontal = pattern === 0 || pattern === 2;
  const reverse = pattern === 1 || pattern === 2;
  const panX = Math.max(0, Number(width) || 0) * 0.008;
  const panY = Math.max(0, Number(height) || 0) * 0.006;
  const zoomIn = (Math.abs(Number(index) || 0) % 2) === 0;
  const startScale = zoomIn ? 1.035 : 1.075;
  const endScale = zoomIn ? 1.075 : 1.035;
  const fromX = horizontal ? (reverse ? panX : -panX) : 0;
  const toX = -fromX;
  const fromY = horizontal ? 0 : (reverse ? -panY : panY);
  const toY = -fromY;
  const endTime = Number(startTime) + Math.max(0, Number(duration) || 0);
  const cleanZero = value => Object.is(value, -0) ? 0 : value;
  const pair = (from, to) => [
    { time: Number(startTime) || 0, value: cleanZero(from), easing: 'easeInOut' },
    { time: endTime, value: cleanZero(to), easing: 'easeInOut' }
  ];
  return {
    scale: pair(startScale, endScale),
    x: pair(fromX, toX),
    y: pair(fromY, toY)
  };
}
