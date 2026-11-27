/**
 * Snapshot a file picker selection before resetting it.
 * Some mobile browsers expose a live FileList that becomes empty when the
 * input value is cleared, so callers must keep this array for the full import.
 */
export function takeSelectedFiles(input) {
  const files = Array.from(input?.files || []);
  if (input) input.value = '';
  return files;
}

/**
 * Android media pickers may return an empty or generic MIME type.
 * Accept recognized filename extensions as a safe fallback.
 */
export function isSupportedReferenceVideoFile(file) {
  const hasVideoMime = String(file?.type || '').toLowerCase().startsWith('video/');
  const hasVideoExtension = /\.(mp4|mov|webm)$/i.test(file?.name || '');
  return hasVideoMime || hasVideoExtension;
}
