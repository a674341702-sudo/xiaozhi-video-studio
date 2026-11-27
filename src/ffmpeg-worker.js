/**
 * High-Quality Offline FFmpeg Composition Exporter
 * Renders composition frames headlessly and mixes audio tracks via Web Audio,
 * then muxes video + audio using FFmpeg WebAssembly.
 */
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { evaluateKeyframes } from './keyframes.js';

let ffmpeg = null;
let ffmpegLoaded = false;

const CORE_FILES = ['ffmpeg-core.js', 'ffmpeg-core.wasm'];

function resolveCoreUrl(filename) {
  const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/';
  const normalized = base.endsWith('/') ? base : `${base}/`;
  return `${normalized}ffmpeg-core/${filename}`;
}

/**
 * Loads FFmpeg WASM instance, preferring self-hosted core files.
 */
export async function loadFFmpeg(onProgress) {
  if (ffmpegLoaded && ffmpeg) return ffmpeg;

  ffmpeg = new FFmpeg();

  ffmpeg.on('log', ({ message }) => {
    console.log('[ffmpeg]', message);
  });

  if (onProgress) onProgress(0);

  try {
    const coreURL = new URL(resolveCoreUrl('ffmpeg-core.js'), window.location.href).href;
    const wasmURL = await toBlobURL(resolveCoreUrl('ffmpeg-core.wasm'), 'application/wasm');

    await ffmpeg.load({
      coreURL,
      wasmURL,
    });

    ffmpegLoaded = true;
    if (onProgress) onProgress(100);
    return ffmpeg;
  } catch (err) {
    console.warn('Self-hosted FFmpeg core failed, trying CDN fallback:', err);
    try {
      const coreURL = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.js';
      const wasmURL = await toBlobURL(
        'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.wasm',
        'application/wasm'
      );

      await ffmpeg.load({
        coreURL,
        wasmURL,
      });
      ffmpegLoaded = true;
      if (onProgress) onProgress(100);
      return ffmpeg;
    } catch (fallbackErr) {
      ffmpeg = null;
      ffmpegLoaded = false;
      const msg = fallbackErr?.message || String(fallbackErr) || 'Unknown error';
      throw new Error(`FFmpeg load failed: ${msg}`);
    }
  }
}

export function isFFmpegLoaded() {
  return ffmpegLoaded;
}

async function cleanupFiles(fileList) {
  if (!ffmpeg) return;
  for (const name of fileList) {
    try { await ffmpeg.deleteFile(name); } catch (e) {}
  }
}

function readFileAsArrayBuffer(file, abortSignal) {
  return new Promise((resolve, reject) => {
    if (abortSignal?.aborted) {
      reject(new DOMException('Export aborted', 'AbortError'));
      return;
    }
    const reader = new FileReader();
    const cleanup = () => abortSignal?.removeEventListener('abort', onAbort);
    const onAbort = () => {
      try { reader.abort(); } catch (_) {}
      cleanup();
      reject(new DOMException('Export aborted', 'AbortError'));
    };
    reader.onload = () => { cleanup(); resolve(reader.result); };
    reader.onerror = () => { cleanup(); reject(reader.error); };
    reader.onabort = () => { cleanup(); reject(new DOMException('Export aborted', 'AbortError')); };
    abortSignal?.addEventListener('abort', onAbort, { once: true });
    reader.readAsArrayBuffer(file);
  });
}

function decodeAudioData(arrayBuffer) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  return ctx.decodeAudioData(arrayBuffer.slice(0)).finally(() => {
    try { ctx.close(); } catch(e) {}
  });
}

/**
 * Resolve how an audio clip should play inside the composition.
 * Looping is opt-in (used for background music); narration never loops by default.
 */
export function getAudioClipPlaybackRange(clip, decodedDuration, compositionDuration) {
  const start = Math.max(0, Number(clip?.startTime) || 0);
  const offset = Math.max(0, Number(clip?.trimStart) || 0);
  const clipDuration = Math.max(0, Number(clip?.duration) || 0);
  const timelineRemaining = Math.max(0, Number(compositionDuration) - start);
  if (!Number.isFinite(decodedDuration) || decodedDuration <= offset ||
      clipDuration <= 0 || timelineRemaining <= 0) return null;

  const requestedDuration = Math.min(clipDuration, timelineRemaining);
  const requestedTrimEnd = Number(clip?.trimEnd);
  const sourceEnd = Number.isFinite(requestedTrimEnd) && requestedTrimEnd > offset
    ? Math.min(decodedDuration, requestedTrimEnd)
    : decodedDuration;
  if (sourceEnd <= offset) return null;

  if (clip.loop === true) {
    return { start, offset, duration: requestedDuration, loop: true, loopStart: offset, loopEnd: sourceEnd };
  }

  const availableDuration = Math.max(0, sourceEnd - offset);
  const duration = Math.min(requestedDuration, availableDuration);
  if (duration <= 0.01) return null;
  return { start, offset, duration, loop: false, loopStart: 0, loopEnd: 0 };
}

/**
 * Renders a mixed AudioBuffer for all audio/video clips in the composition.
 */
async function renderMixedAudio(composition, onProgress, abortSignal) {
  const sampleRate = 48000;
  const duration = composition.duration;
  const channels = 2;
  const length = Math.ceil(duration * sampleRate);

  if (length === 0) return null;

  const audioClips = composition.clips.filter(c => {
    if (c.type !== 'audio' && c.type !== 'video') return false;
    const track = composition.getTrack(c.trackId);
    if (track && (track.muted || !track.visible)) return false;
    // Skip muted camera audio entirely. Decoding it still allocates AudioBuffers
    // even when its gain is zero, wasting memory on mobile exports.
    const hasAudibleEnvelope = (c.keyframes?.volume || []).some(point => Number(point.value) > 0);
    if ((c.volume ?? 1) <= 0 && !hasAudibleEnvelope) return false;
    return Boolean(c.file || c.src);
  });

  if (audioClips.length === 0) return null;

  const offlineCtx = new OfflineAudioContext(channels, length, sampleRate);

  let decodedCount = 0;
  for (let i = 0; i < audioClips.length; i++) {
    if (abortSignal?.aborted) throw new DOMException('Export aborted', 'AbortError');
    const clip = audioClips[i];
    try {
      let arrayBuffer = null;
      if (clip.file) {
        arrayBuffer = await readFileAsArrayBuffer(clip.file, abortSignal);
      } else if (clip.src) {
        const res = await fetch(clip.src, { signal: abortSignal });
        arrayBuffer = await res.arrayBuffer();
      }

      if (!arrayBuffer) continue;
      const decoded = await decodeAudioData(arrayBuffer);
      arrayBuffer = null;
      if (abortSignal?.aborted) throw new DOMException('Export aborted', 'AbortError');
      if (!decoded) continue;

      const playback = getAudioClipPlaybackRange(clip, decoded.duration, duration);
      if (!playback) continue;

      const source = offlineCtx.createBufferSource();
      source.buffer = decoded;
      if (playback.loop) {
        source.loop = true;
        source.loopStart = playback.loopStart;
        source.loopEnd = playback.loopEnd;
      }

      const gain = offlineCtx.createGain();
      const baseVolume = clip.volume ?? 1;
      const clipStart = playback.start;
      const clipEnd = clipStart + playback.duration;
      const envelope = clip.keyframes?.volume || [];
      const initialVolume = evaluateKeyframes(clip.keyframes, 'volume', clipStart);
      gain.gain.setValueAtTime(initialVolume ?? baseVolume, clipStart);
      for (const point of [...envelope].sort((a, b) => a.time - b.time)) {
        if (point.time > clipStart && point.time < clipEnd) {
          gain.gain.linearRampToValueAtTime(Math.max(0, Number(point.value) || 0), point.time);
        }
      }
      if (envelope.length) {
        const endingVolume = evaluateKeyframes(clip.keyframes, 'volume', clipEnd);
        gain.gain.linearRampToValueAtTime(endingVolume ?? baseVolume, clipEnd);
      }

      source.connect(gain);
      gain.connect(offlineCtx.destination);

      source.start(playback.start, playback.offset, playback.duration);

      decodedCount++;
      if (onProgress) onProgress(Math.round(((i + 1) / audioClips.length) * 100));
    } catch (err) {
      const label = clip.name || '未命名音频';
      throw new Error(`音频“${label}”读取或解码失败：${err?.message || '格式不受支持'}。请尝试转换为 MP3 或 WAV 后重新导入。`);
    }
  }

  if (decodedCount === 0) return null;
  if (abortSignal?.aborted) throw new DOMException('Export aborted', 'AbortError');

  const mixed = await offlineCtx.startRendering();
  if (abortSignal?.aborted) throw new DOMException('Export aborted', 'AbortError');
  return mixed;
}

/**
 * Converts an AudioBuffer to a standard 16-bit stereo PCM WAV Blob.
 */
function audioBufferToWav(buffer) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataByteCount = buffer.length * blockAlign;
  const bufferByteCount = 44 + dataByteCount;

  const arrayBuffer = new ArrayBuffer(bufferByteCount);
  const view = new DataView(arrayBuffer);

  function writeString(offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataByteCount, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, dataByteCount, true);

  let offset = 44;
  const channels = [];
  for (let i = 0; i < numChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  for (let i = 0; i < buffer.length; i++) {
    for (let c = 0; c < numChannels; c++) {
      let sample = Math.max(-1, Math.min(1, channels[c][i]));
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, sample, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function seekVideoToOffset(video, offset, abortSignal) {
  return new Promise((resolve, reject) => {
    if (abortSignal?.aborted) {
      reject(new DOMException('Export aborted', 'AbortError'));
      return;
    }
    const safeOffset = Number.isFinite(video.duration)
      ? Math.max(0, Math.min(offset, Math.max(0, video.duration - 0.04)))
      : Math.max(0, offset);
    if (Math.abs(video.currentTime - safeOffset) < 0.01 && video.readyState >= 2) {
      resolve();
      return;
    }
    let handled = false;
    let timer = null;
    const cleanup = (error = null) => {
      if (handled) return;
      handled = true;
      clearTimeout(timer);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      abortSignal?.removeEventListener('abort', onAbort);
      if (error) reject(error);
      else resolve();
    };
    const onError = () => cleanup(new Error('视频定位失败，请检查视频文件是否损坏或格式是否受支持。'));
    const onAbort = () => cleanup(new DOMException('Export aborted', 'AbortError'));
    const onSeeked = () => {
      // Wait for a decoded frame where supported, otherwise wait one paint.
      if (typeof video.requestVideoFrameCallback === 'function') {
        video.requestVideoFrameCallback(() => cleanup());
      } else {
        requestAnimationFrame(() => cleanup());
      }
    };
    video.addEventListener('seeked', onSeeked, { once: true });
    video.addEventListener('error', onError, { once: true });
    abortSignal?.addEventListener('abort', onAbort, { once: true });
    timer = setTimeout(() => cleanup(new Error('等待视频画面定位超时，请尝试更短或更兼容的 MP4 素材。')), 3000);
    try {
      video.currentTime = safeOffset;
    } catch (error) {
      cleanup(error);
    }
  });
}

/**
 * Validate timeline media references before expensive browser/WASM allocations.
 * Export must fail clearly rather than silently render missing assets as blanks.
 */
export function validateCompositionMedia(composition) {
  if (!composition || !Array.isArray(composition.clips)) {
    throw new Error('项目时间线数据无效，请重新打开项目后重试。');
  }
  const mediaClips = composition.clips.filter(clip => ['video', 'image', 'audio'].includes(clip.type));
  for (const clip of mediaClips) {
    const label = clip.name || '未命名素材';
    if (!Number.isFinite(clip.startTime) || clip.startTime < 0 ||
        !Number.isFinite(clip.duration) || clip.duration <= 0) {
      throw new Error(`素材“${label}”的时间或时长无效，请删除后重新导入。`);
    }
    if (clip.type === 'video') {
      if (!clip.element || !clip.element.videoWidth || !clip.element.videoHeight) {
        throw new Error(`视频“${label}”尚未准备好或原始文件已丢失，请重新导入该视频后再导出。`);
      }
    } else if (clip.type === 'image') {
      if (!clip.element || !clip.element.naturalWidth || !clip.element.naturalHeight) {
        throw new Error(`图片“${label}”尚未加载或原始文件已丢失，请重新导入该图片后再导出。`);
      }
    } else if (!clip.file && !clip.src) {
      throw new Error(`音频“${label}”缺少原始文件，请重新导入后再导出。`);
    }
  }
  return true;
}

/**
 * High quality offline frame export with audio mixing and FFmpeg MP4 encoding.
 */
export async function exportComposition(composition, canvasPreview, onProgress, abortSignal, options = {}) {
  const duration = composition.duration;
  if (duration <= 0) {
    throw new Error('时间线上没有可导出的内容。');
  }

  if (abortSignal?.aborted) {
    throw new DOMException('Export aborted', 'AbortError');
  }

  function checkAborted() {
    if (abortSignal?.aborted) {
      throw new DOMException('Export aborted', 'AbortError');
    }
  }

  const width = options.width || composition.width || 1920;
  const height = options.height || composition.height || 1080;
  const fps = options.fps || 30;
  const quality = options.quality || 'high';
  const totalFramesEstimate = Math.ceil(duration * fps);

  validateCompositionMedia(composition);

  // FFmpeg.wasm keeps imported frames in its virtual filesystem until encoding.
  // Bound the workload on phones before allocating hundreds of large JPEG frames.
  const maxFrames = options.mobileSafe === false ? 1800 : 900;
  if (totalFramesEstimate > maxFrames) {
    throw new Error(`手机安全导出最多支持约 ${Math.floor(maxFrames / fps)} 秒（当前设置会生成 ${totalFramesEstimate} 帧）。请缩短视频，或选择较低帧率后重试。`);
  }
  if (width * height > 1920 * 1080) {
    throw new Error('当前导出分辨率过高，手机端建议使用720p左右画幅后重试。');
  }

  if (onProgress) onProgress(0, 'Loading FFmpeg');

  if (!ffmpegLoaded || !ffmpeg) {
    await loadFFmpeg();
  }

  checkAborted();

  const inputFiles = [];
  let offscreenCanvas = null;

  try {
    if (onProgress) onProgress(5, 'Rendering mixed audio');

    let audioBuffer = null;
    try {
      audioBuffer = await renderMixedAudio(composition, (pct) => {
        if (onProgress) onProgress(5 + Math.round(pct * 0.15), 'Rendering mixed audio');
      }, abortSignal);
    } catch (audioErr) {
      // Never silently export a silent video when the user added narration or music.
      // Make the audio problem visible so the user can fix it and retry.
      throw new Error(`配乐或配音处理失败，已停止导出，避免生成无声视频。原因：${audioErr?.message || '音频处理异常'}`);
    }

    checkAborted();
    const hasAudio = Boolean(audioBuffer && audioBuffer.length > 0 && audioBuffer.duration > 0.05);

    // Encode mixed audio now, then release its large AudioBuffer before the
    // JPEG frame sequence accumulates in FFmpeg's virtual filesystem.
    if (hasAudio) {
      let wavBlob = audioBufferToWav(audioBuffer);
      let wavData = await fetchFile(wavBlob);
      await ffmpeg.writeFile('audio.wav', wavData);
      inputFiles.push('audio.wav');
      wavData = null;
      wavBlob = null;
      audioBuffer = null;
    }

    if (onProgress) onProgress(20, 'Rendering video frames');

    offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = width;
    offscreenCanvas.height = height;
    const offCtx = offscreenCanvas.getContext('2d');

    const totalFrames = Math.ceil(duration * fps);
    const frameDuration = 1 / fps;
    const videoClips = composition.clips.filter(c => c.type === 'video' && c.element);

    const jpegQuality = quality === 'low' ? 0.68 : quality === 'medium' ? 0.78 : 0.88;

    for (let f = 0; f < totalFrames; f++) {
      checkAborted();
      const time = f * frameDuration;

      const seekPromises = [];
      for (const vClip of videoClips) {
        if (time >= vClip.startTime && time <= vClip.startTime + vClip.duration) {
          const offset = time - vClip.startTime + vClip.trimStart;
          seekPromises.push(seekVideoToOffset(vClip.element, offset, abortSignal));
        }
      }
      if (seekPromises.length > 0) {
        await Promise.all(seekPromises);
      }

      canvasPreview.renderOffline(offCtx, time, width, height);

      const frameBlob = await new Promise((resolve) => {
        offscreenCanvas.toBlob(resolve, 'image/jpeg', jpegQuality);
      });

      if (!frameBlob) {
        throw new Error(`Failed to capture canvas frame ${f}`);
      }

      const frameName = `frame_${String(f).padStart(5, '0')}.jpg`;
      const frameBuffer = await fetchFile(frameBlob);
      await ffmpeg.writeFile(frameName, frameBuffer);
      inputFiles.push(frameName);

      const progressPct = 20 + Math.round((f / totalFrames) * 60);
      if (onProgress) onProgress(progressPct, 'Rendering video frames');
    }

    if (onProgress) onProgress(82, 'Encoding video');

    const logMessages = [];
    const logCb = ({ message }) => {
      logMessages.push(message);
      console.log('[ffmpeg]', message);
    };
    ffmpeg.on('log', logCb);

    const args = [
      '-framerate', String(fps),
      '-start_number', '0',
      '-i', 'frame_%05d.jpg',
    ];

    if (hasAudio) {
      args.push('-i', 'audio.wav');
    }

    args.push(
      '-vf', `pad=ceil(iw/2)*2:ceil(ih/2)*2`,
      '-c:v', 'libx264',
      '-preset', quality === 'low' ? 'superfast' : 'ultrafast',
      '-crf', quality === 'high' ? '23' : quality === 'medium' ? '26' : '29',
      '-pix_fmt', 'yuv420p'
    );

    if (hasAudio) {
      args.push('-c:a', 'aac', '-b:a', quality === 'low' ? '96k' : '128k');
    } else {
      args.push('-an');
    }

    // Preserve the complete composition even when a source audio file is shorter.
    args.push('-t', duration.toFixed(3));
    args.push('export.mp4');

    inputFiles.push('export.mp4');
    let ret;
    const encoder = ffmpeg;
    const terminateEncoder = () => {
      // FFmpeg.wasm cannot interrupt an active exec command through AbortSignal.
      // Terminating its worker is the supported hard-cancel path; a later export
      // will lazily create and load a fresh instance.
      try { encoder.terminate(); } catch (_) {}
      if (ffmpeg === encoder) {
        ffmpeg = null;
        ffmpegLoaded = false;
      }
    };
    if (abortSignal) abortSignal.addEventListener('abort', terminateEncoder, { once: true });
    try {
      checkAborted();
      ret = await encoder.exec(args);
      checkAborted();
    } finally {
      if (abortSignal) abortSignal.removeEventListener('abort', terminateEncoder);
      try { encoder.off('log', logCb); } catch (_) {}
    }

    if (ret !== 0) {
      const errDetail = logMessages.slice(-15).join('\n');
      throw new Error(`FFmpeg encoding failed (exit code ${ret}):\n${errDetail}`);
    }

    if (onProgress) onProgress(95, 'Finalizing export');

    const mp4Data = await ffmpeg.readFile('export.mp4');

    if (!mp4Data || mp4Data.length === 0) {
      throw new Error('FFmpeg failed to produce output MP4');
    }

    if (onProgress) onProgress(100, 'Export complete');
    return { blob: new Blob([mp4Data.slice().buffer], { type: 'video/mp4' }), ext: 'mp4' };
  } finally {
    await cleanupFiles(inputFiles);
    if (offscreenCanvas) {
      offscreenCanvas.width = 0;
      offscreenCanvas.height = 0;
      offscreenCanvas = null;
    }
  }
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);

  try {
    // Mobile browsers may take longer than desktop browsers to hand the
    // object URL to the download manager. Keep the URL alive long enough
    // for Android Chrome/WebView to begin reading the MP4.
    a.click();
  } catch (error) {
    URL.revokeObjectURL(url);
    a.remove();
    throw error;
  }

  // The click has been dispatched; remove the temporary anchor, but do not
  // revoke the Blob URL immediately or after an overly short 1-second delay.
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
