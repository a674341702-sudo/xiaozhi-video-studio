/**
 * Optional desktop proxy generation for smoother editing of large source videos.
 * Phone browsers skip proxy transcoding to avoid a second large WASM memory workload.
 */
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { isCurrentProxyGeneration } from './proxy-generation-guard.js';

const proxyCache = new Map();
let proxySequence = 0;

function isPhoneOrTablet() {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false;
  const touchPoints = Number(navigator.maxTouchPoints || 0);
  const mobileHint = navigator.userAgentData?.mobile === true;
  const narrowViewport = typeof window.matchMedia === 'function' &&
    window.matchMedia('(max-width: 900px)').matches;
  return mobileHint || touchPoints > 1 || narrowViewport;
}

function resolveCoreUrl(filename) {
  const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/';
  const normalized = base.endsWith('/') ? base : `${base}/`;
  return new URL(`${normalized}ffmpeg-core/${filename}`, window.location.href).href;
}

export function getProxyStatus(src) {
  return proxyCache.get(src) || { state: 'none' };
}

export async function generateProxy(file, src, targetHeight = 540, onProgress) {
  if (!file) return null;
  if (isPhoneOrTablet()) {
    proxyCache.set(src, { state: 'skipped-mobile', url: src });
    return src;
  }
  if (proxyCache.has(src)) return proxyCache.get(src).url;

  const generationEntry = { state: 'generating', url: null };
  proxyCache.set(src, generationEntry);
  try {
    const proxyUrl = await generateProxyWithFFmpeg(file, targetHeight, onProgress);
    // A project switch may revoke this source while FFmpeg is still working.
    // Do not repopulate the cache or retain an orphaned proxy Blob URL.
    if (!isCurrentProxyGeneration(proxyCache, src, generationEntry)) {
      URL.revokeObjectURL(proxyUrl);
      return src;
    }
    proxyCache.set(src, { state: 'ready', url: proxyUrl });
    return proxyUrl;
  } catch (error) {
    console.warn('Proxy generation failed, falling back to original:', error);
    if (isCurrentProxyGeneration(proxyCache, src, generationEntry)) {
      proxyCache.set(src, { state: 'failed', url: src });
    }
    return src;
  }
}

async function generateProxyWithFFmpeg(file, targetHeight, onProgress) {
  const ffmpeg = new FFmpeg();
  const suffix = `${Date.now()}_${++proxySequence}`;
  const inputName = `proxy_input_${suffix}.bin`;
  const outputName = `proxy_output_${suffix}.mp4`;
  let loaded = false;
  let logHandler = null;

  try {
    logHandler = ({ message }) => console.log('[proxy]', message);
    ffmpeg.on('log', logHandler);

    try {
      const coreURL = resolveCoreUrl('ffmpeg-core.js');
      const wasmURL = await toBlobURL(resolveCoreUrl('ffmpeg-core.wasm'), 'application/wasm');
      await ffmpeg.load({ coreURL, wasmURL });
      loaded = true;
    } catch (localError) {
      console.warn('Local proxy FFmpeg core unavailable, trying CDN fallback:', localError);
      const coreURL = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.js';
      const wasmURL = await toBlobURL(
        'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.wasm',
        'application/wasm'
      );
      await ffmpeg.load({ coreURL, wasmURL });
      loaded = true;
    }

    await ffmpeg.writeFile(inputName, await fetchFile(file));
    const args = [
      '-i', inputName,
      '-vf', `scale=-2:${Math.max(144, Math.min(1080, Math.round(targetHeight)))}`,
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', '28',
      '-pix_fmt', 'yuv420p',
      '-an',
      '-movflags', '+faststart',
      outputName
    ];

    const result = await ffmpeg.exec(args);
    if (result !== 0) throw new Error('FFmpeg proxy generation failed');

    const data = await ffmpeg.readFile(outputName);
    if (!data || data.length === 0) throw new Error('Proxy output is empty');
    const blob = new Blob([data.slice().buffer], { type: 'video/mp4' });
    return URL.createObjectURL(blob);
  } finally {
    if (logHandler) {
      try { ffmpeg.off('log', logHandler); } catch (_) {}
    }
    if (loaded) {
      for (const name of [inputName, outputName]) {
        try { await ffmpeg.deleteFile(name); } catch (_) {}
      }
      try { ffmpeg.terminate(); } catch (_) {}
    }
  }
}

export function revokeProxy(src) {
  const entry = proxyCache.get(src);
  if (entry?.url && entry.url !== src) {
    URL.revokeObjectURL(entry.url);
  }
  proxyCache.delete(src);
}
