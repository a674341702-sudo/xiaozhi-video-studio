/**
 * 小智 AI 影视工厂：本地导演策划器
 *
 * 这是无 API Key 的第一阶段策划模块。它把用户输入整理成结构化镜头计划，
 * 不声称自己执行了云端大模型、文生图或文生视频。
 */

const DEFAULTS = {
  product: {
    label: '商家宣传',
    beats: [
      { title: '开场吸引', purpose: '用最有吸引力的门店或产品画面抓住注意力', caption: '发现一家值得认识的好店' },
      { title: '展示特色', purpose: '展示核心产品、服务或环境细节', caption: '每一处细节，都有自己的用心' },
      { title: '建立信任', purpose: '用真实场景、制作过程或经营故事建立信任', caption: '真实体验，值得分享' },
      { title: '行动邀请', purpose: '给观众一个清晰、自然的到店或咨询理由', caption: '欢迎到店体验' },
    ],
  },
  story: {
    label: '故事电影',
    beats: [
      { title: '建立世界', purpose: '交代人物、地点和故事氛围', caption: '故事，就从这里开始' },
      { title: '事件发生', purpose: '出现改变人物处境的关键事件', caption: '意想不到的事情发生了' },
      { title: '冲突升级', purpose: '展示人物面对的困难、选择和情绪变化', caption: '真正的考验才刚刚开始' },
      { title: '情绪高潮', purpose: '呈现故事最重要的行动或情感爆发', caption: '这一刻，他必须做出选择' },
      { title: '结尾余韵', purpose: '给出结果、反转或留下下一段故事的悬念', caption: '而新的故事，才刚刚开始' },
    ],
  },
  comic: {
    label: 'AI 漫剧',
    beats: [
      { title: '开篇钩子', purpose: '用强冲突、悬念或反常识画面吸引观众', caption: '所有的故事，都有一个意外的开始' },
      { title: '人物登场', purpose: '介绍主角外观、性格和当前处境', caption: '主角，正式登场' },
      { title: '矛盾爆发', purpose: '让人物关系或核心矛盾发生变化', caption: '命运的齿轮开始转动' },
      { title: '关键转折', purpose: '揭示线索、能力、秘密或新的危机', caption: '真相，远没有表面那么简单' },
      { title: '结尾悬念', purpose: '留下下一集值得追看的问题', caption: '下一集，答案即将揭晓' },
    ],
  },
};

function splitSentences(text) {
  return String(text || '')
    .split(/[。！？!?；;\n]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function chooseBeat(mode, index, total) {
  const beats = DEFAULTS[mode].beats;
  const position = total <= 1 ? 0 : Math.round(index * (beats.length - 1) / (total - 1));
  return beats[position];
}

/**
 * @param {{mode:'product'|'story'|'comic', prompt:string, assetNames?:string[]}} input
 * @returns {{title:string, mode:string, summary:string, shots:Array, limitations:string[]}}
 */
export function createWorkflowPlan({ mode = 'product', prompt = '', assetNames = [] } = {}) {
  const selectedMode = DEFAULTS[mode] ? mode : 'product';
  const sentences = splitSentences(prompt);
  const beats = DEFAULTS[selectedMode].beats;
  const count = Math.max(3, Math.min(8, sentences.length || beats.length));
  const shots = Array.from({ length: count }, (_, index) => {
    const beat = chooseBeat(selectedMode, index, count);
    const sourceText = sentences[index] || sentences[Math.min(index, Math.max(0, sentences.length - 1))] || '';
    const asset = assetNames[index] || assetNames[index % Math.max(1, assetNames.length)] || '';
    return {
      id: 'shot-' + (index + 1),
      order: index + 1,
      title: beat.title,
      purpose: beat.purpose,
      visualDirection: sourceText
        ? '围绕这段内容设计画面：' + sourceText
        : beat.purpose,
      narration: sourceText || beat.caption,
      caption: sourceText || beat.caption,
      suggestedAsset: asset,
      durationSeconds: selectedMode === 'comic' ? 4 : 5,
      generationStatus: 'not-generated',
    };
  });

  return {
    title: (sentences[0] || DEFAULTS[selectedMode].label).slice(0, 36),
    mode: selectedMode,
    summary: sentences.join('。') || '请补充故事或商家介绍，导演将据此细化镜头。',
    shots,
    limitations: [
      '当前为本地规则策划，不是云端大模型生成结果。',
      '未配置图像/视频生成服务时，只能使用上传素材进行动态运镜和剪辑。',
      '配音需上传音频或后续接入语音服务。',
    ],
  };
}

export function getWorkflowModeLabel(mode) {
  return DEFAULTS[mode]?.label || DEFAULTS.product.label;
}
