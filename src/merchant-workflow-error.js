/** Turn automatic merchant-video arrangement failures into clear retry guidance. */
export function getMerchantWorkflowErrorMessage(error) {
  const raw = String(error?.message || error || '未知错误');
  if (/out of memory|memory access out of bounds|allocation failed|array buffer allocation|cannot enlarge memory|not enough memory/i.test(raw)) {
    return '手机内存不足。已保留已上传素材，请减少素材数量或文件大小后，直接重新点击“确认后自动编排”。';
  }
  if (/decode|demux|failed to load|could not be loaded|读取视频|解码|metadata/i.test(raw)) {
    return '有照片或视频无法正常读取。已保留已上传素材，请检查对应文件能否正常打开，必要时转换为常见 JPG 或 MP4（H.264），再重新编排。';
  }
  if (/not supported|unsupported|codec|编码格式|编码器/i.test(raw)) {
    return '素材格式暂不兼容。请将视频转换为 MP4（H.264），照片转换为 JPG 后重新编排。';
  }
  if (/failed to fetch|networkerror|network request failed|网络连接|网络不可用/i.test(raw)) {
    return '网络连接不稳定，某个处理步骤未完成。请切换稳定网络后，直接重新点击“确认后自动编排”。';
  }
  const detail = raw.length > 180 ? raw.slice(0, 177) + '…' : raw;
  return '本次编排未完成，已清理未完成的时间线，上传素材和文案仍保留。请检查后直接重新点击“确认后自动编排”。原因：' + detail;
}
