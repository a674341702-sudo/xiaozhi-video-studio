/**
 * Return true while project changes may still be missing from durable storage.
 * Browser unload handlers cannot guarantee an asynchronous IndexedDB write,
 * so this is used to warn before a user closes or navigates away.
 */
export function shouldWarnBeforeProjectExit(state = {}) {
  return state.dirty === true ||
    state.timerActive === true ||
    state.inProgress === true ||
    Number(state.pendingCount || 0) > 0;
}
