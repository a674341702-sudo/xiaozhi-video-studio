/** Choose a conservative FFmpeg input budget from the browser's coarse device-memory hint. */
export function getDefaultExportFrameBudget(deviceMemory, mobileSafe = true) {
  if (!mobileSafe) return 768 * 1024 * 1024;
  const memory = Number(deviceMemory);
  if (!Number.isFinite(memory) || memory <= 0) return 160 * 1024 * 1024;
  if (memory <= 2) return 96 * 1024 * 1024;
  if (memory <= 3) return 128 * 1024 * 1024;
  if (memory <= 4) return 160 * 1024 * 1024;
  return 256 * 1024 * 1024;
}
