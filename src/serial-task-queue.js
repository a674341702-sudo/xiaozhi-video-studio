/**
 * Serialize asynchronous persistence tasks while keeping each task's result.
 * A failed task does not poison the queue; later saves can still run.
 */
export function createSerialTaskQueue() {
  let tail = Promise.resolve();

  return function enqueue(task) {
    const result = tail.then(() => task());
    tail = result.then(() => undefined, () => undefined);
    return result;
  };
}
