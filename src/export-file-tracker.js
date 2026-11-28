/** Register a virtual filesystem path before writing, so partial files are also cleaned up. */
export function trackExportFile(fileList, filename) {
  if (!Array.isArray(fileList) || typeof filename !== 'string' || !filename) return false;
  if (fileList.includes(filename)) return false;
  fileList.push(filename);
  return true;
}
