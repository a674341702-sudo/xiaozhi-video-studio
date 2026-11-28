/** Release a proxy FFmpeg worker and its temporary files on every exit path. */
export async function cleanupProxyFFmpeg(ffmpeg, filenames = [], logHandler = null) {
  if (!ffmpeg) return;
  if (logHandler) {
    try { ffmpeg.off?.('log', logHandler); } catch (_) {}
  }
  for (const name of filenames) {
    try { await ffmpeg.deleteFile?.(name); } catch (_) {}
  }
  try { ffmpeg.terminate?.(); } catch (_) {}
}
