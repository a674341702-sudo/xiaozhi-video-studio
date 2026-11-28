/**
 * Guard mobile image decoding against extreme source dimensions.
 * 40 megapixels is a practical upper bound for the current browser-only
 * workflow; this rejects pathological inputs without recompressing originals.
 */
export const MAX_IMAGE_PIXELS = 40_000_000;

export function validateImageDimensions(width, height, maxPixels = MAX_IMAGE_PIXELS) {
  const w = Number(width);
  const h = Number(height);
  const limit = Number(maxPixels);
  if (!Number.isSafeInteger(w) || !Number.isSafeInteger(h) || w <= 0 || h <= 0 ||
      !Number.isFinite(limit) || limit <= 0) {
    return { valid: false, pixels: 0, maxPixels: Number.isFinite(limit) ? limit : MAX_IMAGE_PIXELS };
  }
  const pixels = w * h;
  return {
    valid: Number.isSafeInteger(pixels) && pixels <= limit,
    pixels,
    maxPixels: limit
  };
}
