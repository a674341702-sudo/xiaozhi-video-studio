/**
 * Chinese-friendly canvas text layout helpers.
 * Kept DOM-free so wrapping and subtitle-safe-zone rules can be unit tested.
 */
export function hasRenderableText(text) {
  return String(text ?? '').trim().length > 0;
}

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


/**
 * Return a subtitle-safe rectangle at a selectable vertical position.
 * The bottom preset preserves the original default safe-zone behavior.
 */
export function getSubtitlePositionLayout(width, height, position = 'bottom', options = {}) {
  const layout = getSubtitleSafeLayout(width, height, options);
  const h = Math.max(1, Number(height) || 1);
  if (position === 'top') {
    layout.y = Math.round(h * 0.12);
  } else if (position === 'middle') {
    layout.y = Math.round((h - layout.height) / 2);
  }
  layout.y = Math.max(0, Math.min(h - layout.height, layout.y));
  return layout;
}


/**
 * Limit wrapped text to the space available in its clip, with an optional
 * per-clip line cap (used by generated subtitles to keep captions concise).
 */
export function getTextClipLineLimit(height, fontSize, configuredMaxLines = null) {
  const h = Math.max(1, Number(height) || 1);
  const size = Math.max(12, Number(fontSize) || 36);
  const verticalPadding = Math.max(4, Math.round(size * 0.18));
  const fit = Math.max(1, Math.floor((h - verticalPadding * 2) / (size * 1.2)));
  const configured = Number(configuredMaxLines);
  return Number.isInteger(configured) && configured > 0 ? Math.min(fit, configured) : fit;
}
