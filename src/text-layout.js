/**
 * Chinese-friendly canvas text layout helpers.
 * Kept DOM-free so wrapping and subtitle-safe-zone rules can be unit tested.
 */
export function wrapTextLines(ctx, text, maxWidth, maxLines = 3) {
  const limit = Math.max(1, Number(maxLines) || 1);
  const width = Math.max(1, Number(maxWidth) || 1);
  const paragraphs = String(text ?? '').replace(/\r\n?/g, '\n').split('\n');
  const lines = [];

  for (const paragraph of paragraphs) {
    // Ignore empty separator lines. They otherwise consume the limited subtitle
    // line budget and can make the final real sentence disappear behind an ellipsis.
    if (!paragraph.trim()) continue;
    let line = '';
    for (const character of Array.from(paragraph)) {
      const candidate = line + character;
      if (line && ctx.measureText(candidate).width > width) {
        lines.push(line);
        line = character;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
  }

  if (lines.length <= limit) return lines;
  const visible = lines.slice(0, limit);
  let last = visible[limit - 1];
  while (last && ctx.measureText(last + '…').width > width) {
    last = Array.from(last).slice(0, -1).join('');
  }
  visible[limit - 1] = last + '…';
  return visible;
}

export function getSubtitleSafeLayout(width, height, { bottomSafe = 0.18, sideMargin = 0.07, heightRatio = 0.18 } = {}) {
  const w = Math.max(1, Number(width) || 1);
  const h = Math.max(1, Number(height) || 1);
  const boxHeight = Math.round(h * heightRatio);
  const safeBottom = Math.round(h * bottomSafe);
  return {
    x: Math.round(w * sideMargin),
    y: Math.max(0, h - safeBottom - boxHeight),
    width: Math.round(w * (1 - sideMargin * 2)),
    height: boxHeight
  };
}
