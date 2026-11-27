# 小智商家短视频生产线

面向 Android 手机优先的视频制作工作台。V1.0 专注商家宣传短视频：把门店照片、视频和文案整理成脚本、镜头安排、字幕、配音和音乐，再预览、修改并导出 MP4。

> 当前仓库基于开源项目 Viz 二次开发。原作者与上游项目：**[Zrnge](https://zrnge.com/viz)** · [github.com/zrnge/viz](https://github.com/zrnge/viz)。请保留原项目 MIT License 与版权声明。

## 版本规划

- **V1.0（当前开发）商家短视频**：门店素材导入、行业模板、宣传脚本、自动镜头编排、字幕、配音/音乐轨道、手机预览、视频导出、商家项目库和完整项目包。
- **V2.0（后续开发）AI 漫剧**：第一版交付后再增加故事创作、角色一致性、场景、分镜、对白配音和漫剧成片。AI 漫剧不属于 V1.0 的交付范围。

## 当前技术基础

- Vanilla JavaScript + Vite
- 多轨视频/图片/文字/音频编辑器
- Canvas 预览与基础素材处理
- FFmpeg WASM 浏览器端导出
- IndexedDB 本机项目保存
- PWA 手机桌面安装入口
- GitHub Actions 自动构建

## 能力边界与安全

当前商家脚本主要由本地行业模板辅助，自动剪辑使用用户上传的素材、图片动态运镜、字幕和音频混合。浏览器端中文配音和字幕识别仍需完成手机、网络和音质验证。没有真实接入模型服务时，不会把模板编排宣传成 AI 文生视频或图生视频。

GitHub Pages 只托管静态网页，不提供 AI 模型推理服务，也不能安全保存第三方 API 密钥。任何第三方 API Key 都必须保存在受保护的服务端环境变量中，不得写入前端代码或提交到 GitHub。默认免费优先，接入付费服务前必须说明费用和额度。

项目包使用 ZIP 格式，导入时校验目录、路径、本地文件头、CRC32 和素材映射。项目库只保存在当前浏览器/设备，不是云端备份；建议定期导出完整项目包。

## 开发路线

详细范围、限制和验收标准见 [V1.0 / V2.0 开发路线图](docs/AI_WORKFLOW_ROADMAP.md)。

第一版安卓手机首轮测试步骤见 [V1.0 安卓手机测试清单](docs/V1.0_PHONE_TEST.md)。

## 本地开发

需要 Node.js 20+ 与 npm：

```bash
npm install
npm run dev
```

生产构建（包含项目包往返与安全测试）：

```bash
npm run build
npm run preview
```

## GitHub Pages

仓库使用 GitHub Actions 构建并部署，默认子路径为：

`/xiaozhi-video-studio/`

请在仓库 Settings → Pages 中选择 GitHub Actions 作为部署来源。

## License

本项目沿用上游 MIT License。上游版权与许可文件应随仓库保留。
