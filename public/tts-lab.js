const $ = (id) => document.getElementById(id);
let tts = null;
let loadingPromise = null;
let audioUrl = null;
const MODEL_ID = 'onnx-community/Kokoro-82M-v1.1-zh-ONNX';
const VOICE_PATH = 'https://huggingface.co/onnx-community/Kokoro-82M-v1.1-zh-ONNX/resolve/main/voices';

function status(message) { $('status').textContent = message; }
async function loadModel() {
  if (tts) return tts;
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    status('正在加载中文语音引擎……');
    const { KokoroTTS } = await import('https://esm.sh/@uzen/kokoro-js@1.2.4?bundle');
    const hasWebGPU = Boolean(navigator.gpu);
    const device = hasWebGPU ? 'webgpu' : 'wasm';
    status('正在下载/加载普通话模型（首次可能需要较长时间）……\n运行方式：' + (hasWebGPU ? '尝试 WebGPU' : 'WASM 兼容模式'));
    // q4f16 is a documented Kokoro.js option and is substantially smaller
    // than fp32, which is more suitable for first-time downloads on phones.
    const engine = await KokoroTTS.from_pretrained(MODEL_ID, {
      dtype: 'q4f16',
      device,
      voicePath: VOICE_PATH
    });
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
    status('生成失败：' + (error?.message || String(error)) + '\n可以刷新页面重试；如果提示 WebGPU 或模型加载错误，我们再调整兼容方案。');
  } finally { button.disabled = false; }
});
