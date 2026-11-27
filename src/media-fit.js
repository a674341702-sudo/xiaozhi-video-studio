/**
 * Geometry helpers for preserving the full source frame inside a target box.
 * DOM-free so export framing can be regression-tested.
 */
export function getMediaDrawGeometry(sourceWidth, sourceHeight, targetX, targetY, targetWidth, targetHeight, mode = 'cover') {
  const sw = Math.max(1, Number(sourceWidth) || 1);
  const sh = Math.max(1, Number(sourceHeight) || 1);
  const tw = Math.max(1, Number(targetWidth) || 1);
  const th = Math.max(1, Number(targetHeight) || 1);
  const x = Number(targetX) || 0;
  const y = Number(targetY) || 0;
  const sourceRatio = sw / sh;
  const targetRatio = tw / th;

  if (mode === 'contain') {
    const scale = Math.min(tw / sw, th / sh);
    const width = sw * scale;
    const height = sh * scale;
    return { sx: 0, sy: 0, sw, sh, dx: x + (tw - width) / 2, dy: y + (th - height) / 2, dw: width, dh: height };
  }

  let cropWidth = sw;
  let cropHeight = sh;
  let sx = 0;
  let sy = 0;
  if (sourceRatio > targetRatio) {
    cropWidth = sh * targetRatio;
    sx = (sw - cropWidth) / 2;
  } else {
    cropHeight = sw / targetRatio;
    sy = (sh - cropHeight) / 2;
  }
  return { sx, sy, sw: cropWidth, sh: cropHeight, dx: x, dy: y, dw: tw, dh: th };
}
