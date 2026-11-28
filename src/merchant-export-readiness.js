/**
 * Guard the merchant workflow's export action against empty or audio/text-only timelines.
 * The general editor can still export its own compositions through the main toolbar.
 */
export function getMerchantExportReadiness(composition) {
  const clips = Array.isArray(composition?.clips) ? composition.clips : [];
  const hasVisual = clips.some(clip =>
    (clip?.type === 'image' || clip?.type === 'video') &&
    Number.isFinite(Number(clip.duration)) && Number(clip.duration) > 0 &&
    Number.isFinite(Number(clip.startTime)) && Number(clip.startTime) >= 0
  );
  if (!hasVisual) {
    return { ready: false, reason: '还没有可导出的视频画面。请先上传照片或视频，并点击“确认后自动编排”。' };
  }
  if (!(Number.isFinite(Number(composition?.duration)) && Number(composition.duration) > 0)) {
    return { ready: false, reason: '视频时间线时长无效，请重新生成制作时间线。' };
  }
  if (!(Number(composition?.width) > 0 && Number(composition?.height) > 0)) {
    return { ready: false, reason: '视频画幅无效，请重新选择画幅并生成。' };
  }
  return { ready: true, reason: '' };
}
