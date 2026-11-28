/**
 * Reference-video study mode.
 * Uses a user-provided reference clip to create a visual shot guide.
 * It does not copy/reuse the reference video's frames, audio, watermark or music
 * in the final merchant composition.
 */
export function initReferenceVideoStudio(workflowModal) {
  const anchor = workflowModal.querySelector('.xzw-section');
  if (!anchor) return;

  const section = document.createElement('div');
  section.className = 'xzw-section';
  section.id = 'xzw-reference-studio';
  section.innerHTML = `
    <h3>参考视频 · 爆款仿拍研究室</h3>
    <p class="xzw-note">上传你有权保存和分析的参考视频。这里会提取少量画面作为分镜观察样本，帮助你用客户自己的素材重新拍摄和剪辑；不会把参考视频画面、声音或水印直接放进成片。</p>
    <label class="xzw-field"><span>选择参考视频（仅用于分析）</span><input id="xzw-reference-file" type="file" accept="video/*,.mp4,.mov,.webm"></label>
    <div id="xzw-reference-meta" class="xzw-note">尚未选择参考视频</div>
    <video id="xzw-reference-player" controls playsinline preload="metadata" style="display:none;width:100%;max-height:240px;background:#000;border-radius:10px"></video>
    <div class="xzw-actions"><button class="xzw-secondary" id="xzw-reference-analyze" type="button" disabled>提取关键画面样本</button><button class="xzw-secondary" id="xzw-reference-clear" type="button">清除参考视频</button></div>
    <div id="xzw-reference-frames" class="xzw-grid"></div>
    <label class="xzw-field"><span>观察到的镜头结构（可修改）</span><textarea id="xzw-reference-notes" placeholder="例如：0-3秒门头远景；3-7秒招牌菜特写；7-12秒顾客用餐；12-18秒环境展示；18-25秒优惠和地址。请根据实际视频填写。"></textarea></label>
    <div class="xzw-actions"><button class="xzw-secondary" id="xzw-reference-template" type="button">生成仿拍分镜建议</button><button class="xzw-secondary" id="xzw-reference-copy" type="button">复制分镜建议</button></div>
    <div id="xzw-reference-plan" class="xzw-status" aria-live="polite">选择参考视频后，可以提取关键画面并记录镜头节奏。</div>
  `;
  anchor.parentNode.insertBefore(section, anchor.nextSibling);

  const $ = id => section.querySelector('#' + id);
  const fileInput = $('xzw-reference-file');
  const player = $('xzw-reference-player');
  const meta = $('xzw-reference-meta');
  const frames = $('xzw-reference-frames');
  const plan = $('xzw-reference-plan');
  let objectUrl = null;
  let duration = 0;
  let frameUrls = [];

  function clearFrames() {
    frameUrls.forEach(url => URL.revokeObjectURL(url));
    frameUrls = [];
    frames.replaceChildren();
  }
  function clearReference() {
    clearFrames();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = null;
    duration = 0;
    player.pause();
    player.removeAttribute('src');
    player.load();
    player.style.display = 'none';
    fileInput.value = '';
    $('xzw-reference-analyze').disabled = true;
    meta.textContent = '尚未选择参考视频';
    $('xzw-reference-notes').value = '';
    plan.textContent = '选择参考视频后，可以提取关键画面并记录镜头节奏。';
  }

  fileInput.addEventListener('change', () => {
    clearFrames();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    const file = fileInput.files?.[0];
    if (!file) return;
    // Android pickers sometimes report an empty or generic MIME type.
    if (!isSupportedReferenceVideoFile(file)) {
      meta.textContent = '文件格式不正确，请选择 MP4、MOV 或 WebM 视频文件。';
      fileInput.value = '';
      return;
    }
    if (file.size > 120 * 1024 * 1024) {
      meta.textContent = '参考视频超过120MB。手机分析建议使用较短、较小的参考片段。';
      fileInput.value = '';
      return;
    }
    objectUrl = URL.createObjectURL(file);
    player.src = objectUrl;
    player.style.display = 'block';
    meta.textContent = '正在读取视频信息……';
    player.onloadedmetadata = () => {
      duration = Number.isFinite(player.duration) ? player.duration : 0;
      const mins = Math.floor(duration / 60);
      const secs = Math.round(duration % 60);
      meta.textContent = '已载入：' + file.name + ' · ' + (mins ? mins + '分' : '') + secs + '秒 · ' + (player.videoWidth || '?') + '×' + (player.videoHeight || '?');
      $('xzw-reference-analyze').disabled = !(duration > 0 && player.videoWidth > 0);
    };
    player.onerror = () => { meta.textContent = '视频无法读取。请尝试 MP4（H.264）格式。'; };
  });

  async function seekTo(time) {
    if (Math.abs(player.currentTime - time) < 0.05) return;
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { cleanup(); reject(new Error('读取画面超时')); }, 5000);
      const cleanup = () => {
        clearTimeout(timer);
        player.removeEventListener('seeked', done);
        player.removeEventListener('error', fail);
      };
      const done = () => { cleanup(); resolve(); };
      const fail = () => { cleanup(); reject(new Error('视频解码失败')); };
      player.addEventListener('seeked', done, { once: true });
      player.addEventListener('error', fail, { once: true });
      player.currentTime = Math.min(Math.max(0, time), Math.max(0, duration - 0.08));
    });
  }

  $('xzw-reference-analyze').addEventListener('click', async () => {
    const button = $('xzw-reference-analyze');
    button.disabled = true;
    clearFrames();
    plan.textContent = '正在提取参考画面的样本……';
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const width = 320;
      const height = Math.max(1, Math.round(width * (player.videoHeight / player.videoWidth)));
      canvas.width = width;
      canvas.height = Math.min(560, height);
      const points = [0.08, 0.30, 0.52, 0.74, 0.92].map(p => Math.max(0, (duration - 0.1) * p));
      for (let i = 0; i < points.length; i++) {
        await seekTo(points[i]);
        ctx.drawImage(player, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.72));
        if (!blob) continue;
        const url = URL.createObjectURL(blob);
        frameUrls.push(url);
        const card = document.createElement('div');
        card.style.cssText = 'border:1px solid #41415e;border-radius:10px;padding:6px;min-width:0';
        const img = document.createElement('img');
        img.src = url;
        img.alt = '参考视频约' + points[i].toFixed(1) + '秒画面';
        img.style.cssText = 'width:100%;display:block;border-radius:7px;aspect-ratio:9/16;object-fit:contain;background:#080812';
        const label = document.createElement('div');
        label.className = 'xzw-note';
        label.textContent = points[i].toFixed(1) + '秒';
        card.append(img, label);
        frames.append(card);
      }
      plan.textContent = '已提取 ' + frameUrls.length + ' 张样本画面。请观察每个时间点的景别、主体、运镜和字幕，再填写下面的镜头结构。画面样本只用于当前页面分析。';
      player.pause();
    } catch (error) {
      plan.textContent = '提取失败：' + (error?.message || '未知错误') + '。可以播放参考视频，手动记录镜头节奏。';
    } finally {
      button.disabled = false;
    }
  });

  $('xzw-reference-template').addEventListener('click', () => {
    const notes = $('xzw-reference-notes').value.trim();
    if (!notes) {
      plan.textContent = '请先写下你观察到的镜头顺序或时间点，再生成仿拍建议。';
      return;
    }
    const lines = notes.split(/[\n；;]+/).map(s => s.trim()).filter(Boolean);
    const suggestions = lines.map((line, index) =>
      '镜头' + (index + 1) + '：' + line + '\n客户素材替换建议：使用客户自己的门头、环境、产品、服务或人物素材，保留该镜头的景别与节奏，不复制原视频画面。'
    );
    plan.textContent = '仿拍分镜建议（根据你填写的观察笔记整理，非自动AI识别）：\n\n' + suggestions.join('\n\n');
  });
  $('xzw-reference-copy').addEventListener('click', async () => {
    const text = plan.textContent || '';
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
      plan.textContent += '\n\n已复制到剪贴板。';
    } catch (_) {
      plan.textContent += '\n\n当前浏览器不允许自动复制，请长按文字手动复制。';
    }
  });
  $('xzw-reference-clear').addEventListener('click', clearReference);
  workflowModal.querySelector('.xzw-close')?.addEventListener('click', () => {
    clearReference();
    workflowModal.classList.remove('open');
  });
}
