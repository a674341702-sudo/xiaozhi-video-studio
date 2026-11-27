/**
 * Convert browser/exporter failures into practical Chinese guidance.
 * Preserve useful unknown errors instead of hiding their original detail.
 */
export function getExportErrorMessage(error) {
  const raw = String(error?.message || (typeof error === 'string' ? error : '导出处理失败'));
  if (/out of memory|memory access out of bounds|allocation failed|array buffer allocation|cannot enlarge memory|not enough memory/i.test(raw)) {
    return '手机可用内存不足，视频没有导出。请关闭其他应用后重试；素材控制在4–6个以内，单段视频尽量短，并选择“手机稳定优先”。';
  }
  if (/failed to fetch|fetch failed|networkerror|network request failed|err_internet_disconnected|err_network_changed|网络连接失败|网络不可用/i.test(raw)) {
    return '视频导出引擎下载失败，通常是网络连接不稳定。请切换稳定网络后重新导出；首次导出需要加载编码组件，请保持页面打开。';
  }
  if (/not supported|unsupported|codec|编码格式|编码器/i.test(raw)) {
    return '当前浏览器或素材编码格式不兼容。建议使用最新版 Chrome，并将视频转换为 MP4（H.264）后重新上传。';
  }
  if (/decode|demux|failed to load|could not be loaded|读取视频|解码/i.test(raw)) {
    return '有素材无法正常读取，可能是文件损坏或编码不兼容。请单独播放检查该素材，或转换为 MP4（H.264）后再试。';
  }
  if (/securityerror|tainted|cross.?origin|跨域/i.test(raw)) {
    return '浏览器安全限制阻止了素材处理。请使用本机直接选择的照片或视频，不要使用网页外链素材。';
  }
  return raw;
}
