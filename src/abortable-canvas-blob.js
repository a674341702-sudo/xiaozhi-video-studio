export function captureCanvasBlob(canvas, type, quality, abortSignal, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    if (abortSignal?.aborted) {
      reject(new DOMException('Export aborted', 'AbortError'));
      return;
    }

    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      reject(new TypeError('Canvas capture timeout must be a positive number'));
      return;
    }

    let settled = false;
    let timer = null;
    const cleanup = () => {
      abortSignal?.removeEventListener('abort', onAbort);
      if (timer !== null) clearTimeout(timer);
    };
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback(value);
    };
    const onAbort = () => finish(reject, new DOMException('Export aborted', 'AbortError'));

    abortSignal?.addEventListener('abort', onAbort, { once: true });
    timer = setTimeout(() => finish(reject, new Error('手机浏览器生成画面帧超时，可能是内存不足。请降低导出画质或缩短视频后重试。')), timeoutMs);
    try {
      canvas.toBlob(blob => {
        if (abortSignal?.aborted) {
          onAbort();
          return;
        }
        finish(resolve, blob);
      }, type, quality);
    } catch (error) {
      finish(reject, error);
    }
  });
}
