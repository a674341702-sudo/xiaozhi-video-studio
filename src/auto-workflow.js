/**
 * 小智·商家短视频生产线
 * 手机优先的本地工作流：商家资料 → 素材 → 文案/镜头 → 配乐/配音 → 时间线 → MP4。
 * 当前不冒充云端 AI：脚本由本地模板辅助；配乐与配音通过用户上传的合法音频文件混入成片。
 */
import { initReferenceVideoStudio } from './reference-video-studio.js';
import { extractMerchantDocumentText } from './merchant-document.js';
import { splitMerchantRequirements, isRestrictionRequirement } from './merchant-workflow-rules.js';

export function initAutoWorkflow({ composition, mediaManager, canvasPreview, onCompositionChanged, releaseMediaUrls, onExport }) {
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
    .xzw-shot{padding:9px 4px;border-bottom:1px solid #34344a;color:#ddd;font-size:13px}\n    .xzw-template-guide{margin-top:10px;padding:11px;border:1px solid #41415e;border-radius:11px;background:#141426}.xzw-template-guide>strong{color:#ddd;font-size:13px}.xzw-template-guide small{color:#a5a5bf}
    .xzw-media-map{display:grid;gap:10px;margin-top:10px}.xzw-media-row{display:grid;grid-template-columns:92px minmax(0,1fr);gap:10px;align-items:center;padding:10px;border:1px solid #41415e;border-radius:12px;background:#121222;min-width:0}.xzw-media-thumb{width:92px;height:76px;object-fit:cover;border-radius:8px;background:#080812;display:block}.xzw-media-info{min-width:0;display:grid;gap:7px}.xzw-media-name{font-size:12px;overflow-wrap:anywhere;color:#e5e5f5}.xzw-media-row select{width:100%;min-width:0;background:#0c0c18;color:#fff;border:1px solid #454563;border-radius:8px;padding:9px;min-height:40px}.xzw-media-order{display:flex;gap:7px}.xzw-media-order button{flex:1;min-height:38px;border:1px solid #4b4b68;border-radius:8px;background:#292941;color:#fff;font-size:13px}.xzw-media-order button:disabled{opacity:.35}.xzw-media-preview{position:fixed;inset:0;z-index:2600;background:rgba(0,0,0,.94);display:none;align-items:center;justify-content:center;padding:18px;box-sizing:border-box}.xzw-media-preview.open{display:flex}.xzw-media-preview img,.xzw-media-preview video{max-width:100%;max-height:82dvh;object-fit:contain;border-radius:12px}.xzw-media-preview-close{position:absolute;top:calc(12px + env(safe-area-inset-top));right:14px;min-width:48px;min-height:48px;border:0;border-radius:50%;background:#fff;color:#111;font-size:24px;font-weight:700}.xzw-media-preview-name{position:absolute;left:16px;right:70px;top:calc(20px + env(safe-area-inset-top));color:#fff;font-size:13px;overflow-wrap:anywhere}.xzw-preview{margin-top:12px;padding:12px;border:1px solid #5b4a86;border-radius:11px;background:#17152a}.xzw-preview h4{margin:0 0 8px;font-size:14px}.xzw-preview ul{padding-left:20px;margin:7px 0}.xzw-preview li{margin:5px 0;font-size:12px;color:#d5d5e8}.xzw-preview .xzw-check{font-size:13px}
    .xzw-requirements{display:grid;gap:9px;margin-top:10px}.xzw-requirement{border:1px solid #41415e;border-radius:10px;padding:10px;background:#121222}.xzw-requirement textarea{width:100%;box-sizing:border-box;min-height:54px;background:#0c0c18;color:#fff;border:1px solid #454563;border-radius:8px;padding:9px;font:inherit}.xzw-requirement select{width:100%;margin-top:7px;background:#0c0c18;color:#fff;border:1px solid #454563;border-radius:8px;padding:8px;font:inherit}.xzw-requirement label{font-size:12px;color:#c4b5fd}
    .xzw-badge{display:inline-block;padding:3px 7px;border-radius:6px;background:#30264d;color:#c4b5fd;font-size:11px}
    @media(max-width:560px){#xiaozhi-workflow{padding:0;align-items:stretch}.xzw-card{height:100dvh;max-height:100dvh;border-radius:0;padding:16px 14px calc(24px + env(safe-area-inset-bottom))}.xzw-head{top:-16px;padding-top:calc(8px + env(safe-area-inset-top))}.xzw-head h2{font-size:18px}.xzw-close,.xzw-secondary,.xzw-primary{min-height:46px;font-size:15px}.xzw-grid{grid-template-columns:1fr}.xzw-steps{grid-template-columns:repeat(4,1fr);gap:5px}.xzw-step{font-size:11px;padding:9px 2px}.xzw-field span{font-size:14px}.xzw-field textarea,.xzw-field select,.xzw-field input{font-size:16px;min-height:46px}.xzw-note{font-size:13px;line-height:1.6}.xzw-section{padding:13px 11px}.xzw-media-row{grid-template-columns:88px minmax(0,1fr);gap:9px;padding:9px}.xzw-media-thumb{width:88px;height:74px}.xzw-media-order button{min-height:42px}}
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
      <p class="xzw-intro">把商家素材和介绍放进来，自动整理成镜头、字幕和时间线；照片会自动加入缓慢推拉与平移运镜。目标：一条约30秒的竖屏宣传视频。</p>
      <div class="xzw-steps"><div class="xzw-step"><b>01</b>商家资料</div><div class="xzw-step"><b>02</b>素材上传</div><div class="xzw-step"><b>03</b>文案镜头</div><div class="xzw-step"><b>04</b>配音导出</div></div>

      <div class="xzw-section">
        <h3>01 · 商家资料</h3>
        <div class="xzw-grid">
          <label class="xzw-field"><span>门店 / 品牌名称</span><input id="xzw-shop" placeholder="例如：XX咖啡"></label>
          <label class="xzw-field"><span>行业类型</span><select id="xzw-industry"><option value="餐饮探店">餐饮探店</option><option value="商品宣传">商品 / 产品</option><option value="服装穿搭">服装穿搭</option><option value="美容美发">美容美发</option><option value="酒店民宿">酒店 / 民宿</option><option value="休闲娱乐">休闲娱乐</option><option value="其他门店">其他门店</option></select></label>
        </div>
        <div class="xzw-template-guide" id="xzw-template-guide" aria-live="polite"></div>
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
        <div id="xzw-media-map" class="xzw-media-map"></div>
        <p class="xzw-note">系统会按文件名和素材类型推荐镜头用途，你可以手动调整；没有明显匹配依据时会标记为待确认。</p>
        <div class="xzw-field">
          <span>商家文字要求（可选）</span>
          <div class="xzw-file">
            <label for="xzw-brief-file"><strong>第1步：点这里选择商家文档</strong></label>
            <input id="xzw-brief-file" type="file" accept=".docx,.txt,.md,.csv,.rtf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,text/csv,application/rtf">
            <p class="xzw-note">支持 Word（.docx）、TXT、Markdown、CSV、RTF，最大10MB。选择后会自动读取文字，填到下面的文本框。</p>
          </div>
        </div>
        <label class="xzw-field"><span>第2步：检查或直接粘贴商家要求</span><textarea id="xzw-brief" placeholder="例如：重点突出招牌菜；必须出现开业优惠；结尾显示门店地址；不要出现其他品牌。没有文档时，也可以直接把商家发来的文字粘贴在这里。"></textarea></label>
        <div id="xzw-brief-status" class="xzw-note">还没有添加文字。上传文档后会自动填入，也可以直接粘贴。</div>
        <div class="xzw-actions"><button class="xzw-secondary" id="xzw-extract-requirements" type="button">第3步：拆解成制作清单</button></div>
        <p class="xzw-note">自动识别“必须出现、重点突出、优惠、地址、不要出现”等要求；你可以逐条修改并指定放在哪个镜头。识别结果需要人工核对。</p>
        <div id="xzw-requirements" class="xzw-requirements"></div>
      </div>

      <div class="xzw-section">
        <h3>03 · 生成宣传文案与镜头安排</h3>
        <label class="xzw-field"><span>配音稿（可修改；生成后可复制去制作AI配音）</span><textarea id="xzw-narration" placeholder="先点击“生成宣传文案”，再按商家实际情况修改旁白。"></textarea></label>
        <div class="xzw-actions"><button class="xzw-secondary" id="xzw-make-script" type="button">✦ 生成宣传文案</button><button class="xzw-secondary" id="xzw-copy-script" type="button">复制配音稿</button></div>
        <div class="xzw-actions"><button class="xzw-secondary" id="xzw-send-tts" type="button">🎙️ 把配音稿送到中文配音实验室</button></div>
        <p class="xzw-note">点击后会在新页面自动带入上面的配音稿；生成并下载 WAV 后，回到这里的“配音文件”处上传即可。</p>
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
        <p class="xzw-note"><a href="./tts-lab.html" target="_blank" rel="noopener">✦ 打开中文配音实验室（普通话）</a>：生成后会尝试自动传回当前工作台；若未成功，再下载 WAV 手动上传。</p>
        <label class="xzw-check"><input id="xzw-original-audio" type="checkbox"><span>保留原视频现场声音（默认关闭，避免盖过配音）</span></label>
        <p class="xzw-note">配乐会自动降低音量，配音放在独立音轨并优先突出。手机首测时，配乐和配音分别不超过40MB、合计不超过60MB。默认关闭拍摄视频自带声音，避免环境噪声影响成片；需要保留现场声时可勾选。中文配音实验室支持同源自动回传；如果主工作台未打开、浏览器不支持或导入失败，可下载 WAV 后手动上传。</p>
      </div>

      <label class="xzw-field"><span>手机导出方案</span><select id="xzw-export-preset"><option value="mobile">手机稳定优先 · 720p / 24fps / 中等画质</option><option value="clear">画面清晰优先 · 720p / 30fps / 高画质</option></select></label>
      <p class="xzw-note">手机稳定优先方案会减少视频帧数和编码负担，更适合先在手机上测试；不同手机的内存和浏览器仍会影响导出结果。</p>
      <div class="xzw-actions"><button class="xzw-secondary" id="xzw-build-preview" type="button">先生成制作预览 / 检查遗漏</button></div>
      <div id="xzw-production-preview"></div>
      <div class="xzw-actions"><button class="xzw-primary" id="xzw-generate" type="button">✦ 确认后自动编排</button><button class="xzw-secondary" id="xzw-export" type="button">导出 MP4</button></div>
      <div class="xzw-status" id="xzw-status">等待商家资料和素材。编排完成后可预览、修改字幕，再导出视频。</div>
      <div id="xzw-shots"></div>
      <p class="xzw-note">首版使用浏览器本地规则化脚本与剪辑，不会凭空生成不存在的店铺画面。视频导出依赖手机内存和浏览器性能；建议先用少量素材、720×1280测试。请确保素材和音乐有商用授权。</p>
    </section>`;
  document.body.appendChild(modal);
  const mediaPreview = document.createElement('div');
  mediaPreview.className = 'xzw-media-preview';
  mediaPreview.innerHTML = '<button type="button" class="xzw-media-preview-close" aria-label="关闭预览">×</button><div class="xzw-media-preview-name"></div><div class="xzw-media-preview-stage"></div>';
  document.body.appendChild(mediaPreview);
  const closeMediaPreview = () => {
    mediaPreview.classList.remove('open');
    const active = mediaPreview.querySelector('video');
    if (active) { active.pause(); active.removeAttribute('src'); active.load(); }
    mediaPreview.querySelector('.xzw-media-preview-stage').innerHTML = '';
  };
  const openMediaPreview = (file, url) => {
    const stage = mediaPreview.querySelector('.xzw-media-preview-stage');
    stage.innerHTML = '';
    mediaPreview.querySelector('.xzw-media-preview-name').textContent = file.name;
    let element;
    if (file.type.startsWith('video/')) {
      element = document.createElement('video');
      element.controls = true;
      element.playsInline = true;
      element.preload = 'metadata';
    } else {
      element = document.createElement('img');
      element.alt = file.name;
    }
    element.src = url;
    stage.appendChild(element);
    mediaPreview.classList.add('open');
  };
  mediaPreview.querySelector('.xzw-media-preview-close').addEventListener('click', closeMediaPreview);
  mediaPreview.addEventListener('click', event => { if (event.target === mediaPreview) closeMediaPreview(); });
  initReferenceVideoStudio(modal);

  const $ = (id) => modal.querySelector('#' + id);
  const setStatus = (message) => { $('xzw-status').textContent = message; };
  let productionPreviewReady = false;
  let orderedMediaFiles = [];
  const mediaRoleByFile = new Map();
  const mediaPreviewUrls = new Map();
  const clearMediaPreviewUrls = () => {
    mediaPreviewUrls.forEach(url => URL.revokeObjectURL(url));
    mediaPreviewUrls.clear();
  };
  const invalidateProductionPreview = () => {
    productionPreviewReady = false;
    $('xzw-production-preview').innerHTML = '';
  };
  const roleOptions = () => getMerchantShotPlan($('xzw-industry').value, Math.max(1, orderedMediaFiles.length || 6));
  const suggestShotForFile = (file, index, plans) => {
    const name = file.name.toLowerCase();
    const terms = [
      /门头|招牌|外观|入口|店面|logo/.test(name) ? /开场|门店亮相|外观位置|空间展示|氛围开场/ : null,
      /菜|餐|产品|商品|招牌|主打|特写/.test(name) ? /招牌展示|产品亮相|核心产品|核心细节|服务项目/ : null,
      /环境|大厅|房间|装修|内景|店内/.test(name) ? /环境|空间|房间全景|公共空间/ : null,
      /制作|过程|操作|服务|体验/.test(name) ? /制作过程|服务过程|操作细节|现场过程/ : null,
      /价格|菜单|优惠|活动|套餐/.test(name) ? /活动信息|消费信息|规格展示/ : null,
      /地址|定位|地图|交通|电话/.test(name) ? /到店引导|预约引导|购买引导|预订引导/ : null
    ].filter(Boolean);
    if (terms.length) {
      const match = plans.findIndex(plan => terms.some(pattern => pattern.test(plan.role)));
      if (match >= 0) return match;
    }
    if (file.type.startsWith('video/')) return Math.min(index, plans.length - 1);
    return Math.min(index, plans.length - 1);
  };
  const renderMediaMapping = () => {
    const files = orderedMediaFiles;
    const plans = roleOptions();
    const container = $('xzw-media-map');
    container.innerHTML = '';
    closeMediaPreview();
    clearMediaPreviewUrls();
    files.forEach((file, index) => {
      const row = document.createElement('div');
      row.className = 'xzw-media-row';
      const previewUrl = URL.createObjectURL(file);
      mediaPreviewUrls.set(file, previewUrl);
      let thumb;
      if (file.type.startsWith('image/')) {
        thumb = document.createElement('img');
        thumb.alt = file.name;
        thumb.src = previewUrl;
      } else {
        thumb = document.createElement('video');
        thumb.muted = true;
        thumb.playsInline = true;
        thumb.preload = 'metadata';
        thumb.src = previewUrl;
        thumb.setAttribute('aria-label', file.name + ' 视频预览');
      }
      thumb.className = 'xzw-media-thumb';
      thumb.setAttribute('role', 'button');
      thumb.setAttribute('tabindex', '0');
      thumb.setAttribute('aria-label', '放大预览：' + file.name);
      thumb.addEventListener('click', () => openMediaPreview(file, previewUrl));
      thumb.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openMediaPreview(file, previewUrl); } });
      const info = document.createElement('div');
      info.className = 'xzw-media-info';
      const name = document.createElement('span');
      name.className = 'xzw-media-name';
      name.textContent = (file.type.startsWith('video/') ? '🎬 ' : '🖼️ ') + file.name;
      const select = document.createElement('select');
      select.className = 'xzw-media-role';
      select.setAttribute('aria-label', file.name + ' 的镜头用途');
      plans.forEach((plan, planIndex) => {
        const option = document.createElement('option');
        option.value = String(planIndex);
        option.textContent = '镜头 ' + (planIndex + 1) + ' · ' + plan.role;
        select.appendChild(option);
      });
      select.value = String(mediaRoleByFile.has(file) ? mediaRoleByFile.get(file) : suggestShotForFile(file, index, plans));
      select.addEventListener('change', () => {
        mediaRoleByFile.set(file, Number(select.value));
        invalidateProductionPreview();
      });
      const order = document.createElement('div');
      order.className = 'xzw-media-order';
      const up = document.createElement('button');
      up.type = 'button'; up.textContent = '上移'; up.disabled = index === 0;
      up.addEventListener('click', () => moveMedia(index, -1));
      const down = document.createElement('button');
      down.type = 'button'; down.textContent = '下移'; down.disabled = index === files.length - 1;
      down.addEventListener('click', () => moveMedia(index, 1));
      const preview = document.createElement('button');
      preview.type = 'button'; preview.textContent = '放大预览';
      preview.addEventListener('click', () => openMediaPreview(file, previewUrl));
      order.append(preview, up, down);
      info.append(name, select, order);
      row.append(thumb, info);
      container.appendChild(row);
    });
    const requirementPlans = plans;
    $('xzw-requirements').querySelectorAll('.xzw-requirement-shot').forEach(select => {
      const previous = Number(select.value);
      select.innerHTML = '';
      requirementPlans.forEach((plan, index) => {
        const option = document.createElement('option');
        option.value = String(index);
        option.textContent = '安排到镜头 ' + (index + 1) + ' · ' + plan.role;
        select.appendChild(option);
      });
      select.value = String(Math.min(previous, requirementPlans.length - 1));
    });
    invalidateProductionPreview();
  };
  const moveMedia = (index, delta) => {
    const next = index + delta;
    if (next < 0 || next >= orderedMediaFiles.length) return;
    [orderedMediaFiles[index], orderedMediaFiles[next]] = [orderedMediaFiles[next], orderedMediaFiles[index]];
    renderMediaMapping();
    invalidateProductionPreview();
  };
  const getMediaAssignments = () => Array.from($('xzw-media-map').querySelectorAll('.xzw-media-role')).map((select, index) => ({
    fileIndex: index, shotIndex: Number(select.value)
  }));

  // 中文配音实验室通过同源 BroadcastChannel 回传 WAV。
  // 若主工作台尚未编排时间线，先暂存文件，等自动编排时再加入配音轨。
  let pendingVoiceFile = null;
  const ttsChannel = typeof BroadcastChannel !== 'undefined'
    ? new BroadcastChannel('xiaozhi-tts-audio-v1') : null;
  if (ttsChannel) {
    ttsChannel.onmessage = async (event) => {
      const data = event.data || {};
      if (data.type !== 'xiaozhi-tts-audio' || !(data.blob instanceof Blob)) return;
      if (!data.blob.size || data.blob.size > 40 * 1024 * 1024) {
        setStatus('收到的配音文件为空或超过40MB，请在配音实验室下载后手动上传。');
        return;
      }
      const file = new File([data.blob], '小智普通话配音.wav', { type: 'audio/wav' });
      pendingVoiceFile = file;
      if (!composition.clips.length) {
        // The file is safely buffered for the next auto-arrange operation.
        ttsChannel.postMessage({ type: 'xiaozhi-tts-audio-ack' });
        setStatus('普通话配音已自动传回工作台并暂存。接下来点击“自动编排商家视频”，配音会自动加入时间线。');
        return;
      }
      try {
        const voice = await mediaManager.importFile(file, { startTime: 0, trackIndex: 5 });
        if (!voice) throw new Error('配音音轨导入失败');
        voice.volume = 1;
        voice.duration = Math.min(composition.duration, voice.duration);
        voice.trimEnd = (voice.trimStart || 0) + voice.duration;
        pendingVoiceFile = null;
        onCompositionChanged();
        // ACK only after the audio is imported, so the TTS page does not
        // mistake a failed import for a successful delivery.
        ttsChannel.postMessage({ type: 'xiaozhi-tts-audio-ack' });
        setStatus('普通话配音已自动传回，并加入时间线的配音轨。可以试听或继续导出。');
      } catch (error) {
        pendingVoiceFile = file;
        setStatus('配音已收到，但自动加入时间线失败：' + (error?.message || '未知错误') + '。已暂存，可重新编排时自动加入，或手动上传。');
      }
    };
  }
  const profileKeys = ['shop','industry','product','address','offer','copy','brief','style','length'];
  const readProfile = () => Object.fromEntries(profileKeys.map(key => [key, $('xzw-' + key).value]));
  const renderTemplateGuide = () => {
    const plan = getMerchantShotPlan($('xzw-industry').value, 6);
    $('xzw-template-guide').innerHTML = '<strong>行业镜头模板 · 拍摄参考</strong>' +
      '<p class="xzw-note">按顺序拍摄更容易形成完整故事；素材不足时可先拍前几项。内容只是拍摄建议，不代表门店已经具备相关项目。</p>' +
      plan.map((item, index) => '<div class="xzw-shot"><span class="xzw-badge">0' + (index + 1) + '</span> <b>' + escapeHtml(item.role) + '</b><br>' +
        '<span>' + escapeHtml(item.caption) + '</span><br><small>拍摄建议：' + escapeHtml(item.tip) + '</small></div>').join('');
  };
  $('xzw-industry').addEventListener('change', renderTemplateGuide);
  const saveProfile = () => {
    try { localStorage.setItem('xiaozhi-merchant-profile-v1', JSON.stringify(readProfile())); setStatus('商家资料已保存在这台手机的当前浏览器中。'); }
    catch (e) { setStatus('浏览器暂时无法保存资料，请检查存储空间。'); }
  };
  try {
    const saved = JSON.parse(localStorage.getItem('xiaozhi-merchant-profile-v1') || 'null');
    if (saved) profileKeys.forEach(key => { if (saved[key] !== undefined) $('xzw-' + key).value = saved[key]; });
  } catch (e) {}
  renderTemplateGuide();
  $('xzw-save-profile').addEventListener('click', saveProfile);
  $('xzw-make-script').addEventListener('click', () => {
    const profile = readProfile();
    const shotCount = Math.max(1, orderedMediaFiles.length || 6);
    $('xzw-narration').value = makeScript(profile).join('\n');
    $('xzw-captions').value = makeCaptions(profile, shotCount).join('\n');
    setStatus('已根据商家资料和文档要求生成配音稿、逐镜字幕。请核对每一条信息，尤其价格、优惠和地址；限制类要求不会被写进字幕。');
  });
    $('xzw-send-tts').addEventListener('click', () => {
    const script = $('xzw-narration').value.trim();
    if (!script) { setStatus('请先生成或填写配音稿，再发送到中文配音实验室。'); return; }
    if (script.length > 500) { setStatus('当前配音实验室手机测试版最多支持500字，请先缩短文案或分段生成。'); return; }
    const ttsUrl = new URL('./tts-lab.html', window.location.href);
    ttsUrl.hash = new URLSearchParams({ text: script }).toString();
    const opened = window.open(ttsUrl.toString(), '_blank');
    if (!opened) setStatus('浏览器拦截了新页面，请允许此站点打开新标签页后重试。');
    else setStatus('配音稿已带入中文配音实验室。主工作台保持打开时会尝试自动回传；若未成功，可下载 WAV 后手动上传。');
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
    orderedMediaFiles = Array.from($('xzw-files').files || []);
    mediaRoleByFile.clear();
    const files = orderedMediaFiles;
    const size = files.reduce((n, f) => n + f.size, 0);
    $('xzw-file-summary').textContent = files.length + ' 个素材 · ' + (size / 1024 / 1024).toFixed(1) + ' MB';
    renderMediaMapping();
  });
  $('xzw-extract-requirements').addEventListener('click', () => {
    const source = $('xzw-brief').value.trim();
    invalidateProductionPreview();
    const unique = splitMerchantRequirements(source, 16);
    const container = $('xzw-requirements');
    container.innerHTML = '';
    if (!unique.length) {
      setStatus('请先上传文档或粘贴商家要求，再提取制作清单。');
      return;
    }
    const selectedCount = Math.max(1, Math.min(8, $('xzw-files').files?.length || 6));
    const shotOptions = getMerchantShotPlan($('xzw-industry').value, selectedCount);
    const classify = text => {
      if (/地址|位置|导航|电话|联系|营业时间|结尾|到店/.test(text)) return shotOptions.length - 1;
      if (/优惠|折扣|开业|活动|套餐|价格|限时/.test(text)) return Math.max(0, shotOptions.length - 2);
      if (/招牌|主打|产品|菜品|商品|服务|特色/.test(text)) return Math.min(2, shotOptions.length - 1);
      if (/门头|门店|环境|装修|入口/.test(text)) return 0;
      return Math.min(container.children.length, shotOptions.length - 1);
    };
    unique.forEach((text, index) => {
      const card = document.createElement('div');
      card.className = 'xzw-requirement';
      const label = document.createElement('label');
      label.textContent = '商家要求 ' + (index + 1) + (/(必须|务必|一定|重点|突出|不要|禁止)/.test(text) ? ' · 重点核对' : '');
      const textarea = document.createElement('textarea');
      textarea.className = 'xzw-requirement-text';
      textarea.value = text;
      textarea.maxLength = 300;
      const select = document.createElement('select');
      select.className = 'xzw-requirement-shot';
      shotOptions.forEach((shot, shotIndex) => {
        const option = document.createElement('option');
        option.value = String(shotIndex);
        option.textContent = '安排到镜头 ' + (shotIndex + 1) + ' · ' + shot.role;
        select.appendChild(option);
      });
      select.value = String(Math.min(classify(text), shotOptions.length - 1));
      const confirmation = document.createElement('label');
      confirmation.className = 'xzw-check';
      const confirmed = document.createElement('input');
      confirmed.type = 'checkbox';
      confirmed.className = 'xzw-requirement-confirmed';
      const confirmationText = document.createElement('span');
      confirmationText.textContent = '已核对这条要求，内容准确且可以用于宣传';
      confirmation.append(confirmed, confirmationText);
      textarea.addEventListener('input', invalidateProductionPreview);
      select.addEventListener('change', invalidateProductionPreview);
      confirmed.addEventListener('change', invalidateProductionPreview);
      card.append(label, textarea, select, confirmation);
      container.appendChild(card);
    });
    setStatus('已拆出 ' + unique.length + ' 条商家要求。请检查每条要求并确认对应镜头，再点击自动编排。');
  });
  $('xzw-industry').addEventListener('change', () => {
    renderTemplateGuide();
    renderMediaMapping();
    invalidateProductionPreview();
  });
  ['xzw-shop','xzw-product','xzw-address','xzw-offer','xzw-copy','xzw-brief','xzw-style','xzw-length','xzw-ratio'].forEach(id => {
    $(id).addEventListener('input', invalidateProductionPreview);
    $(id).addEventListener('change', invalidateProductionPreview);
  });
  $('xzw-brief-file').addEventListener('change', async () => {
    const file = $('xzw-brief-file').files?.[0];
    if (!file) return;
    $('xzw-brief-status').textContent = '正在读取文档…';
    try {
      const text = await extractMerchantDocumentText(file);
      $('xzw-brief').value = text;
      $('xzw-brief-status').textContent = '已读取：' + file.name + ' · ' + text.length + ' 个字符。请核对文字后再生成视频。';
      setStatus('商家需求文档已读取。生成时会把这些要求与门店资料、图片和视频一起编排。');
    } catch (error) {
      $('xzw-brief-status').textContent = error?.message || '文档读取失败';
      setStatus('文档读取失败：' + (error?.message || '未知错误'));
    }
  });

  function getMerchantContentPoints(profile) {
    const fromCards = Array.from($('xzw-requirements').querySelectorAll('.xzw-requirement'))
      .map(card => card.querySelector('.xzw-requirement-text')?.value.trim() || '').filter(Boolean);
    const fromBrief = splitMerchantRequirements(profile.brief || '', 16);
    const fromCopy = String(profile.copy || '').split(/[\n。！？!?；;]+/).map(item => item.trim()).filter(Boolean);
    return [...new Set([...fromCards, ...fromBrief, ...fromCopy])]
      .filter(item => !isRestrictionRequirement(item)).slice(0, 16);
  }

  function makeScript(profile) {
    const shop = String(profile.shop || '').trim();
    const product = String(profile.product || '').trim();
    const offer = String(profile.offer || '').trim();
    const address = String(profile.address || '').trim();
    const lines = [];
    if (profile.style === '高级质感') lines.push(shop ? '镜头慢慢展开，带你认识' + shop + '。' : '镜头慢慢展开，带你看看本次商家实拍。');
    else if (profile.style === '活泼种草') lines.push(shop ? '今天来看看' + shop + '。' : '今天来看看这组商家实拍。');
    else if (profile.style === '促销转化' && offer) lines.push('商家提供的活动信息：' + offer + '。');
    else lines.push(shop ? '今天带你了解' + shop + '。' : '跟着镜头，了解商家现场。');
    if (product) lines.push((shop ? shop + '主打' : '本次重点介绍') + product + '。');
    for (const point of getMerchantContentPoints(profile)) lines.push(point.endsWith('。') ? point : point + '。');
    if (offer && profile.style !== '促销转化') lines.push('商家提供的活动信息：' + offer + '。');
    if (address) lines.push('门店地址：' + address + '。');
    lines.push('具体产品信息、价格及活动规则，请以商家实际说明为准。');
    return lines;
  }

  function makeCaptions(profile, shotCount) {
    const plans = getMerchantShotPlan(profile.industry, shotCount);
    const byShot = new Map();
    Array.from($('xzw-requirements').querySelectorAll('.xzw-requirement')).forEach(card => {
      const text = card.querySelector('.xzw-requirement-text')?.value.trim();
      const shot = Number(card.querySelector('.xzw-requirement-shot')?.value);
      if (!text || isRestrictionRequirement(text) || !Number.isInteger(shot)) return;
      const current = byShot.get(shot) || [];
      current.push(text);
      byShot.set(shot, current);
    });
    return plans.map((plan, index) => (byShot.get(index) || []).join(' · ') || plan.caption);
  }

  $('xzw-build-preview').addEventListener('click', () => {
    const files = orderedMediaFiles;
    const requirements = Array.from($('xzw-requirements').querySelectorAll('.xzw-requirement'));
    const issues = [];
    if (!files.length) issues.push('还没有选择照片或视频素材');
    if (files.length > 8) issues.push('素材超过手机首版每次8个的限制');
    if (requirements.some(card => !card.querySelector('.xzw-requirement-text')?.value.trim())) issues.push('有商家要求内容为空');
    if (requirements.some(card => !card.querySelector('.xzw-requirement-confirmed')?.checked)) issues.push('有商家要求尚未人工核对');
    const assignments = getMediaAssignments();
    if (assignments.length !== files.length) issues.push('有素材尚未匹配镜头用途');
    const plans = roleOptions();
    const requirementLines = requirements.map((card, index) => {
      const text = card.querySelector('.xzw-requirement-text')?.value.trim() || '';
      const shot = Number(card.querySelector('.xzw-requirement-shot')?.value);
      return { text, shot, index };
    });
    const mediaLines = files.map((file, index) => {
      const shotIndex = assignments[index]?.shotIndex ?? index;
      return file.name + ' → 镜头 ' + (shotIndex + 1) + ' · ' + (plans[shotIndex]?.role || '待确认');
    });
    const targetSeconds = Number($('xzw-length').value) || 30;
    const ratio = $('xzw-ratio').value;
    const box = $('xzw-production-preview');
    box.innerHTML = '';
    const panel = document.createElement('section');
    panel.className = 'xzw-preview';
    const heading = document.createElement('h4');
    heading.textContent = issues.length ? '制作检查：发现 ' + issues.length + ' 项待处理' : '制作预览：所有必检项目已确认';
    const status = document.createElement('p');
    status.className = 'xzw-note';
    status.textContent = '预计时长约 ' + targetSeconds + ' 秒 · 画幅 ' + ratio + ' · ' + files.length + ' 个素材 · ' + requirements.length + ' 条商家要求';
    const list = document.createElement('ul');
    [...(issues.length ? issues.map(item => '待处理：' + item) : ['素材和商家要求检查通过']), ...mediaLines, ...requirementLines.map(item => '要求 → 镜头 ' + (item.shot + 1) + '：' + item.text)].forEach(line => {
      const li = document.createElement('li'); li.textContent = line; list.appendChild(li);
    });
    const facts = document.createElement('p');
    facts.className = 'xzw-note';
    facts.textContent = '请核对店名、地址、价格、优惠有效期等事实；本预览不会替商家证明这些信息真实。';
    panel.append(heading, status, list, facts);
    box.appendChild(panel);
    productionPreviewReady = issues.length === 0;
    setStatus(productionPreviewReady ? '制作预览已通过检查。确认无误后，可以点击“确认后自动编排”。' : '请先处理上方待处理项目，再重新生成制作预览。');
    if (issues.length) box.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
  });
  $('xzw-generate').addEventListener('click', async () => {
    const files = orderedMediaFiles;
    const profile = readProfile();
    if (!productionPreviewReady) {
      setStatus('请先点击“先生成制作预览 / 检查遗漏”，处理所有待核对项目后再编排。');
      return;
    }
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
      if (!$('xzw-captions').value.trim()) {
        $('xzw-captions').value = makeCaptions(profile, files.length).join('\n');
      }
    }
    const script = $('xzw-narration').value.trim().split(/[。！？!?；;\n]+/).map(s=>s.trim()).filter(Boolean);
    const customCaptions = $('xzw-captions').value.trim().split(/\n+/).map(s=>s.trim()).filter(Boolean);
    const shotPlan = getMerchantShotPlan(profile.industry, files.length);
    const mediaAssignments = getMediaAssignments();
    const captions = customCaptions.length ? customCaptions : shotPlan.map(item => item.caption);
    const requirementCards = Array.from($('xzw-requirements').querySelectorAll('.xzw-requirement'));
    const requirementsByShot = new Map();
    requirementCards.forEach(card => {
      const text = card.querySelector('.xzw-requirement-text')?.value.trim();
      const shotIndex = Number(card.querySelector('.xzw-requirement-shot')?.value);
      if (!text || !Number.isInteger(shotIndex) || shotIndex < 0) return;
      // Negative instructions are production constraints, never on-screen captions.
      if (isRestrictionRequirement(text)) return;
      const list = requirementsByShot.get(shotIndex) || [];
      list.push(text);
      requirementsByShot.set(shotIndex, list);
    });
    const textTrack = composition.tracks.find(t => t.type === 'text');
    const musicFile = $('xzw-music').files?.[0];
    const voiceFile = $('xzw-voice').files?.[0] || pendingVoiceFile;
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
      // The user confirmed replacing the current timeline. Release its temporary
      // object URLs before clearing clips so repeated workflows do not leak memory.
      if (releaseMediaUrls) releaseMediaUrls();
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
        const assignedShotIndex = mediaAssignments[i]?.shotIndex ?? i;
        const assignedShot = shotPlan[assignedShotIndex] || shotPlan[i];
        const clip = await mediaManager.importFile(file, { startTime: cursor });
        if (!clip) throw new Error('素材导入失败：' + file.name);
        // Importer may move a clip forward to avoid overlapping its original full-length
        // duration. The workflow has its own sequential shot schedule, so restore the
        // requested cursor before applying the shorter shot duration.
        clip.startTime = cursor;
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
          // Ken Burns motion: alternate gentle push-ins / pull-backs and horizontal
          // or vertical pans so a photo sequence feels like a filmed shop tour.
          const width = composition.width;
          const height = composition.height;
          const direction = i % 2 === 0 ? 1 : -1;
          const verticalDirection = i % 3 === 0 ? 1 : -1;
          const panX = width * 0.018 * direction;
          const panY = height * 0.012 * verticalDirection;
          const zoomIn = i % 2 === 0;
          const startScale = zoomIn ? 1.10 : 1.18;
          const endScale = zoomIn ? 1.18 : 1.10;
          clip.keyframes = {
            scale: [
              { time: clip.startTime, value: startScale, easing: 'easeInOut' },
              { time: clip.startTime + shotDuration, value: endScale, easing: 'easeInOut' }
            ],
            x: [
              { time: clip.startTime, value: -panX, easing: 'easeInOut' },
              { time: clip.startTime + shotDuration, value: panX, easing: 'easeInOut' }
            ],
            y: [
              { time: clip.startTime, value: -panY, easing: 'easeInOut' },
              { time: clip.startTime + shotDuration, value: panY, easing: 'easeInOut' }
            ]
          };
        }
        // Apply a short fade at both ends of every shot. The offline renderer
        // also evaluates opacity keyframes, so preview and MP4 share the same motion.
        const fade = Math.min(0.45, shotDuration / 4);
        const shotEnd = clip.startTime + shotDuration;
        clip.keyframes = {
          ...(clip.keyframes || {}),
          opacity: [
            { time: clip.startTime, value: 0, easing: 'easeOut' },
            { time: clip.startTime + fade, value: 1, easing: 'easeInOut' },
            { time: shotEnd - fade, value: 1, easing: 'easeInOut' },
            { time: shotEnd, value: 0, easing: 'easeIn' }
          ]
        };

        const baseCaption = captions[assignedShotIndex % captions.length] || profile.shop || '到店体验，发现更多精彩';
        const assignedRequirements = requirementsByShot.get(assignedShotIndex) || [];
        const caption = [baseCaption, ...assignedRequirements].join(' · ');
        if (textTrack) {
          const subtitleClip = composition.addClip({
            trackId: textTrack.id, type: 'text', name: '字幕 ' + (i + 1),
            text: caption, startTime: cursor, duration: shotDuration,
            x: Math.round(composition.width * 0.07), y: Math.round(composition.height * 0.64),
            width: Math.round(composition.width * 0.86), height: Math.round(composition.height * 0.18),
            fontSize: Math.max(28, Math.round(composition.width * 0.045)),
            fontFamily: 'Noto Sans CJK SC', fontWeight: 'bold', color: '#ffffff',
            bgColor: $('xzw-subtitle').value === 'clean' ? 'rgba(0,0,0,0.24)' : 'rgba(0,0,0,0.58)',
            textAlign: 'center'
          });
          subtitleClip.startTime = cursor;
          subtitleClip.keyframes = {
            opacity: [
              { time: cursor, value: 0, easing: 'easeOut' },
              { time: cursor + fade, value: 1, easing: 'easeInOut' },
              { time: shotEnd - fade, value: 1, easing: 'easeInOut' },
              { time: shotEnd, value: 0, easing: 'easeIn' }
            ]
          };
        }
        shots.push({name:file.name,role:assignedShot?.role || '门店展示',caption,start:cursor,duration:shotDuration});
        cursor += shotDuration;
        onCompositionChanged();
      }
      if (musicFile) {
        const music = await mediaManager.importFile(musicFile, { startTime: 0, trackIndex: 4 });
        if (!music) throw new Error('背景音乐导入失败：' + musicFile.name + '。请检查文件格式，建议使用 MP3 或 WAV。');
        music.volume = 0.22;
        music.loop = true;
        if (music.element) music.element.loop = true;
        // The timeline duration represents the required music bed length.
        // Export and preview loop the source until the merchant video ends.
        music.duration = cursor;
        music.trimEnd = (music.trimStart || 0) + music.duration;
        const musicFade = Math.min(1.2, music.duration / 3);
        music.keyframes = { volume: [
          { time: 0, value: 0, easing: 'easeOut' },
          { time: musicFade, value: 0.22, easing: 'easeInOut' },
          { time: Math.max(musicFade, music.duration - musicFade), value: 0.22, easing: 'easeInOut' },
          { time: music.duration, value: 0, easing: 'easeIn' }
        ]};
      }
      if (voiceFile) {
        const voice = await mediaManager.importFile(voiceFile, { startTime: 0, trackIndex: 5 });
        if (!voice) throw new Error('中文配音导入失败：' + voiceFile.name + '。请检查文件格式，建议使用 MP3 或 WAV。');
        voice.volume = 1;
        voice.duration = Math.min(cursor, voice.duration);
        voice.trimEnd = (voice.trimStart || 0) + voice.duration;
        const voiceFade = Math.min(0.18, voice.duration / 4);
        voice.keyframes = { volume: [
          { time: 0, value: 0, easing: 'easeOut' },
          { time: voiceFade, value: 1, easing: 'easeInOut' },
          { time: Math.max(voiceFade, voice.duration - voiceFade), value: 1, easing: 'easeInOut' },
          { time: voice.duration, value: 0, easing: 'easeIn' }
        ]};
      }
      onCompositionChanged();
      canvasPreview.setCurrentTime(0);
      saveProfile();
      const missingAudio = [];
      if (!voiceFile) missingAudio.push('尚未添加配音');
      if (!musicFile) missingAudio.push('尚未添加背景音乐');
      const durationNote = cursor < targetSeconds - 0.5
        ? '\\n说明：当前素材实际可用时长约 ' + cursor.toFixed(1) + ' 秒，短于目标 ' + targetSeconds + ' 秒。视频素材保持原速，不会为了凑时长而强行慢放或重复画面。'
        : '';
      setStatus('完成：已编排 ' + shots.length + ' 个镜头' + (musicFile ? '、背景音乐' : '') + (voiceFile ? '、配音' : '') + '。现在可以播放预览；如需修改，可在时间线上调整字幕和镜头。' + durationNote + (missingAudio.length ? '\\n提醒：' + missingAudio.join('、') + '，导出前可返回上方补充音频。' : ''));

      const restrictions = requirementCards.map(card => card.querySelector('.xzw-requirement-text')?.value.trim() || '').filter(isRestrictionRequirement);
      $('xzw-shots').innerHTML = '<h3 style="font-size:14px;margin:14px 0 6px">镜头清单 · 已落实商家要求</h3>' +
        shots.map((s,i) => '<div class="xzw-shot"><span class="xzw-badge">镜头 '+(i+1)+'</span> '+escapeHtml(s.name)+' · '+s.duration.toFixed(1)+'秒<br><small>'+escapeHtml(s.caption)+'</small></div>').join('') +
        (restrictions.length ? '<div class="xzw-section"><strong>拍摄注意事项（不会作为字幕显示）</strong>' + restrictions.map(item => '<p class="xzw-note">• '+escapeHtml(item)+'</p>').join('') + '</div>' : '') +
        (requirementCards.length ? '<p class="xzw-note">本次检查了 '+requirementCards.length+' 条商家要求。请预览视频，检查字幕是否完整清晰。</p>' : '');
    } catch (error) {
      console.error('[小智商家短视频]', error);
      // Treat automatic arrangement as one operation: do not leave a partial
      // timeline that could be mistaken for a finished merchant video.
      if (releaseMediaUrls) releaseMediaUrls();
      composition.clear();
      onCompositionChanged();
      canvasPreview.setCurrentTime(0);
      $('xzw-shots').innerHTML = '';
      setStatus('编排失败，已清理本次未完成的时间线，没有生成半成品。原因：' + (error?.message || '未知错误') + '。请检查文件后重新编排。');
    } finally {
      productionPreviewReady = false;
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
