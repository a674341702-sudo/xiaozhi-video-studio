export function captureCanvasBlob(canvas, type, quality, abortSignal) {
  return new Promise((resolve, reject) => {
    if (abortSignal?.aborted) {
      reject(new DOMException('Export aborted', 'AbortError'));
      return;
    }

    let settled = false;
    const cleanup = () => abortSignal?.removeEventListener('abort', onAbort);
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback(value);
    };
    const onAbort = () => finish(reject, new DOMException('Export aborted', 'AbortError'));

    abortSignal?.addEventListener('abort', onAbort, { once: true });
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
