const $ = (id) => document.getElementById(id);
let tts = null;
let loadingPromise = null;
let audioUrl = null;
const MODEL_ID = 'onnx-community/Kokoro-82M-v1.1-zh-ONNX';
const VOICE_PATH = 'https://huggingface.co/onnx-community/Kokoro-82M-v1.1-zh-ONNX/resolve/main/voices';

function status(message) { $('status').textContent = message; }

// Receive the narration passed from the main workflow through the URL fragment.
// Fragments are not sent to the hosting server; clear it after reading to avoid
// leaving merchant copy in the visible address bar or browser history.
try {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const incomingText = params.get('text');
  if (incomingText) {
    $('script').value = incomingText.slice(0, 500);
    history.replaceState(null, '', window.location.pathname + window.location.search);
    status('已从商家工作台带入配音稿。请选择声音和语速，然后点击生成普通话配音。');
  }
} catch (error) {
  console.warn('[中文配音实验室] 无法读取传入的配音稿：', error);
}

function explainTTSError(error) {
  const message = String(error?.message || error || '');
  if (/failed to fetch|networkerror|load failed|fetch failed|网络|超时/i.test(message)) {
    return '网络连接失败：配音程序或中文模型/声音文件没有成功下载。中国大陆网络访问 Hugging Face、esm.sh 可能不稳定。请切换稳定 Wi-Fi 后重试；这不是你操作错了。';
  }
  if (/out of memory|memory|allocation failed|array buffer/i.test(message)) {
    return '手机可用内存不足：请关闭其他应用，刷新页面后先用短句测试；如果仍失败，说明这台手机可能无法顺利运行本地中文模型。';
  }
  if (/webgpu|gpu|adapter|wasm|onnxruntime/i.test(message)) {
    return '手机浏览器的 GPU/WASM 运行环境不兼容或初始化失败。请使用最新版 Chrome/系统浏览器重试；如果仍失败，需要更换配音方案。';
  }
  return '暂时无法生成：' + (message || '未知错误') + '。请刷新页面再试一次；如果重复出现，请把这段提示发给小智排查。';
}
async function loadModel() {
  if (tts) return tts;
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    status('正在加载中文语音引擎……');
    const { KokoroTTS } = await import('https://esm.sh/@uzen/kokoro-js@1.2.4?bundle');
    const hasWebGPU = Boolean(navigator.gpu);
    const options = { dtype: 'q4f16', voicePath: VOICE_PATH };
    if (hasWebGPU) {
      status('正在尝试手机 GPU 加速，并加载普通话模型（首次下载可能较久）……');
      try {
        const engine = await KokoroTTS.from_pretrained(MODEL_ID, { ...options, device: 'webgpu' });
        tts = engine;
        return engine;
      } catch (gpuError) {
        console.warn('[中文配音] WebGPU 初始化失败，改用 WASM：', gpuError);
        status('手机 GPU 模式不可用，正在切换兼容模式（WASM）……');
      }
    } else {
      status('正在加载普通话模型（首次下载可能较久）……\n运行方式：WASM 兼容模式');
    }
    const engine = await KokoroTTS.from_pretrained(MODEL_ID, { ...options, device: 'wasm' });
    tts = engine;
    return engine;
  })();
  try { return await loadingPromise; }
  catch (error) { loadingPromise = null; throw error; }
}

// 将分段生成的 Float32 PCM 直接写入一个 WAV 文件，避免再创建一份完整 PCM 副本。
// 分块构造 WAV：避免一次性申请与整段音频等大的连续 ArrayBuffer。
function chunksToWav(pcmChunks, sampleRate) {
  const totalSamples = pcmChunks.reduce((sum, chunk) => sum + chunk.length, 0);
  if (!totalSamples) throw new Error('没有生成有效的语音采样数据。');
  const dataSize = totalSamples * 2;
  if (dataSize > 0xffffffff - 36) throw new Error('生成的配音文件过大，请缩短文案后重试。');

  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const writeText = (offset, value) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  writeText(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeText(8, 'WAVE');
  writeText(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, 'data');
  view.setUint32(40, dataSize, true);

  const parts = [header];
  for (const pcm of pcmChunks) parts.push(pcm);
  return new Blob(parts, { type: 'audio/wav' });
}

$('generate').addEventListener('click', async () => {
  const text = $('script').value.trim();
  if (!text) { status('请先输入中文配音文案。'); return; }
  if (text.length > 500) { status('手机测试版建议控制在500字以内，较长文案请分段生成。'); return; }
  const button = $('generate');
  button.disabled = true;
  // Release the previous preview before starting another synthesis so a long
  // generated WAV does not remain in memory while the next model run executes.
  $('player').pause();
  $('player').removeAttribute('src');
  $('player').load();
  $('player').hidden = true;
  $('download').removeAttribute('href');
  $('download').hidden = true;
  if (audioUrl) {
    URL.revokeObjectURL(audioUrl);
    audioUrl = null;
  }
  try {
    const engine = await loadModel();
    status('中文模型已就绪，正在分段合成语音……');
    const pcmChunks = [];
    let sampleRate = 24000;
    let chunkCount = 0;
    for await (const part of engine.stream(text, {
      voice: $('voice').value,
      speed: Number($('speed').value)
    })) {
      const raw = part?.audio;
      const samples = raw?.audio;
      if (!(samples instanceof Float32Array) || !samples.length) {
        throw new Error('分段语音数据格式不正确，请反馈此提示。');
      }
      const partSampleRate = Number(raw.sampling_rate || raw.samplingRate || sampleRate);
      if (!Number.isInteger(partSampleRate) || partSampleRate <= 0) {
        throw new Error('语音采样率无效，请重新生成。');
      }
      if (chunkCount > 0 && partSampleRate !== sampleRate) {
        throw new Error('语音分段的采样率不一致，已停止生成以避免音频播放速度异常。');
      }
      sampleRate = partSampleRate;
      // Convert immediately so the whole utterance's Float32 chunks are not retained.
      const pcm = new Int16Array(samples.length);
      for (let i = 0; i < samples.length; i++) {
        const value = Math.max(-1, Math.min(1, Number.isFinite(samples[i]) ? samples[i] : 0));
        pcm[i] = value < 0 ? value * 32768 : value * 32767;
      }
      pcmChunks.push(pcm);
      chunkCount++;
      status('正在生成普通话配音……\n已完成 ' + chunkCount + ' 段，请保持页面打开。');
    }
    const blob = chunksToWav(pcmChunks, sampleRate);
    // Try to return the generated WAV directly to the same-origin main workspace.
    // If the workspace is closed or BroadcastChannel is unavailable, keep the normal download path.
    let deliveredToWorkspace = false;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const channel = new BroadcastChannel('xiaozhi-tts-audio-v1');
        deliveredToWorkspace = await new Promise(resolve => {
          let settled = false;
          const finish = value => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            channel.close();
            resolve(value);
          };
          const timer = setTimeout(() => finish(false), 1600);
          channel.onmessage = event => {
            if (event.data?.type === 'xiaozhi-tts-audio-ack') finish(true);
          };
          channel.postMessage({ type: 'xiaozhi-tts-audio', blob, filename: '小智普通话配音.wav' });
        });
      } catch (error) {
        console.warn('[中文配音实验室] 自动回传失败，将保留下载方式：', error);
      }
    }
    if (!(blob instanceof Blob) || blob.size < 1000) throw new Error('语音文件生成失败或内容为空。');
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioUrl = URL.createObjectURL(blob);
    $('player').src = audioUrl;
    $('player').hidden = false;
    $('download').href = audioUrl;
    $('download').hidden = false;
    status('生成成功！共分段生成 ' + chunkCount + ' 段。请先试听发音、语速和停顿；' + (deliveredToWorkspace ? '配音已自动传回主工作台，可切回工作台查看。' : '主工作台未确认接收（可能未打开或自动导入失败），可下载 WAV 后手动上传。'));
  } catch (error) {
    console.error('[中文配音实验室]', error);
    status('生成失败：' + explainTTSError(error));
  } finally { button.disabled = false; }
});


// Do not revoke the preview URL on pagehide: mobile browsers may fire
// pagehide while handing the WAV link to the download manager. The browser
// releases document-scoped object URLs when the page is discarded; the next
// synthesis explicitly revokes the previous preview URL above.
