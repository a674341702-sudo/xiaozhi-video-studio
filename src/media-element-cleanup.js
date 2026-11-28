/**
 * Release a media element and its temporary object URL when an import fails
 * or is cancelled before the element becomes part of the composition.
 */
export function cleanupFailedMediaElement(element, objectUrl, mediaType = 'media') {
  if (element) {
    try {
      if (mediaType === 'audio' || mediaType === 'video') element.pause?.();
      if (typeof element.removeAttribute === 'function') element.removeAttribute('src');
      else if ('src' in element) element.src = '';
      if (typeof element.load === 'function') element.load();
    } catch (_) {
      // Cleanup is best-effort; always revoke the temporary URL below.
    }
  }
  if (objectUrl && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(objectUrl);
  }
}
