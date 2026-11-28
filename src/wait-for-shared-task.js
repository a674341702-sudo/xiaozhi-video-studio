/** Wait for shared async work without cancelling it when one caller aborts. */
export function waitForSharedTask(task, signal) {
  if (signal?.aborted) {
    return Promise.reject(new DOMException('Export aborted', 'AbortError'));
  }
  if (!signal) return Promise.resolve(task);

  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => signal.removeEventListener('abort', onAbort);
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback(value);
    };
    const onAbort = () => finish(reject, new DOMException('Export aborted', 'AbortError'));

    signal.addEventListener('abort', onAbort, { once: true });
    Promise.resolve(task).then(
      value => finish(resolve, value),
      error => finish(reject, error)
    );
    if (signal.aborted) onAbort();
  });
}
