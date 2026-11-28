const test = require('node:test');
const assert = require('node:assert/strict');
const { main } = require('./index.js');

function bodyOf(response) {
  return JSON.parse(response.body);
}

test('GET /health returns explicit parser-not-configured status', async () => {
  const response = await main({ httpMethod: 'GET', path: '/health' });
  assert.equal(response.statusCode, 200);
  assert.equal(bodyOf(response).parser, 'not_configured');
});

test('valid Douyin URL is validated but never fetched', async () => {
  const response = await main({
    httpMethod: 'POST',
    path: '/reference/inspect',
    body: { url: 'https://v.douyin.com/example/' }
  });
  assert.equal(response.statusCode, 501);
  assert.equal(bodyOf(response).code, 'PARSER_NOT_CONFIGURED');
  assert.equal(bodyOf(response).platform, 'douyin');
});

test('valid Xiaohongshu URL is recognized', async () => {
  const response = await main({
    httpMethod: 'POST',
    path: '/reference/inspect',
    body: { url: 'https://www.xiaohongshu.com/explore/example' }
  });
  assert.equal(response.statusCode, 501);
  assert.equal(bodyOf(response).platform, 'xiaohongshu');
});

test('untrusted host is rejected', async () => {
  const response = await main({
    httpMethod: 'POST',
    path: '/reference/inspect',
    body: { url: 'https://example.com/' }
  });
  assert.equal(response.statusCode, 400);
  assert.equal(bodyOf(response).code, 'INVALID_URL');
});

test('credentials and non-standard ports are rejected', async () => {
  for (const url of [
    'https://user:pass@douyin.com/video/1',
    'https://douyin.com:8443/video/1'
  ]) {
    const response = await main({
      httpMethod: 'POST',
      path: '/reference/inspect',
      body: { url }
    });
    assert.equal(response.statusCode, 400);
  }
});

test('malformed JSON is rejected', async () => {
  const response = await main({
    httpMethod: 'POST',
    path: '/reference/inspect',
    body: '{broken'
  });
  assert.equal(response.statusCode, 400);
  assert.equal(bodyOf(response).code, 'INVALID_JSON');
});

test('CORS only reflects an explicitly configured origin', async () => {
  process.env.CORS_ALLOWED_ORIGINS = 'https://a674341702-sudo.github.io';
  const allowed = await main({
    httpMethod: 'GET',
    path: '/health',
    headers: { origin: 'https://a674341702-sudo.github.io' }
  });
  const denied = await main({
    httpMethod: 'GET',
    path: '/health',
    headers: { origin: 'https://attacker.example' }
  });
  assert.equal(allowed.headers['access-control-allow-origin'], 'https://a674341702-sudo.github.io');
  assert.equal(denied.headers['access-control-allow-origin'], undefined);
});

test('unknown routes return 404', async () => {
  const response = await main({ httpMethod: 'POST', path: '/unknown', body: {} });
  assert.equal(response.statusCode, 404);
});
