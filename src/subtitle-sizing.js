/**
 * Keep long Chinese captions readable by reducing font size gradually.
 * The renderer still wraps text to the available subtitle safe area.
 */
export function getSubtitleFontSize(text, width, {
  baseRatio = 0.045,
  minRatio = 0.028,
  maxCharactersAtBase = 54
} = {}) {
  const canvasWidth = Math.max(1, Number(width) || 1);
  const characterCount = Array.from(String(text ?? '').replace(/\s/g, '')).length;
  const safeBase = Math.max(0.01, Number(baseRatio) || 0.045);
  const safeMinimum = Math.min(safeBase, Math.max(0.01, Number(minRatio) || 0.028));
  const capacity = Math.max(1, Number(maxCharactersAtBase) || 54);
  const ratio = characterCount > capacity
    ? Math.max(safeMinimum, safeBase * capacity / characterCount)
    : safeBase;
  return Math.max(18, Math.round(canvasWidth * ratio));
}
