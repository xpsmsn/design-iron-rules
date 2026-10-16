#!/usr/bin/env node
/**
 * shoot.js — 批量把 demos/*.html 渲染成 assets/previews/*.png
 *
 * 用系统已安装的 Edge/Chrome headless，无需任何 npm 依赖。
 * 纯 Node 内置模块实现，与 catalog.js / contrast.js 保持同一技术栈。
 *
 * 用法：
 *   node scripts/shoot.js              # 全量重出图
 *   node scripts/shoot.js 01 07 13     # 只重出指定编号（补前缀匹配）
 *
 * 退出码：有渲染失败返回 1，可直接接 CI。
 */

'use strict';

const os = require('os');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const DEMOS = path.join(ROOT, 'demos');
const OUT = path.join(ROOT, 'assets', 'previews');

const VIEWPORT = { w: 1440, h: 900, scale: 2 };

// 独立 profile 目录：并发跑 Edge 时默认 profile 会被占用，
// 导致渲染静默失败（无报错但不出图）。必须隔离。
const PROFILE = path.join(os.tmpdir(), 'design-iron-rules-shoot');

// 浏览器候选路径（Windows 优先，再退到 macOS/Linux）
const BROWSERS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/microsoft-edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
];

function findBrowser() {
  for (const p of BROWSERS) {
    if (fs.existsSync(p)) return p;
  }
  // 退到 PATH
  return process.platform === 'win32' ? 'msedge' : 'google-chrome';
}

/** 从 HTML 里抠出 <title>，用于输出日志 */
function titleOf(file) {
  try {
    const html = fs.readFileSync(file, 'utf8');
    const m = html.match(/<title>([^<]*)<\/title>/i);
    return m ? m[1].trim() : '(无 title)';
  } catch {
    return '(读取失败)';
  }
}

function main() {
  const filters = process.argv.slice(2);

  if (!fs.existsSync(DEMOS)) {
    console.error(`✗ 找不到 demos 目录：${DEMOS}`);
    process.exit(1);
  }
  fs.mkdirSync(OUT, { recursive: true });

  const files = fs
    .readdirSync(DEMOS)
    .filter((f) => f.endsWith('.html'))
    .sort();

  const targets = filters.length
    ? files.filter((f) => filters.some((k) => f.startsWith(k)))
    : files;

  if (targets.length === 0) {
    console.error('✗ 没有匹配到任何 demo 文件');
    process.exit(1);
  }

  const browser = findBrowser();
  fs.mkdirSync(PROFILE, { recursive: true });
  console.log(`渲染器：${browser}`);
  console.log(`视口　：${VIEWPORT.w}×${VIEWPORT.h} @${VIEWPORT.scale}x`);
  console.log(`目标　：${targets.length} 个页面\n`);

  const failed = [];

  for (const f of targets) {
    const src = path.join(DEMOS, f);
    const slug = f.replace(/\.html$/, '');
    const dest = path.join(OUT, `${slug}.png`);

    // 清掉旧图，避免渲染失败时把上一版当成新图
    if (fs.existsSync(dest)) fs.unlinkSync(dest);

    const args = [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      `--user-data-dir=${PROFILE}`,
      `--force-device-scale-factor=${VIEWPORT.scale}`,
      `--window-size=${VIEWPORT.w},${VIEWPORT.h}`,
      `--screenshot=${dest}`,
      pathToFileURL(src).href,
    ];

    let ok = false;
    try {
      // Edge 在非交互环境会往 stderr 吐一堆环境噪音，一律忽略，
      // 只看是否真的产出了 PNG。
      execFileSync(browser, args, { stdio: 'ignore', timeout: 60000 });
      ok = fs.existsSync(dest) && fs.statSync(dest).size > 0;
    } catch (e) {
      ok = false;
    }

    if (ok) {
      const kb = (fs.statSync(dest).size / 1024).toFixed(1);
      console.log(`  ✓  ${slug.padEnd(24)} ${kb.padStart(7)} KB   ${titleOf(src)}`);
    } else {
      console.log(`  ✗  ${slug.padEnd(24)} 渲染失败`);
      failed.push(slug);
    }
  }

  console.log('');
  if (failed.length) {
    console.log(`合计 ${targets.length} 个，失败 ${failed.length} 个：`);
    failed.forEach((s) => console.log(`    ${s}`));
    process.exit(1);
  }
  console.log(`合计 ${targets.length} 个，全部通过。`);
}

main();
