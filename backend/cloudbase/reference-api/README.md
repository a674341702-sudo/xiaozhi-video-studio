# CloudBase 参考链接 API（安全骨架）

本目录提供可部署前的 Node.js 20+ HTTP 云函数入口。它**不是已完成的平台解析器**：目前只实现健康检查、分享链接基础校验、CORS 白名单和统一错误响应。

## 本地测试

在该目录运行 `npm test`（Node.js 20+，使用 Node 内置测试框架，无需安装第三方依赖）。测试覆盖健康检查、抖音/小红书域名识别、恶意域名/凭据/端口拒绝、JSON 错误、CORS 白名单、404 路由、API Gateway v2 事件格式、Base64 请求体和 16 KB 请求体限制。

## 接口

- `GET /health`：检查函数是否可用；`parser` 会明确返回 `not_configured`。
- `POST /reference/inspect`：JSON body：`{"url":"https://..." }`。合法域名会返回 HTTP 501 `PARSER_NOT_CONFIGURED`，不会抓取视频。

支持域名白名单：抖音 `douyin.com`、`iesdouyin.com`、`v.douyin.com`；小红书 `xiaohongshu.com`、`xhslink.com`、`xhslink.cn`（含其子域名）。

## 环境变量

- `CORS_ALLOWED_ORIGINS`：逗号分隔的精确前端 Origin，例如 `https://a674341702-sudo.github.io`。不要使用 `*`。
- 请求体上限为 16 KB；超限返回 HTTP 413 `BODY_TOO_LARGE`。
- 当前不需要也不接受 Cookie、平台账号密码或第三方 API Key。

## 部署前检查

1. 在 CloudBase 创建 Node.js 20 HTTP 云函数，将 `index.js` 作为入口；代码兼容常见的 `httpMethod/path/headers/body` 事件字段，以及 API Gateway v2 的 `requestContext.http.method/path` 结构。实际部署后仍须用 CloudBase 控制台提供的真实触发器进行验证。
2. 配置 `CORS_ALLOWED_ORIGINS` 为实际前端 Origin。
3. 先用 GET `/health` 验证，再用 POST `/reference/inspect` 验证错误响应。
4. 不要把函数地址或任何密钥写入前端仓库，除非前端 API 地址已经通过配置和 CORS 验证。

## 接入真正解析 Provider 前的硬性要求

- 仅处理平台条款和适用法律允许公开访问、允许处理的元数据。
- 所有重定向逐跳重新校验协议、主机和解析后的 IP；拒绝 localhost、私网、链路本地和云元数据地址，防止 SSRF。
- 限制 DNS 查询、重定向次数、连接/总超时、响应体大小和 MIME 类型。
- 不绕过登录、验证码、签名、访问控制；不要求用户粘贴 Cookie。
- 不下载或复用原视频画面、声音、水印；原创成片使用商家自有/获授权素材。
- 如需 ASR、视觉模型或第三方解析服务，先明确费用、额度、数据保留和商用许可，再单独接入。
- 解析失败必须回退到当前「上传有权分析的视频 + 本地关键帧 + 手动观察笔记」流程。

## 当前状态

这只是可测试的后端接口骨架，尚未部署到用户的 CloudBase 环境，也未连接前端生产页面。GitHub Pages 仍只负责静态网页托管。
