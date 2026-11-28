# 端侧中文 AI 配音技术验证记录

更新日期：2026-11-28

状态：候选方案研究中；未集成、未通过中国大陆网络验收、未通过 Android 真机验收。

## 目标

为小智视频提供商家可直接使用的普通话 AI 配音：商家输入/确认营销文案，生成可试听的语音文件，再复用现有配音轨与 MP4 混音导出流程。默认不上传商家文案或录音，不引入付费 API，不在未验证前宣称功能可用。

## 候选：OpenMOSS / MOSS-TTS-Nano

官方仓库：https://github.com/OpenMOSS/MOSS-TTS-Nano

- 官方仓库采用 Apache-2.0 许可证（仍需随集成保留许可证和版权声明，并逐项核验模型权重及配套资源的许可）。
- 官方提供 ONNX CPU 推理路线，并介绍了浏览器端 ONNX Runtime Web 方案。
- 端侧推理理论上可避免每次生成都调用云端 API，但模型文件仍需先下载到设备，不能把“本机推理”误解为“无需下载模型”。
- 完整浏览器流程不仅需要 TTS ONNX 文件，还需要 Audio Tokenizer ONNX 文件、tokenizer 和元数据/manifest。
- 官方 Android 示例是 smoke example：模型文件需放在 APK 外；README 指出示例只用预先分词的短 prompt，任意文本还需要 SentencePiece tokenizer 集成。因此不能直接把该示例当作小智视频的 Android 完整配音方案。

## 浏览器参考项目的限制

参考项目：https://github.com/OpenMOSS/MOSS-TTS-Nano-Reader

检查到的实现包括 ONNX Runtime Web、浏览器端推理 host、tokenizer sandbox，以及使用浏览器 Origin Private File System（navigator.storage.getDirectory）管理大模型文件。

当前参考实现的模型仓库常量和文件下载地址指向 Hugging Face。直接照搬默认下载逻辑不符合小智视频“中国大陆普通网络可用”的硬性要求。

另外，Reader 仓库根目录当前未见 LICENSE 文件；在确认该仓库代码的再分发/改编许可之前，不复制其实现代码。只把公开文档和架构作为技术研究参考。MOSS-TTS-Nano 自身 Apache-2.0 许可不自动覆盖 Reader 仓库的独立代码、第三方依赖或所有模型资源。

## 中国大陆资源现状

- 已找到 ModelScope 上的 MOSS-TTS-Nano 模型页，页面展示的是 PyTorch 模型，标注约 237.81 MB。
- 目前尚未确认官方 ONNX TTS 模型与 Audio Tokenizer ONNX 模型在 ModelScope 或其他国内仓库存在完整、官方、可校验的镜像。
- 因此目前不能承诺用户在中国大陆可以顺利下载完整浏览器模型包，也不能将 Hugging Face 自动下载接入生产。

## 集成前必须通过的门槛

1. 找到完整模型清单的国内可访问来源；逐个记录文件大小、SHA-256、许可与来源。缺一项都不能开始生产接入。
2. 不允许运行时回退到 Hugging Face、海外 CDN 或其他未验证域名。
3. 模型按需下载，展示总大小、进度、剩余空间、暂停/继续/重试；支持用户主动清除模型缓存。
4. 检测浏览器是否支持所需的 ONNX Runtime Web、WASM、Worker、持久化存储能力；不支持时明确回退到上传录音。
5. 首次下载前明确告知模型体积；不得在页面打开时自动下载数百 MB 资源。
6. Android 真机测试普通话音质、生成耗时、内存峰值、发热、后台切换、弱网恢复、连续多段生成。
7. 生成音频必须可试听、可取消；成功后以 WAV/PCM 或可靠音频 Blob 交给现有配音轨，不改写现有 MP4 导出管线。
8. 对商用场景核验模型和所有配套文件的许可证、商用范围及署名义务。

## 当前决定

暂不把 MOSS-TTS-Nano 接入商家主流程，不添加“AI 配音已可用”的按钮或宣传文案。下一阶段优先完成国内 ONNX 模型镜像核验与文件清单/校验和验证；确认资源完整后，再建立独立实验页验证 Android 浏览器端推理。若国内镜像无法满足条件，则继续保留手机录音/上传配音作为可靠方案，另行评估合规的国内离线 TTS 备选。

## 参考

- https://github.com/OpenMOSS/MOSS-TTS-Nano
- https://github.com/OpenMOSS/MOSS-TTS-Nano-Reader
- https://www.modelscope.cn/models/openmoss/MOSS-TTS-Nano/summary
