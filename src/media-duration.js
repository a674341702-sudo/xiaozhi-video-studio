/** Preserve real media duration precision while providing a safe fallback. */
export function getPreciseMediaDuration(duration, fallback = 10) {
  const value = Number(duration);
  if (Number.isFinite(value) && value > 0) return value;
  const safeFallback = Number(fallback);
  return Number.isFinite(safeFallback) && safeFallback > 0 ? safeFallback : 10;
}
