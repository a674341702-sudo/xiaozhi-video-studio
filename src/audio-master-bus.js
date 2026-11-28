/**
 * Create one shared peak-control stage for all preview/export audio sources.
 * Browsers without DynamicsCompressorNode retain a direct output fallback.
 */
export function createAudioMasterBus(context) {
  if (!context?.destination) return { node: null, limited: false };
  if (typeof context.createDynamicsCompressor !== 'function') {
    return { node: context.destination, limited: false };
  }

  try {
    const compressor = context.createDynamicsCompressor();
    const settings = { threshold: -3, knee: 6, ratio: 12, attack: 0.003, release: 0.15 };
    for (const [key, value] of Object.entries(settings)) {
      const param = compressor[key];
      if (param && 'value' in param) param.value = value;
    }
    compressor.connect(context.destination);
    return { node: compressor, limited: true };
  } catch {
    return { node: context.destination, limited: false };
  }
}
