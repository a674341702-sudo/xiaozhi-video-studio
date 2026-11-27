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
