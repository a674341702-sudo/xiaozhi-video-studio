/**
 * 小智一键视频工坊 - 本地自动成片工作流
 * 第一阶段使用浏览器本地处理，不冒充云端 AI 推理。
 */
export function initAutoWorkflow({ composition, mediaManager, canvasPreview, onCompositionChanged, onExport }) {
  if (document.getElementById('xiaozhi-workflow-launcher')) return;

  const style = document.createElement('style');
  style.textContent = `
    #xiaozhi-workflow-launcher{position:fixed;right:18px;top:76px;z-index:1800;border:0;border-radius:999px;padding:12px 17px;background:linear-gradient(120deg,#7c3aed,#0891b2);color:#fff;font-weight:700;box-shadow:0 8px 28px #0006;cursor:pointer}
    #xiaozhi-workflow{position:fixed;inset:0;z-index:1900;background:#080812ee;display:none;align-items:center;justify-content:center;padding:14px;color:#f5f5ff;font:14px/1.5 system-ui,sans-serif}
    #xiaozhi-workflow.open{display:flex}
    .xzw-card{width:min(720px,100%);max-height:92vh;overflow:auto;background:#171728;border:1px solid #383852;border-radius:18px;padding:20px;box-shadow:0 20px 70px #0009}
    .xzw-head{display:flex;justify-content:space-between;align-items:center;gap:12px}.xzw-head h2{font-size:21px;margin:0}
    .xzw-close{background:#292940;color:#fff;border:0;border-radius:9px;padding:8px 12px}
    .xzw-modes{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:18px 0}
    .xzw-mode{border:1px solid #454563;border-radius:12px;padding:13px;background:#202039;color:#eee;text-align:left;cursor:pointer}
    .xzw-mode.active{border-color:#a78bfa;background:#30264d}
    .xzw-mode strong{display:block;font-size:15px;margin-bottom:3px}
    .xzw-field{display:block;margin:13px 0}.xzw-field span{display:block;color:#c5c5dc;margin-bottom:7px}
    .xzw-field textarea,.xzw-field select,.xzw-field input{box-sizing:border-box;width:100%;border:1px solid #454563;background:#10101d;color:#fff;border-radius:10px;padding:11px;font:inherit}
    .xzw-field textarea{min-height:90px;resize:vertical}
    .xzw-file{border:1px dashed #66668a;border-radius:12px;padding:14px;background:#111121}
    .xzw-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}
    .xzw-primary,.xzw-secondary{border:0;border-radius:10px;padding:12px 17px;font-weight:700;cursor:pointer}
    .xzw-primary{background:#8b5cf6;color:white;flex:1}.xzw-secondary{background:#303047;color:#eee}
    .xzw-note{color:#aaaac2;font-size:12px;margin-top:12px}
    .xzw-status{margin-top:14px;padding:11px;border-radius:10px;background:#111121;color:#c4b5fd;white-space:pre-wrap}
    .xzw-shot{padding:8px 10px;border-bottom:1px solid #34344a;color:#ddd}
    @media(max-width:560px){#xiaozhi-workflow-launcher{right:10px;top:auto;bottom:18px}.xzw-card{padding:15px}.xzw-head h2{font-size:18px}}
  `;
  document.head.appendChild(style);

  const launcher = document.createElement('button');
  launcher.id = 'xiaozhi-workflow-launcher';
  launcher.textContent = '✦ 小智自动成片';
  document.body.appendChild(launcher);

  const modal = document.createElement('div');
  modal.id = 'xiaozhi-workflow';
  modal.innerHTML = `
    <section class="xzw-card" role="dialog" aria-modal="true" aria-label="小智自动成片">
      <div class="xzw-head"><h2>✦ 小智一键视频工坊</h2><button class="xzw-close" type="button">关闭</button></div>
      <p style="color:#b9b9d0;margin:8px 0 0">选择用途，上传素材，写下想表达的内容，自动编排到时间线。</p>
      <div class="xzw-modes">
        <button class="xzw-mode active" data-mode="product"><strong>🛍 产品宣传</strong><small>商品介绍、门店探店、短视频带货</small></button>
        <button class="xzw-mode" data-mode="comic"><strong>🎬 AI 漫剧</strong><small>故事分镜、角色画面、对白字幕</small></button>
      </div>
      <label class="xzw-field"><span>上传图片 / 视频素材（可多选）</span><div class="xzw-file"><input id="xzw-files" type="file" accept="image/*,video/mp4,video/webm,video/quicktime,.mov" multiple><div class="xzw-note">建议先用 3–8 张图片或几段短视频。手机端请控制素材大小。</div></div></label>
      <label class="xzw-field"><span id="xzw-prompt-label">产品 / 门店介绍</span><textarea id="xzw-prompt" placeholder="例如：昆明一家环境舒适的咖啡店，主打手冲咖啡，突出环境、口味和到店体验。"></textarea></label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <label class="xzw-field"><span>视频画幅</span><select id="xzw-ratio"><option value="9:16">竖屏 9:16（抖音）</option><option value="16:9">横屏 16:9</option><option value="1:1">正方形 1:1</option><option value="4:5">小红书 4:5</option></select></label>
        <label class="xzw-field"><span>每个图片镜头时长</span><select id="xzw-duration"><option value="3">3 秒</option><option value="4" selected>4 秒</option><option value="5">5 秒</option><option value="6">6 秒</option></select></label>
      </div>
      <label class="xzw-field"><span>背景音乐（可选，上传音频）</span><input id="xzw-audio" type="file" accept="audio/*"></label>
      <div class="xzw-actions"><button class="xzw-primary" id="xzw-generate" type="button">✦ 自动策划并加入时间线</button><button class="xzw-secondary" id="xzw-export" type="button">导出视频</button></div>
      <div class="xzw-status" id="xzw-status">等待上传素材。完成编排后，可回到编辑器预览并导出 MP4。</div>
      <div id="xzw-shots"></div>
      <p class="xzw-note">说明：当前版本在浏览器本地完成规则化分镜、素材编排、动态缩放与字幕；尚未连接云端生成式 AI，不会自动生成全新人物或视频片段。导出使用原有 FFmpeg 引擎，手机性能和素材大小会影响速度。</p>
    </section>`;
  document.body.appendChild(modal);

  let mode = 'product';
  const $ = (id) => modal.querySelector('#' + id);
  const setStatus = (message) => { $('xzw-status').textContent = message; };
  launcher.addEventListener('click', () => modal.classList.add('open'));
  modal.querySelector('.xzw-close').addEventListener('click', () => modal.classList.remove('open'));
  modal.addEventListener('click', (event) => { if (event.target === modal) modal.classList.remove('open'); });
  modal.querySelectorAll('.xzw-mode').forEach((button) => button.addEventListener('click', () => {
    mode = button.dataset.mode;
    modal.querySelectorAll('.xzw-mode').forEach((b) => b.classList.toggle('active', b === button));
    $('xzw-prompt-label').textContent = mode === 'product' ? '产品 / 门店介绍' : '漫剧故事梗概 / 角色对白';
    $('xzw-prompt').placeholder = mode === 'product'
      ? '例如：介绍商品特点、使用场景和购买理由。'
      : '例如：一个年轻人误入古代昆仑秘境，遇见守山少女，发现自己的身世秘密。';
  }));

  $('xzw-generate').addEventListener('click', async () => {
    const files = Array.from($('xzw-files').files || []);
    const prompt = $('xzw-prompt').value.trim();
    const duration = Number($('xzw-duration').value) || 4;
    if (!files.length) { setStatus('请先上传至少一张图片或一段视频素材。'); return; }
    if (files.length > 12) { setStatus('为照顾手机性能，第一版每次最多处理 12 个素材。'); return; }

    const ratio = $('xzw-ratio').value;
    const dimensions = { '9:16':[1080,1920], '16:9':[1920,1080], '1:1':[1080,1080], '4:5':[1080,1350] }[ratio];
    composition.setDimensions(dimensions[0], dimensions[1]);
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    const videoFiles = files.filter(f => f.type.startsWith('video/'));
    const textTrack = composition.tracks.find(t => t.type === 'text');
    const sentences = prompt
      ? prompt.split(/[。！？!?；;\n]+/).map(s => s.trim()).filter(Boolean)
      : [];
    const productCaptions = ['看见细节，发现不一样的品质','从真实体验出发，感受每一处用心','把喜欢的理由，分享给更多人','现在就来了解更多'];
    const comicCaptions = ['故事，就从这一刻开始','命运的相遇，正在悄然发生','新的线索，指向未知的远方','下一幕，即将揭晓'];
    const captions = sentences.length ? sentences : (mode === 'product' ? productCaptions : comicCaptions);
    const shots = [];
    $('xzw-generate').disabled = true;
    setStatus('正在导入素材并安排镜头……请保持页面打开。');
    $('xzw-shots').innerHTML = '';
    try {
      let cursor = 0;
      const ordered = [...files];
      for (let i = 0; i < ordered.length; i++) {
        const file = ordered[i];
        const clip = await mediaManager.importFile(file, { startTime: cursor });
        if (!clip) throw new Error('素材导入失败：' + file.name);
        if (clip.type === 'image') {
          clip.duration = duration;
          clip.trimEnd = duration;
          clip.keyframes = {
            scale: [
              { time: clip.startTime, value: 1, easing: 'easeInOut' },
              { time: clip.startTime + duration, value: 1.1, easing: 'easeInOut' }
            ]
          };
        }
        const shotDuration = clip.duration || duration;
        const caption = captions[i % captions.length];
        if (textTrack) {
          composition.addClip({
            trackId: textTrack.id, type: 'text', name: '字幕 ' + (i + 1),
            text: caption, startTime: clip.startTime, duration: shotDuration,
            x: Math.round(composition.width * 0.08),
            y: Math.round(composition.height * 0.72),
            width: Math.round(composition.width * 0.84), height: Math.round(composition.height * 0.16),
            fontSize: Math.max(34, Math.round(composition.width * 0.038)),
            fontFamily: 'Arial', fontWeight: 'bold', color: '#ffffff',
            bgColor: 'rgba(0,0,0,0.48)', textAlign: 'center'
          });
        }
        shots.push({ name: file.name, caption, start: clip.startTime, duration: shotDuration });
        cursor = clip.startTime + shotDuration + 0.08;
        onCompositionChanged();
      }

      const audioFile = $('xzw-audio').files?.[0];
      if (audioFile) await mediaManager.importFile(audioFile, { startTime: 0 });
      onCompositionChanged();
      canvasPreview.setCurrentTime(0);
      setStatus('已完成 ' + shots.length + ' 个镜头的本地自动编排。请点击预览播放；确认无误后可导出视频。');
      $('xzw-shots').innerHTML = '<h3 style="font-size:14px;margin:14px 0 6px">本次镜头安排</h3>' +
        shots.map((s,i) => '<div class="xzw-shot">' + (i+1) + '. ' + escapeHtml(s.name) + ' · ' + s.duration.toFixed(1) + ' 秒<br><small>' + escapeHtml(s.caption) + '</small></div>').join('');
    } catch (error) {
      console.error('[小智自动成片]', error);
      setStatus('编排中断：' + (error?.message || '未知错误') + '。已加入时间线的素材会保留，可检查后重试。');
    } finally {
      $('xzw-generate').disabled = false;
    }
  });

  $('xzw-export').addEventListener('click', () => {
    modal.classList.remove('open');
    onExport();
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[ch]));
}
