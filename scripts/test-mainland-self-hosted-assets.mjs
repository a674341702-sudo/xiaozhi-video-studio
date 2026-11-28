import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [worker, copyScript, packageJson] = await Promise.all([
  readFile(new URL('../src/ffmpeg-worker.js', import.meta.url), 'utf8'),
  readFile(new URL('./copy-ffmpeg-core.js', import.meta.url), 'utf8'),
  readFile(new URL('../package.json', import.meta.url), 'utf8')
]);

assert.match(worker, /function resolveCoreUrl\(filename\)/,
  'FFmpeg 核心文件必须通过统一的本站路径解析函数加载');
assert.match(worker, /import\.meta\.env\?\.BASE_URL/,
  '本站资源路径必须兼容 GitHub Pages 子路径和国内站点根路径');
assert.match(worker, /toBlobURL\(resolveCoreUrl\('ffmpeg-core\.wasm'\)/,
  'WASM 必须从本站解析出的路径加载');
assert.match(worker, /new URL\(resolveCoreUrl\('ffmpeg-core\.js'\), window\.location\.href\)/,
  'FFmpeg Worker JS 必须从当前站点加载');
assert.match(worker, /已禁用境外 CDN 备用下载/,
  '本站 FFmpeg 资源失败时不得回退到境外 CDN');
assert.match(copyScript, /node_modules\/\@ffmpeg\/core\/dist\/esm/,
  '构建时必须从已安装的本地 npm 依赖读取 FFmpeg 核心文件');
assert.match(copyScript, /public\/ffmpeg-core/,
  '构建时必须将 FFmpeg 核心文件复制到静态站点资源目录');
assert.match(copyScript, /'ffmpeg-core\.js', 'ffmpeg-core\.wasm'/,
  '必须同时复制 FFmpeg JS 与 WASM 文件');

const pkg = JSON.parse(packageJson);
assert.ok(pkg.dependencies?.['@ffmpeg/core'],
  'FFmpeg Core 必须作为锁定版本的项目依赖安装，而不是运行时远程拉取');

for (const forbidden of [
  'https://unpkg.com/',
  'https://cdn.jsdelivr.net/',
  'https://cdnjs.cloudflare.com/',
  'https://fonts.googleapis.com/'
]) {
  assert.ok(!worker.includes(forbidden), `FFmpeg 导出模块不得引用境外 CDN：${forbidden}`);
}

console.log('中国大陆资源依赖检查通过：FFmpeg JS/WASM 从本站加载，构建时自托管，不回退境外 CDN。');
