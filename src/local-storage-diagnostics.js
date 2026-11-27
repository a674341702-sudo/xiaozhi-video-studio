function formatMegabytes(bytes) {
  return (bytes / (1024 * 1024)).toFixed(bytes >= 1024 * 1024 * 100 ? 0 : 1);
}

export async function getLocalStorageFailureMessage(error, estimate = null) {
  let storage = estimate;
  if (!storage && typeof navigator !== 'undefined' && navigator.storage?.estimate) {
    try {
      storage = await navigator.storage.estimate();
    } catch (_) {
      storage = null;
    }
  }

  const name = String(error?.name || '');
  const detail = String(error?.message || '');
  const quotaFailure = name === 'QuotaExceededError' ||
    /quota|storage full|disk full|存储空间不足/i.test(detail);

  if (Number.isFinite(storage?.quota) && Number.isFinite(storage?.usage) &&
      storage.quota >= 0 && storage.usage >= 0) {
    const remaining = Math.max(0, storage.quota - storage.usage);
    const estimateText = '浏览器估算剩余空间约 ' + formatMegabytes(remaining) + ' MB';
    if (quotaFailure || remaining < 50 * 1024 * 1024) {
      return '本机存储空间可能不足，' + estimateText + '。请清理手机空间或导出完整项目包后再继续';
    }
    return '浏览器本机存储写入失败，' + estimateText + '。请检查浏览器存储权限后重试';
  }

  if (quotaFailure) {
    return '本机存储空间可能不足。请清理浏览器网站数据以外的手机空间，或先导出完整项目包并保留原素材';
  }
  return detail.slice(0, 140) || '浏览器存储不可用。请先导出完整项目包并保留原素材';
}
