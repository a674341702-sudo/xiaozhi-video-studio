import { getSubtitlePositionLayout } from './text-layout.js';
import { applySubtitleTimeOffset, prepareSubtitleImportSegments } from './subtitle-import-rules.js';
/**
 * 小智中文自动字幕实验室
 * 采用 browser-whisper 开源项目的浏览器端识别能力。
 * 首次使用需从 esm.sh / Hugging Face 下载运行代码与模型；素材在浏览器本地处理。
 * 上游项目： https://github.com/tanpreetjolly/browser-whisper
 */
export function initSubtitleStudio({ composition, onCompositionChanged }) {
  if (document.getElementById('xiaozhi-subtitle-launcher')) return;

  const style = document.createElement('style');
  style.textContent = `
    #xiaozhi-subtitle-launcher{position:fixed;left:14px;bottom:18px;z-index:1799;border:1px solid #565078;border-radius:999px;padding:12px 15px;background:#202039;color:#fff;font-weight:800;box-shadow:0 8px 24px #0008;cursor:pointer}
    #xiaozhi-subtitle-modal{position:fixed;inset:0;z-index:2000;display:none;align-items:center;justify-content:center;padding:10px;background:#080812f5;color:#f5f5ff;font:14px/1.55 system-ui,sans-serif}
    #xiaozhi-subtitle-modal.open{display:flex}
    .xzs-card{box-sizing:border-box;width:min(680px,100%);height:min(92dvh,850px);overflow:auto;background:#151526;border:1px solid #383852;border-radius:18px;padding:16px;box-shadow:0 20px 70px #000b}
    .xzs-head{position:sticky;top:-16px;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:10px;background:#151526;padding:7px 0 12px}
    .xzs-head h2{font-size:19px;margin:0}.xzs-close,.xzs-secondary{background:#303047;color:#fff;border:0;border-radius:10px;padding:10px 13px}
    .xzs-note{font-size:12px;color:#aaaac4;margin:8px 0}
    .xzs-panel{border:1px solid #33334b;background:#1c1c30;border-radius:12px;padding:12px;margin:12px 0}
    .xzs-panel label{display:block;color:#d0d0e4;margin:8px 0}
    .xzs-panel input,.xzs-panel select{box-sizing:border-box;width:100%;margin-top:5px;border:1px solid #454563;background:#10101d;color:#fff;border-radius:9px;padding:11px;font:inherit}
    .xzs-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
    .xzs-primary{flex:1;min-height:44px;border:0;border-radius:10px;padding:11px 14px;background:linear-gradient(120deg,#7c3aed,#0891b2);color:#fff;font-weight:800}
    .xzs-primary:disabled{opacity:.5}
    .xzs-status{padding:11px;border-radius:9px;background:#10101d;color:#c4b5fd;white-space:pre-wrap;margin-top:10px}
    .xzs-progress{height:7px;background:#303047;border-radius:8px;overflow:hidden;margin-top:9px}.xzs-progress span{display:block;height:100%;width:0;background:#8b5cf6;transition:width .2s}
    .xzs-list{max-height:260px;overflow:auto}.xzs-row{padding:10px 2px;border-bottom:1px solid #33334b}.xzs-time{color:#a78bfa;font-variant-numeric:tabular-nums;font-size:12px}
    .xzs-edit-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin:7px 0}
    .xzs-edit-grid label{font-size:11px;color:#aaaac4;margin:0}
    .xzs-edit-grid input,.xzs-row textarea{box-sizing:border-box;width:100%;border:1px solid #454563;background:#10101d;color:#fff;border-radius:8px;padding:8px;font:inherit}
    .xzs-row textarea{min-height:54px;resize:vertical}
    .xzs-row-head{display:flex;justify-content:space-between;align-items:center;gap:8px}
    .xzs-delete{border:0;border-radius:8px;background:#512b38;color:#ffd6df;padding:7px 10px}

    @media(max-width:560px){#xiaozhi-subtitle-modal{padding:0;align-items:stretch}.xzs-card{height:100dvh;max-height:100dvh;border-radius:0;padding:14px}.xzs-head{top:-14px}}
  `;
  document.head.appendChild(style);

  const launcher = document.createElement('button');
  launcher.id = 'xiaozhi-subtitle-launcher';
  launcher.type = 'button';
  launcher.textContent = '字幕实验室';
  document.body.appendChild(launcher);

  const modal = document.createElement('div');
  modal.id = 'xiaozhi-subtitle-modal';
  modal.innerHTML = `
    <section class="xzs-card" role="dialog" aria-modal="true" aria-label="中文自动字幕实验室">
      <div class="xzs-head"><h2>字幕实验室 · 中文语音识别</h2><button class="xzs-close" id="xzs-close" type="button">关闭</button></div>
      <p class="xzs-note">选择一段门店视频或音频，尝试自动识别普通话并生成带时间轴的字幕。素材在本机浏览器处理，不上传到小智服务器。</p>
      <div class="xzs-panel">
        <label>选择视频 / 音频文件<input id="xzs-file" type="file" accept="video/*,audio/*"></label>
        <label>识别模型<select id="xzs-model"><option value="whisper-tiny">轻量模型 · 约120MB（手机先试这个）</option><option value="whisper-base">基础模型 · 约206MB（更占内存）</option></select></label>
        <p class="xzs-note">首次使用需要联网下载识别程序和模型；国内网络可能无法稳定连接模型源。建议先用短音频测试，避免手机内存不足。</p>
        <div class="xzs-actions"><button id="xzs-start" class="xzs-primary" type="button">开始识别中文</button></div>
        <div class="xzs-status" id="xzs-status" role="status">等待选择素材。识别结果需要人工校对，尤其是店名、价格和地址。</div>
        <div class="xzs-progress"><span id="xzs-progress"></span></div>
      </div>
      <div class="xzs-panel">
        <strong>识别结果与字幕校对</strong>
        <label>字幕样式<select id="xzs-style">
          <option value="classic">经典白字 · 半透明黑底</option>
          <option value="yellow">醒目黄字 · 深色底</option>
          <option value="clean">简洁白字 · 无底色</option>
        </select></label>
        <label>字幕位置<select id="xzs-position">
          <option value="bottom">底部安全区 · 默认</option>
          <option value="top">顶部安全区 · 避开底部主体</option>
          <option value="middle">画面居中 · 适合纯背景镜头</option>
        </select></label>
        <p class="xzs-note">如果商品、菜品或招牌在画面下方，可改选顶部；位置仍可在导入后于预览画面中拖动微调。</p>
        <label>字幕整体时间偏移（秒）<input id="xzs-offset" type="number" step="0.1" min="-600" max="600" value="0"></label>
        <p class="xzs-note">字幕比配音早：填正数让字幕延后；字幕比配音晚：填负数让字幕提前。每次可微调 0.1 秒。</p>
        <p class="xzs-note">可直接修改每句文字和起止时间，也可以删除不需要的句子。时间单位为秒。</p>
        <div class="xzs-list" id="xzs-results"><p class="xzs-note">识别完成后，字幕会显示在这里。</p></div>
        <div class="xzs-actions">
          <button class="xzs-secondary" id="xzs-download" type="button" disabled>下载 SRT 字幕</button>
          <button class="xzs-primary" id="xzs-import" type="button" disabled>导入到视频时间线</button>
        </div>
      </div>
    </section>`;
  document.body.appendChild(modal);

  const $ = (id) => { const element = modal.querySelector('#' + id); if (!element) throw new Error('字幕实验室缺少页面元素 #' + id); return element; };
  const state = { segments: [], busy: false, transcriber: null };

  const fmt = (seconds) => {
    const ms = Math.max(0, Math.round(Number(seconds || 0) * 1000));
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const milli = ms % 1000;
    return [h, m, s].map(v => String(v).padStart(2, '0')).join(':') + ',' + String(milli).padStart(3, '0');
  };

  const srtText = () => state.segments.map((seg, i) =>
    `${i + 1}\n${fmt(seg.start)} --> ${fmt(seg.end)}\n${String(seg.text || '').trim()}\n`
  ).join('\n');

  const render = () => {
    const list = $('xzs-results');
    if (!state.segments.length) {
      list.innerHTML = '<p class="xzs-note">识别完成后，字幕会显示在这里。</p>';
    } else {
      list.replaceChildren();
      state.segments.forEach((seg, index) => {
        const row = document.createElement('div');
        row.className = 'xzs-row';
        const head = document.createElement('div');
        head.className = 'xzs-row-head';
        const time = document.createElement('div');
        time.className = 'xzs-time';
        time.textContent = `第 ${index + 1} 句`;
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'xzs-delete';
        remove.dataset.removeIndex = String(index);
        remove.textContent = '删除';
        head.append(time, remove);

        const times = document.createElement('div');
        times.className = 'xzs-edit-grid';
        for (const [field, labelText] of [['start', '开始时间（秒）'], ['end', '结束时间（秒）']]) {
          const label = document.createElement('label');
          label.textContent = labelText;
          const input = document.createElement('input');
          input.type = 'number';
          input.min = '0';
          input.step = '0.1';
          input.value = String(Number(seg[field] || 0).toFixed(1));
          input.dataset.timeIndex = String(index);
          input.dataset.timeField = field;
          label.appendChild(input);
          times.appendChild(label);
        }

        const text = document.createElement('textarea');
        text.value = seg.text || '';
        text.setAttribute('aria-label', `编辑第 ${index + 1} 句字幕`);
        text.dataset.textIndex = String(index);
        row.append(head, times, text);
        list.appendChild(row);
      });
    }
    $('xzs-download').disabled = !state.segments.length;
    $('xzs-import').disabled = !state.segments.length;
  };

  $('xzs-results').addEventListener('input', (event) => {
    const textIndex = event.target.dataset.textIndex;
    if (textIndex !== undefined) {
      const segment = state.segments[Number(textIndex)];
      if (segment) segment.text = event.target.value;
    }
  });

  $('xzs-results').addEventListener('change', (event) => {
    const index = Number(event.target.dataset.timeIndex);
    const field = event.target.dataset.timeField;
    if (!Number.isInteger(index) || !field) return;
    const segment = state.segments[index];
    if (!segment) return;
    const value = Math.max(0, Number(event.target.value) || 0);
    if (field === 'start') segment.start = Math.min(value, Math.max(0, segment.end - 0.1));
    else segment.end = Math.max(value, segment.start + 0.1);
    render();
  });

  $('xzs-results').addEventListener('click', (event) => {
    const index = Number(event.target.dataset.removeIndex);
    if (!Number.isInteger(index)) return;
    state.segments.splice(index, 1);
    render();
    setStatus(`已删除字幕，当前剩余 ${state.segments.length} 句。`);
  });

  const setStatus = (message, progress) => {
    $('xzs-status').textContent = message;
    if (Number.isFinite(progress)) $('xzs-progress').style.width = `${Math.max(0, Math.min(100, progress * 100))}%`;
  };

  const close = () => modal.classList.remove('open');
  launcher.addEventListener('click', () => modal.classList.add('open'));
  $('xzs-close').addEventListener('click', close);
  modal.addEventListener('click', (event) => { if (event.target === modal && !state.busy) close(); });

  $('xzs-start').addEventListener('click', async () => {
    const file = $('xzs-file').files?.[0];
    if (!file) {
      setStatus('请先选择一段视频或音频文件。');
      return;
    }
    if (file.size > 80 * 1024 * 1024) {
      setStatus('这份素材超过 80MB，手机识别容易占满内存。请先裁剪成较短片段，或使用压缩后的音频文件再识别。');
      return;
    }
    if (state.busy) return;
    state.busy = true;
    state.segments = [];
    render();
    $('xzs-start').disabled = true;
    setStatus('正在加载浏览器语音识别组件……首次使用可能需要等待网络下载。', 0);
    try {
      const moduleUrl = 'https://esm.sh/browser-whisper@2.0.0?bundle';
      const { BrowserWhisper } = await import(/* @vite-ignore */ moduleUrl);
      const model = $('xzs-model').value;
      const whisper = new BrowserWhisper({ model, language: 'zh' });
      state.transcriber = whisper;
      setStatus('识别引擎已启动，正在读取素材……', 0.03);
      const stream = whisper.transcribe(file, {
        language: 'zh',
        onProgress: ({ stage, progress }) => {
          const labels = { loading: '正在下载 / 加载中文识别模型', decoding: '正在解析音视频', transcribing: '正在识别语音', done: '识别完成' };
          setStatus(`${labels[stage] || '正在处理'}（${Math.round((progress || 0) * 100)}%）`, progress);
        }
      });
      for await (const segment of stream) {
        const text = String(segment.text || '').trim();
        if (text) {
          if (state.segments.length >= 500) {
            throw new Error('识别结果超过 500 条，已停止继续处理。请将素材分成更短的片段后分别识别。');
          }
          const start = Math.max(0, Number(segment.start) || 0);
          const rawEnd = Number(segment.end);
          const end = Number.isFinite(rawEnd) && rawEnd > start ? rawEnd : start + 2;
          state.segments.push({ start, end, text });
          render();
        }
      }
      if (!state.segments.length) {
        setStatus('没有识别到语音。请确认素材中有人声，并尝试更清晰、较短的音频。', 0);
      } else {
        setStatus(`识别完成，共得到 ${state.segments.length} 条字幕。请校对专有名词、价格和地址，再导入时间线。`, 1);
      }
      whisper.dispose();
      state.transcriber = null;
    } catch (error) {
      console.error('Chinese subtitle transcription failed:', error);
      const message = error?.message || String(error);
      const network = /fetch|network|load failed|failed to fetch|http/i.test(message);
      const memory = /memory|allocation|out of memory|wasm/i.test(message);
      setStatus(network
        ? '识别组件或模型下载失败。可能是当前网络无法访问 esm.sh / Hugging Face，请换稳定网络后重试。详细信息：' + message
        : memory
          ? '手机内存不足。请关闭其他应用，改用更短的音频和轻量模型。详细信息：' + message
          : '识别失败：' + message, 0);
      try { state.transcriber?.dispose(); } catch (_) {}
      state.transcriber = null;
    } finally {
      state.busy = false;
      $('xzs-start').disabled = false;
    }
  });

  $('xzs-download').addEventListener('click', () => {
    if (!state.segments.length) return;
    const blob = new Blob(['\uFEFF' + srtText()], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = '小智中文字幕.srt';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  });

  $('xzs-import').addEventListener('click', () => {
    if (!state.segments.length) return;
    const track = composition.tracks.find(item => item.type === 'text');
    if (!track) {
      setStatus('当前项目没有文字轨道，暂时无法导入字幕。');
      return;
    }
    const projectDuration = Math.max(0, Number(composition.duration) || 0);
    const offset = Number($('xzs-offset').value) || 0;
    const shiftedSegments = applySubtitleTimeOffset(state.segments, offset);
    const prepared = prepareSubtitleImportSegments(shiftedSegments, projectDuration);
    let imported = 0;
    for (const segment of prepared.segments) {
      const clip = composition.addClip({
        trackId: track.id,
        type: 'text',
        name: segment.text.slice(0, 18),
        text: segment.text,
        startTime: segment.startTime,
        duration: segment.duration,
        ...getSubtitlePositionLayout(composition.width, composition.height, $('xzs-position').value),
        fontSize: Math.max(30, Math.round(composition.width * 0.034)),
        fontFamily: 'Noto Sans CJK SC',
        fontWeight: 'bold',
        maxLines: 2,
        color: $('xzs-style').value === 'yellow' ? '#ffe66d' : '#ffffff',
        bgColor: $('xzs-style').value === 'clean' ? 'transparent' : '#202020',
        textAlign: 'center'
      });
      // Preserve recognized timestamps even when clips overlap on the text track.
      clip.startTime = segment.startTime;
      imported += 1;
    }
    onCompositionChanged();
    const notes = [];
    if (offset !== 0) notes.push('全部字幕已' + (offset > 0 ? '延后 ' : '提前 ') + Math.abs(offset).toFixed(1) + ' 秒');
    if (prepared.clippedToTimeline) notes.push(prepared.clippedToTimeline + ' 条字幕已按视频时长截取');
    if (prepared.cappedLong) notes.push(prepared.cappedLong + ' 条字幕超过 12 秒，已缩短');
    if (prepared.skippedEmpty + prepared.skippedInvalid + prepared.skippedOutOfRange) {
      notes.push('跳过 ' + (prepared.skippedEmpty + prepared.skippedInvalid + prepared.skippedOutOfRange) + ' 条空白、无效或超出视频时长的字幕');
    }
    if (prepared.overlaps) notes.push('检测到 ' + prepared.overlaps + ' 处字幕时间重叠，请在时间轴核对');
    const summary = imported
      ? '已导入 ' + imported + ' 条字幕。' + (notes.length ? '\n' + notes.join('；') + '。' : '时间范围检查通过。') + '\n请检查字幕位置和配音节奏。'
      : '没有可导入的有效字幕。请检查字幕时间是否落在当前视频时长内。';
    setStatus(summary, imported ? 1 : 0);
    });
}
