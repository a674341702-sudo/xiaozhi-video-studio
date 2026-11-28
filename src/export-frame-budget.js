/** Track actual encoded JPEG bytes before copying another frame into FFmpeg WASM memory. */
export function assertFrameMemoryBudget(currentBytes, nextBytes, maxBytes) {
  if (!Number.isSafeInteger(currentBytes) || currentBytes < 0 ||
      !Number.isSafeInteger(nextBytes) || nextBytes <= 0 ||
      !Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new Error('导出帧数据大小无效，请检查素材后重试。');
  }
  const total = currentBytes + nextBytes;
  if (!Number.isSafeInteger(total) || total > maxBytes) {
    const used = Math.round(currentBytes / 1024 / 1024);
    const limit = Math.round(maxBytes / 1024 / 1024);
    throw new Error(`视频画面素材累计约 ${used} MB，已达到导出内存保护上限（${limit} MB）。请缩短视频、降低画质或分段导出。`);
  }
  return total;
}
