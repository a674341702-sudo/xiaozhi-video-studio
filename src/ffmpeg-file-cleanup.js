/** Delete temporary files from the exact FFmpeg worker that created them. */
export async function cleanupFFmpegFiles(instance, fileList = []) {
  if (!instance || !Array.isArray(fileList)) return;
  for (const name of fileList) {
    try { await instance.deleteFile?.(name); } catch (_) {}
  }
}
