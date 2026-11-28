/** Keep FFmpeg diagnostics bounded during long exports. */
export function appendBoundedExportLog(messages, message, limit = 30) {
  const safeLimit = Math.max(1, Math.floor(Number(limit) || 30));
  if (messages.length >= safeLimit) {
    messages.splice(0, messages.length - safeLimit + 1);
  }
  messages.push(String(message ?? ''));
  return messages;
}
