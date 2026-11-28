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

## 第二候选：sherpa-onnx Matcha 中文 WASM

官方项目：https://github.com/k2-fsa/sherpa-onnx
中文模型说明：https://k2-fsa.github.io/sherpa/onnx/tts/all/Chinese/matcha-icefall-zh-baker.html
中文浏览器演示源码：https://github.com/k2-fsa/sherpa-onnx/tree/master/wasm/tts

- sherpa-onnx 官方文档列出 Matcha 中文（Baker）WebAssembly 浏览器演示，也提供 Android TTS Engine APK 的下载入口；这比 MOSS 的 760MB 级双模型堆栈更值得优先做轻量手机验证。
- sherpa-onnx 文档中的中文 Matcha 浏览器演示示例标注模型包约 125 MB；该体积是示例页面标注值，正式集成前仍须按实际资源清单重新计算。
- 该方案使用固定音色的中文合成路线，不应宣传为 MOSS 那样的参考音频声音克隆；是否足够自然、是否适合商家探店营销，需要实际试听。
- 官方示例页面当前通过 Hugging Face 数据集 CDN 加载远程模型资源。虽然项目文档对部分其他 WASM 演示提供 ModelScope 镜像，但本次未确认中文 Matcha WASM 模型本身有完整、可校验的国内镜像。
- 因此它目前只是更轻量的实验候选，不能直接接入正式商家流程，也不能宣称中国大陆网络可用。

## 候选对比与当前优先级

| 方案 | 已确认能力 | 主要阻塞 | 当前定位 |
|---|---|---|---|
| sherpa-onnx Matcha 中文 WASM | 有中文浏览器 WASM 演示；有 Android TTS Engine 路线 | 中文模型国内镜像未核实；音质和手机性能未测 | **优先做轻量验证** |
| MOSS-TTS-Nano ONNX | 浏览器 ONNX 路线；支持中文和参考音频工作流 | TTS + 音频 tokenizer 双模型约 760MB 级；国内完整镜像未核实 | 后续高质量/声音克隆候选 |
| Kokoro 中文 ONNX 浏览器方案 | 有第三方中文前端和浏览器运行封装 | WebGPU 优先；模型与 voice 资源国内来源未验证；第三方实现需审许可证 | 观察，不优先接入 |


## 本轮补充：Matcha 中文模型资源核对（2026-11-28）

核对来源：
- 官方 Matcha Baker 中文模型说明：https://k2-fsa.github.io/sherpa/onnx/tts/all/Chinese/matcha-icefall-zh-baker.html
- 官方 Matcha 中英双语模型说明：https://k2-fsa.github.io/sherpa/onnx/tts/all/Chinese-English/matcha-icefall-zh-en.html
- 官方 WASM TTS 目录：https://github.com/k2-fsa/sherpa-onnx/tree/master/wasm/tts

### 资源体积与依赖修正

Matcha Baker 中文模型并非“单个 125 MB 模型文件”。官方清单至少包含：
- 声学模型 `model-steps-3.onnx`：约 72 MB；
- 声码器 `vocos-22khz-univ.onnx`：约 51 MB；
- `tokens.txt`、`lexicon.txt`、`phone.fst`、`date.fst`、`number.fst` 等小型词典/规则文件。

因此模型核心文件合计约 123 MB，尚未计入 WASM 运行时、浏览器缓存和下载临时空间。不能只按演示页的“约 125 MB”作为整个首次安装体积。

官方 WASM TTS 目录包含 CMake 构建文件、JS 主线程、Worker、WASM C++ 源码和 assets 说明；仓库目录本身没有可直接复制使用的已构建中文模型包。集成需要先构建并验证对应 WASM 运行时，再准备模型资源。

### 中英模型与 ModelScope 来源的边界

官方 `matcha-icefall-zh-en` 页面明确说明该模型来自 ModelScope 的 `dengcunqin/matcha_tts_zh_en_20251010`，支持中文和英文，采样率 16 kHz；但官方运行说明仍要求另外下载 sherpa-onnx 发布的 ONNX 声学模型包和 Vocos 声码器。仅凭“训练模型来源于 ModelScope”不能证明 ModelScope 页面已提供可直接用于浏览器的完整 ONNX + vocoder + FST 资源集合。

官方文档列出的 WASM 在线演示仍托管在 Hugging Face Space；不能作为大陆生产环境的默认加载入口。官方文档还列有 Android APK 的 hf-mirror 下载项，但它不是我们已经完成可用性、完整性和稳定性验收的大陆资源托管方案。

### WASM 运行时依赖补充

进一步检查 sherpa-onnx 官方 `wasm/tts` 源码后，确认浏览器端不只是两个 ONNX 模型：
- 需要从源码构建 sherpa-onnx TTS 的 Emscripten/WASM 运行时（JS glue、WASM 二进制及 Worker）；
- 官方当前演示还加载独立的 `piper-phonemize` Emscripten bundle，并需要其 `.data`/espeak-ng 资源；
- 主线程脚本创建 Worker，Worker 加载 sherpa-onnx 的 WASM glue 与 JS wrapper；
- 模型初始化后才开放文本生成，生成结果通过 Worker transferable Float32Array 返回，适合后续封装为 WAV Blob 再交给现有配音轨。

因此，约 123 MB 只是 Matcha Baker 模型与声码器的核心文件估算，不是完整浏览器首次下载总量。运行时、音素化数据、词典/规则文件和临时缓存都必须计入。当前不能发布一个只显示“125 MB”的下载提示，也不能仅复制 `wasm/tts` 的 JS 文件就认为 TTS 可运行。

sherpa-onnx 主仓库许可证为 Apache-2.0；集成时仍需保留许可证/NOTICE（如适用），并单独核实模型、声码器、piper-phonemize 及其 espeak 数据各自的许可证。

### 当前工程决策

1. 继续把 sherpa-onnx Matcha 作为候选，但暂停将其标记为“国内可用”。
2. 先取得可核验的 WASM 运行时产物、模型包及 vocoder 的具体下载来源、文件大小、SHA-256 和许可证；缺任何一项都不接入商家工作台。
3. 若最终资源必须由我们托管，先比较 GitHub Pages 仓库体积/带宽限制与现有 CloudBase 免费额度；不得直接把 123 MB 模型提交进 Git 仓库，也不得在未经用户同意时启用付费对象存储或 CDN。
4. 单独实验页必须显式展示首次下载总量、只在用户点击后下载、支持取消/重试，并且不能在首页启动时加载模型。
5. 保持当前录音上传方案作为可用回退；不在尚未验证音质和性能前替换现有配音流程。

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

下一步优先建立独立的 sherpa-onnx Matcha 中文 WASM 实验页，验证其真实资源清单、下载来源、安卓 Chrome/微信浏览器兼容性、CPU 推理速度和成品音质。只有在完整模型资源能从中国大陆普通网络稳定获取且许可清晰时，才考虑与现有配音轨对接。

MOSS-TTS-Nano 暂不进入商家主流程；它的参考音频/声音克隆能力有价值，但双模型包体明显更大。Kokoro 方案暂列观察项，不在当前版本引入 WebGPU 等额外运行条件。


## 参考

- https://github.com/OpenMOSS/MOSS-TTS-Nano
- https://github.com/OpenMOSS/MOSS-TTS-Nano-Reader
- https://www.modelscope.cn/models/openmoss/MOSS-TTS-Nano/summary


## 独立实验页进展（2026-11-28）

已新增静态设备兼容性实验页：`public/tts-lab/index.html`，构建后访问路径为：

`/xiaozhi-video-studio/tts-lab/`

页面目前只检测安全上下文、WebAssembly、Worker、AudioContext、IndexedDB、OPFS 和录音 API，并允许用户本地选择音频试听。页面不申请麦克风权限、不上传音频、不请求远程模型、不自动下载资源。它是端侧能力探针，不是 TTS 模型演示或 AI 配音功能。

新增 `scripts/test-tts-lab.mjs`，并已加入 `npm run build`，检查页面隐私边界、WAV 选择入口和设备能力探针。该测试通过仅表示实验页静态约束成立，不代表模型推理或大陆网络验收通过。

正式集成前仍需完成：WASM runtime 构建、音素化依赖打包、完整模型资源国内镜像与哈希校验、Android 真机推理试听。


## 本轮工程加固（2026-11-28）

### 配音实验页
- 本地音频测试现在支持 WAV、MP3、M4A、AAC、OGG、WebM；检查空文件、40MB 上限和文件扩展名/MIME。
- 显示浏览器读取到的音频时长；解码失败时提示转换为标准 WAV/MP3。
- 增加清除音频按钮，切换文件或离开页面时释放 Object URL。
- WebAssembly 检测改为验证最小 WASM 模块，而不只检查全局对象是否存在。
- 页面增加模型接入状态栏，明确标注模型、WASM、国内资源哈希和 Android 真机验收均未完成。

### 模型资源完整性闸门
新增 `public/tts-models/manifest.json` 和 `scripts/verify-tts-assets.mjs`。构建时会检查每个登记资源的：
- 唯一 ID 和仓库内安全路径；
- 文件是否存在、实际字节数是否匹配；
- SHA-256 是否匹配；
- HTTPS 来源、许可证说明和大陆可用性核验标记。

当前 manifest 保持 `status: not-ready` 且资源列表为空，因此构建只确认“尚无获批模型资源”，不会下载模型或启用 AI 生成。只有资源文件、哈希、许可证和大陆网络验证都齐全，才允许把 manifest 改为 ready。该校验不会联网访问 source_url，也不会替代人工大陆网络验收。


## 2026-11-28：按当前上游源码重新核对 WASM TTS 构建

本节以 sherpa-onnx 上游提交 `4ef1e51d7f177e426bf5e72243604b1249ec315c`（2026-11-28）及其当前 `wasm/tts` 代码为准；若与前文早期调查描述冲突，以本节为准。

### 重要修正：Matcha 中文不需要把 piper/espeak 当作必需依赖

当前上游 `wasm/tts/assets/README.md` 明确提供两类文本前端：piper-phonemize 或 lexicon。Matcha 中文模型自带 `lexicon.txt`，`sherpa-onnx-tts.js` 对 Matcha 中文使用 lexicon，因此本实验选择 lexicon 路线：
- 将 `modelType` 设置为 `2`（Matcha Chinese）；
- 使用模型包内的 `model-steps-3.onnx`、`tokens.txt`、`lexicon.txt`、`phone.fst`、`date.fst`、`number.fst`；
- 另配 `vocos-22khz-univ.onnx`；
- 不需要下载 piper-phonemize 浏览器包，也不需要 espeak-ng-data。
  
因此，前面早期记录中把 piper-phonemize/espeak-ng-data 描述成 Matcha 中文必需依赖的说法已过时。piper 是上游其他模型/前端的可选路径，不是当前 Matcha 中文配置的必要条件。

### 当前上游构建参数与内存风险

- 官方构建脚本为 `build-wasm-simd-tts.sh`，上游提示 Emscripten 4.0.23 已知可用。
- 当前 TTS CMake 目标会把 `assets/` 预加载进 `sherpa-onnx-wasm-main-tts.data`（`--preload-file assets@.`），并生成 JS glue、WASM、data 文件和浏览器 Worker/UI。
- 当前 CMake flags 设置初始 WASM 内存为 `512MB`，并允许增长。这对部分 Android 手机可能是明显的内存压力；不能只看下载文件大小，必须真机测内存峰值、页面是否被系统回收和连续生成稳定性。
- 浏览器 demo 的 Worker 会初始化模型，完成后才返回 ready；生成结果是 Float32Array 与采样率，可封装为 WAV 后接入小智视频配音轨。

### 资源体积重新核对

官方 Matcha Baker 页面显示声学模型解压后约 72MB，vocoder 约 51MB。当前 GitHub Release API 对应资源记录为：
- `matcha-icefall-zh-baker.tar.bz2`：75,455,267 bytes（压缩包，官方 release asset SHA-256：`ae70096b19c6e283ea351a26b8a718ce6427c8bde8c1da22eb46a5478d39a69b`）；
- `vocos-22khz-univ.onnx`：53,884,024 bytes；
- 解压模型包还包含 lexicon、tokens 和 FST 规则文件；
- 构建产物还包含 WASM runtime 和预加载的模型 data，最终体积必须以真实构建输出为准。

以上是上游 GitHub 资源的体积，不代表这些资源在中国大陆普通网络已可访问。模型文件许可证及商用范围也尚未完成逐项核验。

### 新增：手动触发的实验构建流程

新增 `.github/workflows/tts-wasm-experiment.yml`：
- 只允许 `workflow_dispatch` 手动触发，不会随每次普通 push 自动下载模型；
- 固定 sherpa-onnx 上游 commit 和 Emscripten 版本；
- 下载 Matcha 中文模型包并校验上游 SHA-256；vocoder 使用上游 checksum 文件校验；
- 将官方 demo 配置为 `modelType=2`，移除无需使用的 piper 脚本引用；
- 构建后检查 JS/WASM/data/Worker/UI 文件齐全；
- 仅上传 7 天保留期的实验 artifact，不部署 GitHub Pages、不修改生产入口、不发布模型到商家工作台。

此流程使用 GitHub 上游下载源，仅用于验证“能否按官方源码构建出完整浏览器 TTS 包”。它不能证明中国大陆网络下载可用，也不能证明模型可商用，更不能代替 Android Chrome/微信浏览器实测。正式接入仍须先解决大陆可用资源镜像、许可证、体积和 512MB 初始内存风险。

### 第二阶段：浏览器端真实中文 WAV 冒烟测试（2026-11-28）

实验构建工作流进一步增加 Playwright + Chromium 自动化验证：
- WASM 页面在本机 HTTP 服务下运行，等待 Worker 初始化完成；
- 自动输入中文测试句并触发 Matcha 中文合成；
- 等待页面产生音频 Blob；
- 读取 Blob 并验证 RIFF/WAVE 头、采样率、文件长度和音频时长；
- 监听浏览器运行时异常，以及关键同源 JS/WASM/data 文件请求失败；
- 只有实际生成 WAV 才能通过该步骤，静态文件齐全不再被当作 TTS 成功。

实验产物清单采用文件级 SHA-256 和字节数记录，排除清单自身，避免自引用校验。模型解压后会逐项检查 model-steps-3.onnx、tokens.txt、lexicon.txt、phone.fst、date.fst、number.fst；缺少任何文件即终止。

此浏览器冒烟测试仍运行在 GitHub Actions 的 Linux Chromium 环境。它能验证构建包在标准桌面 Chromium 上的真实推理路径，但不能替代 Android 低内存手机、微信内置浏览器或中国大陆网络验收。实验工作流必须手动触发，不会自动部署。
