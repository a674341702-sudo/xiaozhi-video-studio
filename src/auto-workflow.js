/**
 * 小智·商家短视频生产线
 * 手机优先的本地工作流：商家资料 → 素材 → 文案/镜头 → 配乐/配音 → 时间线 → MP4。
 * 当前不冒充云端 AI：脚本由本地模板辅助；配乐与配音通过用户上传的合法音频文件混入成片。
 */
export function initAutoWorkflow({ composition, mediaManager, canvasPreview, onCompositionChanged, onExport }) {
  if (document.getElementById('xiaozhi-workflow-launcher')) return;

  const style = document.createElement('style');
  style.textContent = `
    #xiaozhi-workflow-launcher{position:fixed;right:16px;bottom:18px;z-index:1800;border:0;border-radius:999px;padding:14px 18px;background:linear-gradient(120deg,#7c3aed,#0891b2);color:#fff;font-weight:800;box-shadow:0 8px 28px #0007;cursor:pointer}
    #xiaozhi-workflow{position:fixed;inset:0;z-index:1900;background:#080812f5;display:none;align-items:center;justify-content:center;padding:10px;color:#f5f5ff;font:14px/1.5 system-ui,sans-serif}
    #xiaozhi-workflow.open{display:flex}
    .xzw-card{box-sizing:border-box;width:min(760px,100%);height:min(94dvh,900px);overflow:auto;background:#151526;border:1px solid #383852;border-radius:20px;padding:18px;box-shadow:0 20px 70px #000b}
    .xzw-head{position:sticky;top:-18px;z-index:2;display:flex;justify-content:space-between;align-items:center;gap:12px;background:#151526;padding:8px 0 12px}.xzw-head h2{font-size:20px;margin:0}
    .xzw-close,.xzw-secondary{background:#303047;color:#fff;border:0;border-radius:10px;padding:10px 13px}
    .xzw-intro{color:#b9b9d0;margin:0 0 14px}
    .xzw-steps{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:12px 0 18px}
    .xzw-step{padding:8px 4px;border-radius:9px;background:#222238;color:#aaa;text-align:center;font-size:12px}
    .xzw-step b{display:block;color:#c4b5fd;font-size:14px}
    .xzw-section{border:1px solid #33334b;background:#1c1c30;border-radius:14px;padding:13px;margin:12px 0}
    .xzw-section h3{font-size:15px;margin:0 0 10px}
    .xzw-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .xzw-field{display:block;margin:9px 0}.xzw-field span{display:block;color:#c5c5dc;margin-bottom:6px;font-size:13px}
    .xzw-field textarea,.xzw-field select,.xzw-field input{box-sizing:border-box;width:100%;border:1px solid #454563;background:#10101d;color:#fff;border-radius:10px;padding:11px;font:inherit;min-height:42px}
    .xzw-field textarea{min-height:86px;resize:vertical}
    .xzw-file{border:1px dashed #66668a;border-radius:12px;padding:12px;background:#111121}
    .xzw-check{display:flex;align-items:center;gap:9px;margin:10px 0;color:#d0d0e4}
    .xzw-check input{width:18px;min-height:18px;accent-color:#8b5cf6}
    .xzw-note{color:#a5a5bf;font-size:12px;margin:7px 0 0}
    .xzw-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:14px}
    .xzw-primary{border:0;border-radius:11px;padding:13px 17px;font-weight:800;background:linear-gradient(120deg,#7c3aed,#0891b2);color:#fff;cursor:pointer;flex:1;min-height:46px}
    .xzw-primary:disabled{opacity:.55}
    .xzw-status{margin-top:13px;padding:12px;border-radius:10px;background:#10101d;color:#c4b5fd;white-space:pre-wrap}
    .xzw-shot{padding:9px 4px;border-bottom:1px solid #34344a;color:#ddd;font-size:13px}
    .xzw-badge{display:inline-block;padding:3px 7px;border-radius:6px;background:#30264d;color:#c4b5fd;font-size:11px}
    @media(max-width:560px){#xiaozhi-workflow{padding:0;align-items:stretch}.xzw-card{height:100dvh;max-height:100dvh;border-radius:0;padding:14px}.xzw-head{top:-14px}.xzw-head h2{font-size:18px}.xzw-grid{grid-template-columns:1fr}.xzw-steps{grid-template-columns:repeat(4,1fr)}}
  `;
  document.head.appendChild(style);

  const launcher = document.createElement('button');
  launcher.id = 'xiaozhi-workflow-launcher';
  launcher.textContent = '✦ 商家短视频生产线';
  document.body.appendChild(launcher);

  const modal = document.createElement('div');
  modal.id = 'xiaozhi-workflow';
  modal.innerHTML = `
    <section class="xzw-card" role="dialog" aria-modal="true" aria-label="商家短视频生产线">
      <div class="xzw-head"><h2>✦ 小智·商家短视频生产线</h2><button class="xzw-close" type="button">关闭</button></div>
      <p class="xzw-intro">把商家素材和介绍放进来，自动整理成镜头、字幕和时间线。目标：一条约30秒的竖屏宣传视频。</p>
      <div class="xzw-steps"><div class="xzw-step"><b>01</b>商家资料</div><div class="xzw-step"><b>02</b>素材上传</div><div class="xzw-step"><b>03</b>文案镜头</div><div class="xzw-step"><b>04</b>配音导出</div></div>

      <div class="xzw-section">
        <h3>01 · 商家资料</h3>
        <div class="xzw-grid">
          <label class="xzw-field"><span>门店 / 品牌名称</span><input id="xzw-shop" placeholder="例如：XX咖啡"></label>
          <label class="xzw-field"><span>行业类型</span><select id="xzw-industry"><option value="餐饮探店">餐饮探店</option><option value="商品宣传">商品 / 产品</option><option value="服装穿搭">服装穿搭</option><option value="美容美发">美容美发</option><option value="酒店民宿">酒店 / 民宿</option><option value="休闲娱乐">休闲娱乐</option><option value="其他门店">其他门店</option></select></label>
        </div>
        <label class="xzw-field"><span>主打产品 / 服务</span><input id="xzw-product" placeholder="例如：手冲咖啡、招牌牛肉面"></label>
        <label class="xzw-field"><span>门店地址 / 到店方式</span><input id="xzw-address" placeholder="例如：昆明市五华区……"></label>
        <label class="xzw-field"><span>优惠活动（没有可不填）</span><input id="xzw-offer" placeholder="例如：新客到店立减、双人套餐"></label>
        <label class="xzw-field"><span>宣传重点 / 商家原始文案</span><textarea id="xzw-copy" placeholder="把商家介绍、产品卖点、价格、特色、活动等直接粘贴进来。也可以只写几句关键词。"></textarea></label>
        <div class="xzw-grid">
          <label class="xzw-field"><span>视频风格</span><select id="xzw-style"><option value="高级质感">高级质感</option><option value="真实探店">真实探店</option><option value="活泼种草">活泼种草</option><option value="促销转化">促销转化</option></select></label>
          <label class="xzw-field"><span>目标时长</span><select id="xzw-length"><option value="30">约30秒</option><option value="20">约20秒</option><option value="45">约45秒</option></select></label>
        </div>
        <button class="xzw-secondary" id="xzw-save-profile" type="button">保存商家资料到本机</button>
        <p class="xzw-note">只保存文字资料在当前浏览器，不会上传云端。请勿填写顾客隐私信息。</p>
      </div>

      <div class="xzw-section">
        <h3>02 · 上传拍摄素材</h3>
        <label class="xzw-field"><span>门店照片 / 产品照片 / 视频（可多选）</span><div class="xzw-file"><input id="xzw-files" type="file" accept="image/*,video/mp4,video/webm,video/quicktime,.mov" multiple><p class="xzw-note">建议 4–8 个素材；手机首测每次不超过8个，单个视频尽量不超过40MB。优先使用清晰、稳定、光线好的原片。</p></div></label>
        <div id="xzw-file-summary" class="xzw-note">尚未选择素材</div>
      </div>

      <div class="xzw-section">
        <h3>03 · 生成宣传文案与镜头安排</h3>
        <label class="xzw-field"><span>配音稿（可修改；生成后可复制去制作AI配音）</span><textarea id="xzw-narration" placeholder="先点击“生成宣传文案”，再按商家实际情况修改旁白。"></textarea></label>
        <div class="xzw-actions"><button class="xzw-secondary" id="xzw-make-script" type="button">✦ 生成宣传文案</button><button class="xzw-secondary" id="xzw-copy-script" type="button">复制配音稿</button></div>
        <label class="xzw-field"><span>画面字幕（每行一句；可单独修改）</span><textarea id="xzw-captions" placeholder="点击生成宣传文案后会自动填入，可按镜头逐句修改。"></textarea></label>
        <div class="xzw-grid">
          <label class="xzw-field"><span>视频画幅</span><select id="xzw-ratio"><option value="9:16">9:16 竖屏（抖音）</option><option value="4:5">4:5（小红书）</option><option value="1:1">1:1 方形</option><option value="16:9">16:9 横屏</option></select></label>
          <label class="xzw-field"><span>字幕样式</span><select id="xzw-subtitle"><option value="bold">醒目粗体</option><option value="clean">简洁高级</option></select></label>
        </div>
      </div>

      <div class="xzw-section">
        <h3>04 · 配乐与配音</h3>
        <label class="xzw-field"><span>背景音乐（上传已获授权的音乐文件）</span><input id="xzw-music" type="file" accept="audio/*"></label>
        <label class="xzw-field"><span>配音文件（手机录音或中文AI配音文件）</span><input id="xzw-voice" type="file" accept="audio/*"></label>
        <p class="xzw-note"><a href="./tts-lab.html" target="_blank" rel="noopener">✦ 打开中文配音实验室（普通话）</a>：生成并试听后，下载 WAV，再回到这里上传。</p>
        <label class="xzw-check"><input id="xzw-original-audio" type="checkbox"><span>保留原视频现场声音（默认关闭，避免盖过配音）</span></label>
        <p class="xzw-note">配乐会自动降低音量，配音放在独立音轨并优先突出。手机首测时，配乐和配音分别不超过40MB、合计不超过60MB。默认关闭拍摄视频自带声音，避免环境噪声影响成片；需要保留现场声时可勾选。中文配音实验室目前独立运行，生成后下载 WAV 再上传；尚未完成与主工作台的一键直连。</p>
      </div>

      <label class="xzw-field"><span>手机导出方案</span><select id="xzw-export-preset"><option value="mobile">手机稳定优先 · 720p / 24fps / 中等画质</option><option value="clear">画面清晰优先 · 720p / 30fps / 高画质</option></select></label>
      <p class="xzw-note">手机稳定优先方案会减少视频帧数和编码负担，更适合先在手机上测试；不同手机的内存和浏览器仍会影响导出结果。</p>
      <div class="xzw-actions"><button class="xzw-primary" id="xzw-generate" type="button">✦ 自动编排商家视频</button><button class="xzw-secondary" id="xzw-export" type="button">导出 MP4</button></div>
      <div class="xzw-status" id="xzw-status">等待商家资料和素材。编排完成后可预览、修改字幕，再导出视频。</div>
      <div id="xzw-shots"></div>
      <p class="xzw-note">首版使用浏览器本地规则化脚本与剪辑，不会凭空生成不存在的店铺画面。视频导出依赖手机内存和浏览器性能；建议先用少量素材、720×1280测试。请确保素材和音乐有商用授权。</p>
    </section>`;
  document.body.appendChild(modal);

  const $ = (id) => modal.querySelector('#' + id);
  const setStatus = (message) => { $('xzw-status').textContent = message; };
  const profileKeys = ['shop','industry','product','address','offer','copy','style','length'];
  const readProfile = () => Object.fromEntries(profileKeys.map(key => [key, $('xzw-' + key).value]));
  const saveProfile = () => {
    try { localStorage.setItem('xiaozhi-merchant-profile-v1', JSON.stringify(readProfile())); setStatus('商家资料已保存在这台手机的当前浏览器中。'); }
    catch (e) { setStatus('浏览器暂时无法保存资料，请检查存储空间。'); }
  };
  try {
    const saved = JSON.parse(localStorage.getItem('xiaozhi-merchant-profile-v1') || 'null');
    if (saved) profileKeys.forEach(key => { if (saved[key] !== undefined) $('xzw-' + key).value = saved[key]; });
  } catch (e) {}
  $('xzw-save-profile').addEventListener('click', saveProfile);
  $('xzw-make-script').addEventListener('click', () => {
    const lines = makeScript(readProfile());
    $('xzw-narration').value = lines.join('。') + '。';
    $('xzw-captions').value = lines.join('\n');
    setStatus('宣传文案已生成。请核对店名、产品、优惠和地址是否准确，再复制配音稿或继续编排。');
  });
  $('xzw-copy-script').addEventListener('click', async () => {
    const script = $('xzw-narration').value.trim();
    if (!script) { setStatus('请先生成或填写配音稿。'); return; }
    try {
      await navigator.clipboard.writeText(script);
      setStatus('配音稿已复制，可以粘贴到中文AI配音工具。');
    } catch (e) {
      $('xzw-narration').focus();
      $('xzw-narration').select();
      setStatus('浏览器未允许自动复制，已选中配音稿，请长按文字选择复制。');
    }
  });
  launcher.addEventListener('click', () => modal.classList.add('open'));
  modal.querySelector('.xzw-close').addEventListener('click', () => modal.classList.remove('open'));
  modal.addEventListener('click', event => { if (event.target === modal) modal.classList.remove('open'); });
  $('xzw-files').addEventListener('change', () => {
    const files = Array.from($('xzw-files').files || []);
    const size = files.reduce((n, f) => n + f.size, 0);
    $('xzw-file-summary').textContent = files.length + ' 个素材 · ' + (size / 1024 / 1024).toFixed(1) + ' MB';
  });

  function makeScript(profile) {
    const shop = profile.shop.trim() || '这家宝藏门店';
    const product = profile.product.trim() || profile.industry;
    const offer = profile.offer.trim();
    const detail = profile.copy.trim();
    const address = profile.address.trim();
    const style = profile.style;
    const hook = profile.industry === '餐饮探店' ? '想找一家值得打卡的好店？先看看这家。'
      : profile.industry === '酒店民宿' ? '来这里住一晚，给自己一个放松的理由。'
      : profile.industry === '服装穿搭' ? '想找到适合自己的风格？来看看这家。'
      : profile.industry === '美容美发' ? '想让自己状态焕然一新？这家可以了解一下。'
      : '好东西不只看外表，更要看细节和体验。';
    const lines = [hook, shop + '，主打' + product + '。', detail ? detail.slice(0, 70) : '从产品细节到实际体验，每一处都值得你亲自感受。', offer || '喜欢的话，不妨到店了解更多。', address ? '地址：' + address : '记得收藏，方便下次到店。'];
    if (style === '促销转化' && offer) lines[0] = '这次到店福利别错过：' + offer + '。';
    if (style === '活泼种草') lines[0] = '挖到一家值得分享的好店！' + shop + '走起。';
    return lines.filter(Boolean);
  }

  $('xzw-generate').addEventListener('click', async () => {
    const files = Array.from($('xzw-files').files || []);
    const profile = readProfile();
    if (!files.length) { setStatus('请先上传至少一张照片或一段视频。'); return; }
    if (files.length > 8) { setStatus('首版手机模式每次最多8个素材，建议先挑最能展示门店的素材。'); return; }
    const totalBytes = files.reduce((n, f) => n + f.size, 0);
    if (totalBytes > 160 * 1024 * 1024 || files.some(f => f.size > 40 * 1024 * 1024)) {
      setStatus('素材总量请控制在160MB以内，单个文件不超过40MB，以免手机浏览器内存不足。'); return;
    }
    if (composition.clips.length && !window.confirm('开始新的视频编排会清空当前编辑器时间线。确定继续吗？')) return;

    const ratio = $('xzw-ratio').value;
    const dims = { '9:16':[720,1280], '4:5':[720,900], '1:1':[720,720], '16:9':[1280,720] }[ratio];
    const targetSeconds = Number(profile.length) || 30;
    const perShot = Math.max(2.5, targetSeconds / files.length);
    if (!$('xzw-narration').value.trim()) {
      const draft = makeScript(profile);
      $('xzw-narration').value = draft.join('。') + '。';
      if (!$('xzw-captions').value.trim()) $('xzw-captions').value = draft.join('\n');
    }
    const script = $('xzw-narration').value.trim().split(/[。！？!?；;\n]+/).map(s=>s.trim()).filter(Boolean);
    const customCaptions = $('xzw-captions').value.trim().split(/\n+/).map(s=>s.trim()).filter(Boolean);
    const captions = customCaptions.length ? customCaptions : script;
    const textTrack = composition.tracks.find(t => t.type === 'text');
    const musicFile = $('xzw-music').files?.[0];
    const voiceFile = $('xzw-voice').files?.[0];
    const audioFiles = [musicFile, voiceFile].filter(Boolean);
    const audioBytes = audioFiles.reduce((total, file) => total + file.size, 0);
    const maxAudioFileBytes = 40 * 1024 * 1024;
    if (audioFiles.some(file => !file.size || file.size > maxAudioFileBytes) || audioBytes > 60 * 1024 * 1024) {
      setStatus('配乐和配音文件请分别控制在40MB以内、合计不超过60MB。手机首测建议使用较短的MP3或WAV文件，避免导出时占用过多内存。');
      return;
    }

    $('xzw-generate').disabled = true;
    $('xzw-shots').innerHTML = '';
    setStatus('正在准备画布并导入素材，请不要关闭页面……');
    try {
      composition.clear();
      composition.setDimensions(dims[0], dims[1]);
      const exportWidth = document.getElementById('export-width');
      const exportHeight = document.getElementById('export-height');
      if (exportWidth) exportWidth.value = String(dims[0]);
      if (exportHeight) exportHeight.value = String(dims[1]);
      let cursor = 0;
      const shots = [];
      for (let i = 0; i < files.length && cursor < targetSeconds; i++) {
        const file = files[i];
        const clip = await mediaManager.importFile(file, { startTime: cursor });
        if (!clip) throw new Error('素材导入失败：' + file.name);
        const shotDuration = Math.min(perShot, targetSeconds - cursor, clip.type === 'video' ? Math.max(1, clip.duration) : perShot);
        clip.duration = shotDuration;
        clip.trimEnd = (clip.trimStart || 0) + shotDuration;
        // Fill the whole output frame while preserving the source aspect ratio via centered crop.
        // This avoids small, floating photos and black side bars in vertical merchant videos.
        clip.x = 0;
        clip.y = 0;
        clip.width = composition.width;
        clip.height = composition.height;
        clip.fit = 'cover';
        if (clip.type === 'video') {
          // Keep camera audio off by default so narration and licensed music remain clear.
          clip.volume = $('xzw-original-audio').checked ? 1 : 0;
        }
        if (clip.type === 'image') {
          clip.keyframes = { scale: [
            { time: clip.startTime, value: 1, easing: 'easeInOut' },
            { time: clip.startTime + shotDuration, value: 1.12, easing: 'easeInOut' }
          ]};
        }
        const caption = captions[i % captions.length] || profile.shop || '到店体验，发现更多精彩';
        if (textTrack) composition.addClip({
          trackId: textTrack.id, type: 'text', name: '字幕 ' + (i + 1),
          text: caption, startTime: cursor, duration: shotDuration,
          x: Math.round(composition.width * 0.07), y: Math.round(composition.height * 0.70),
          width: Math.round(composition.width * 0.86), height: Math.round(composition.height * 0.18),
          fontSize: Math.max(28, Math.round(composition.width * 0.045)),
          fontFamily: 'Arial', fontWeight: 'bold', color: '#ffffff',
          bgColor: $('xzw-subtitle').value === 'clean' ? 'rgba(0,0,0,0.24)' : 'rgba(0,0,0,0.58)',
          textAlign: 'center'
        });
        shots.push({name:file.name,caption,start:cursor,duration:shotDuration});
        cursor += shotDuration;
        onCompositionChanged();
      }
      if (musicFile) {
        const music = await mediaManager.importFile(musicFile, { startTime: 0, trackIndex: 4 });
        if (music) { music.volume = 0.22; music.duration = Math.min(cursor, music.duration); music.trimEnd = (music.trimStart || 0) + music.duration; }
      }
      if (voiceFile) {
        const voice = await mediaManager.importFile(voiceFile, { startTime: 0, trackIndex: 5 });
        if (voice) { voice.volume = 1; voice.duration = Math.min(cursor, voice.duration); voice.trimEnd = (voice.trimStart || 0) + voice.duration; }
      }
      onCompositionChanged();
      canvasPreview.setCurrentTime(0);
      saveProfile();
      setStatus('完成：已编排 ' + shots.length + ' 个镜头' + (musicFile ? '、背景音乐' : '') + (voiceFile ? '、配音' : '') + '。现在可以播放预览；如需修改，可在时间线上调整字幕和镜头。');
      $('xzw-shots').innerHTML = '<h3 style="font-size:14px;margin:14px 0 6px">镜头清单</h3>' +
        shots.map((s,i) => '<div class="xzw-shot"><span class="xzw-badge">镜头 '+(i+1)+'</span> '+escapeHtml(s.name)+' · '+s.duration.toFixed(1)+'秒<br><small>'+escapeHtml(s.caption)+'</small></div>').join('');
    } catch (error) {
      console.error('[小智商家短视频]', error);
      setStatus('编排中断：' + (error?.message || '未知错误') + '。已加入时间线的素材会保留，请检查后重试。');
    } finally {
      $('xzw-generate').disabled = false;
    }
  });

  $('xzw-export').addEventListener('click', () => {
    const preset = $('xzw-export-preset').value;
    const fps = document.getElementById('export-fps');
    const quality = document.getElementById('export-quality');
    if (fps) fps.value = preset === 'clear' ? '30' : '24';
    if (quality) quality.value = preset === 'clear' ? 'high' : 'medium';
    modal.classList.remove('open');
    onExport();
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
