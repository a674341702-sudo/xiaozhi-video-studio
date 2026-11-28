/** Release decoded source buffers and graph connections after offline rendering. */
export function releaseRenderedAudioNodes(nodes) {
  if (!Array.isArray(nodes)) return;
  for (const node of nodes) {
    try { node?.source?.stop?.(); } catch (_) {}
    try { node?.source?.disconnect?.(); } catch (_) {}
    try { node?.gain?.disconnect?.(); } catch (_) {}
    try { if (node?.source && 'buffer' in node.source) node.source.buffer = null; } catch (_) {}
  }
  nodes.length = 0;
}
