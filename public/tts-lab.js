const $ = (id) => document.getElementById(id);
let tts = null;
let loadingPromise = null;
let audioUrl = null;
const MODEL_ID = 'onnx-community/Kokoro-82M-v1.1-zh-ONNX';
const VOICE_PATH = 'https://huggingface.co/onnx-community/Kokoro-82M-v1.1-zh-ONNX/resolve/main/voices';

function status(message) { $('status').textContent = message; }
function explainTTSError(error) {
  const message = String(error?.message || error || '');
  if (/failed to fetch|networkerror|load failed|fetch failed|网络|超时/i.test(message)) {
    return '网络连接失败：配音程序或约166MB的中文模型/声音文件没有成功下载。中国大陆网络访问 Hugging Face、esm.sh 可能不稳定。请切换稳定 Wi-Fi 后重试；这不是你操作错了。';
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
    const options = {
      dtype: 'q4f16',
      voicePath: VOICE_PATH
    };
    // Some phones expose navigator.gpu but cannot initialize a usable adapter.
    // Retry with WASM so a WebGPU startup failure does not block all TTS.
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

$('generate').addEventListener('click', async () => {
  const text = $('script').value.trim();
  if (!text) { status('请先输入中文配音文案。'); return; }
  if (text.length > 500) { status('手机测试版建议控制在500字以内，较长文案请分段生成。'); return; }
  const button = $('generate');
  button.disabled = true;
  $('player').hidden = true;
  $('download').hidden = true;
  try {
    const engine = await loadModel();
    status('中文模型已就绪，正在合成语音……');
    const audio = await engine.generate(text, {
      voice: $('voice').value,
      speed: Number($('speed').value)
    });
    const blob = audio.toBlob();
    if (!(blob instanceof Blob) || blob.size < 1000) throw new Error('语音文件生成失败或内容为空。');
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioUrl = URL.createObjectURL(blob);
    $('player').src = audioUrl;
    $('player').hidden = false;
    $('download').href = audioUrl;
    $('download').hidden = false;
    status('生成成功！请先播放检查发音、语速和停顿；满意后下载 WAV，再回到主工作台上传配音文件。');
  } catch (error) {
    console.error('[中文配音实验室]', error);
    status('生成失败：' + explainTTSError(error));
  } finally { button.disabled = false; }
});
