# 小智一键视频工坊

面向手机和电脑浏览器的视频制作项目，目标是将产品宣传视频与 AI 漫剧制作整合到同一套自动化工作流中。

> 当前仓库基于开源项目 Viz 二次开发。原作者与上游项目：**[Zrnge](https://zrnge.com/viz)** · [github.com/zrnge/viz](https://github.com/zrnge/viz)。请保留原项目 MIT License 与版权声明。

## 产品方向

- **产品宣传**：上传商品/门店图片、参考视频和提示词，规划宣传文案与镜头，再自动编排成片。
- **AI 漫剧**：输入故事梗概和角色素材，规划角色、场景、分镜、对白，再制作视频。
- **自动剪辑**：复用现有多轨编辑器，组合图片、视频、字幕和音频，并通过 FFmpeg WASM 导出。
- **手机优先**：优先保证 Android 手机浏览器能够完成上传、策划、预览和短视频导出。

## 当前技术基础

- Vanilla JavaScript + Vite
- 多轨视频/图片/文字/音频编辑器
- Canvas 预览与基础素材处理
- FFmpeg WASM 浏览器端导出
- GitHub Actions + GitHub Pages 静态部署

## 重要说明

GitHub Pages 只托管静态网页，不提供 AI 模型推理服务。真正的 AI 文案策划、图像/视频生成和高质量中文配音，需要后续接入模型服务或自建后端。FFmpeg 负责剪辑与合成，不会把静态图片本身变成 AI 生成的视频。

在 AI 服务尚未接入前，项目应明确标注能力边界：可以先使用用户素材完成自动镜头编排、图片动态运镜、字幕和基础合成；不得把未执行的生成任务显示成成功。

任何第三方 API Key 都必须保存在受保护的服务端环境变量中，不得写入前端代码或提交到 GitHub。默认免费优先，接入付费服务前必须说明费用和额度。

## 升级路线

详细设计见 [AI 全自动工作流升级方案](docs/AI_WORKFLOW_ROADMAP.md)。

1. 修正部署路径与中文品牌。
2. 增加产品宣传/AI 漫剧两种工作流入口、素材上传和提示词输入。
3. 建立 AI 导演策划、结构化分镜、进度与失败重试机制。
4. 建立无需付费 API 的本地自动成片流程：图片编排、动态运镜、字幕、音乐、时间线和 MP4 导出。
5. 再逐步接入可选的文本模型、图像/视频生成和中文配音服务。

## 本地开发

需要 Node.js 20+ 与 npm：

```bash
npm install
npm run dev
```

生产构建：

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
