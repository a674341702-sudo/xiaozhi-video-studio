/** Reject invalid export dimensions/timing before allocating canvas or WASM memory. */
export function validateExportSettings({ duration, width, height, fps }) {
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error('视频时长必须是大于 0 的有效数字。');
  }
  if (!Number.isFinite(width) || !Number.isInteger(width) || width < 2 ||
      !Number.isFinite(height) || !Number.isInteger(height) || height < 2) {
    throw new Error('导出画面宽度和高度必须是至少 2 像素的有效整数。');
  }
  if (!Number.isFinite(fps) || !Number.isInteger(fps) || fps < 1 || fps > 60) {
    throw new Error('导出帧率必须设置为 1–60 FPS 之间的整数。');
  }
  const totalFramesEstimate = Math.ceil(duration * fps);
  if (!Number.isSafeInteger(totalFramesEstimate) || totalFramesEstimate <= 0) {
    throw new Error('预计导出帧数无效，请缩短视频或调整帧率。');
  }
  return { totalFramesEstimate };
}
