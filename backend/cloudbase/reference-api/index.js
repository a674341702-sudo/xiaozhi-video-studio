/**
 * 小智视频 · CloudBase HTTP 云函数接口骨架
 *
 * 安全边界：当前仅提供健康检查、请求校验和统一响应格式。
 * 未配置合规平台 Provider 前，不抓取/下载抖音或小红书内容。
 * Node.js 20+；CloudBase HTTP 触发器可将 main(event) 作为入口。
 */

const ALLOWED_HOSTS = new Set([
  'douyin.com',
  'iesdouyin.com',
  'v.douyin.com',
  'xiaohongshu.com',
  'xhslink.com',
  'xhslink.cn'
]);

const MAX_URL_LENGTH = 2048;
const MAX_BODY_BYTES = 16 * 1024;

function json(statusCode, payload, origin = '') {
  const allowedOrigin = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'vary': 'Origin'
  };
  if (origin && allowedOrigin.includes(origin)) {
    headers['access-control-allow-origin'] = origin;
    headers['access-control-allow-methods'] = 'GET,POST,OPTIONS';
    headers['access-control-allow-headers'] = 'content-type';
  }
  return { statusCode, headers, body: JSON.stringify(payload) };
}

function headerValue(headers, name) {
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers || {})) {
    if (key.toLowerCase() === target && typeof value === 'string') return value;
  }
  return '';
}

function requestMethod(event) {
  const context = event.requestContext || {};
  const http = context.http || {};
  return String(event.httpMethod || event.method || http.method || context.httpMethod || 'GET').toUpperCase();
}

function requestPath(event) {
  const context = event.requestContext || {};
  const http = context.http || {};
  const raw = event.path || event.rawPath || http.path || context.path || '/';
  return (String(raw).split('?')[0].replace(/\/+$/, '') || '/');
}

function parseBody(event) {
  if (event && typeof event.body === 'string') {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64').toString('utf8')
      : event.body;
    if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
      const error = new Error('请求内容过大');
      error.code = 'BODY_TOO_LARGE';
      throw error;
    }
    return JSON.parse(raw || '{}');
  }
  if (event && event.body && typeof event.body === 'object') {
    if (Buffer.byteLength(JSON.stringify(event.body), 'utf8') > MAX_BODY_BYTES) {
      const error = new Error('请求内容过大');
      error.code = 'BODY_TOO_LARGE';
      throw error;
    }
    return event.body;
  }
  return {};
}

function validateShareUrl(input) {
  if (typeof input !== 'string' || input.length > MAX_URL_LENGTH) {
    return { ok: false, reason: '链接为空或长度超出限制' };
  }
  let url;
  try {
    url = new URL(input.trim());
  } catch {
    return { ok: false, reason: '链接格式不正确' };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { ok: false, reason: '仅允许 HTTP 或 HTTPS 链接' };
  }
  if (url.username || url.password || url.port) {
    return { ok: false, reason: '链接包含不允许的账号信息或端口' };
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  // Accept only known platform hosts (plus an optional leading www. above).
  // Do not trust arbitrary subdomains merely because they end in a platform domain.
  const allowed = ALLOWED_HOSTS.has(host);
  if (!allowed) return { ok: false, reason: '暂不支持该平台链接' };
  return { ok: true, platform: /xiaohongshu|xhslink/.test(host) ? 'xiaohongshu' : 'douyin' };
}

exports.main = async function main(event = {}) {
  const method = requestMethod(event);
  const origin = headerValue(event.headers, 'origin');

  if (method === 'OPTIONS') return json(204, {}, origin);

  const path = requestPath(event);
  if (method === 'GET' && (path.endsWith('/health') || path === '/')) {
    return json(200, {
      success: true,
      service: 'xiaozhi-reference-api',
      status: 'ready',
      parser: 'not_configured',
      message: '接口运行正常；平台解析 Provider 尚未配置。'
    }, origin);
  }

  if (method !== 'POST' || !path.endsWith('/reference/inspect')) {
    return json(404, { success: false, code: 'NOT_FOUND', message: '接口不存在' }, origin);
  }

  let body;
  try {
    body = parseBody(event);
  } catch (error) {
    if (error && error.code === 'BODY_TOO_LARGE') {
      return json(413, { success: false, code: 'BODY_TOO_LARGE', message: '请求内容超过 16 KB 限制' }, origin);
    }
    return json(400, { success: false, code: 'INVALID_JSON', message: '请求内容不是有效 JSON' }, origin);
  }

  const checked = validateShareUrl(body.url);
  if (!checked.ok) {
    return json(400, { success: false, code: 'INVALID_URL', message: checked.reason }, origin);
  }

  // 有意不在此处 fetch 用户提供的 URL：后续 Provider 必须实现 DNS/IP、
  // 重定向目标、超时、响应大小和平台条款校验，避免 SSRF 与越权抓取。
  return json(501, {
    success: false,
    code: 'PARSER_NOT_CONFIGURED',
    platform: checked.platform,
    message: '分享链接已通过基础校验，但解析服务尚未接入。请打开原视频观察，或上传有权分析的参考视频。',
    limitations: ['当前不自动抓取或下载平台视频', '请勿提交私密链接、账号凭据或 Cookie']
  }, origin);
};
