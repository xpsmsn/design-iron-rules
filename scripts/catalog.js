#!/usr/bin/env node
/**
 * catalog.js — 设计铁律 · 数据目录检索
 *
 * 本脚本只做检索与校验，不生成设计决策。
 * 决策仍由 SKILL.md 的六步流程与 L0 铁律负责。
 *
 * 用法：
 *   node scripts/catalog.js style    "科技感"     按关键词/别名/族检索 25 式风格属性
 *   node scripts/catalog.js palette  "校园"       取成套配色（含已实测的 on-* 配对）
 *   node scripts/catalog.js motion   "悬停"       取动效预设（强度分级 + Do/Don't）
 *   node scripts/catalog.js ux       "焦点"       取 UX 规则（带严重度 + 正反例）
 *   node scripts/catalog.js list                 列出全部条目的标题
 *   node scripts/catalog.js verify               校验配色目录中全部 on-* 配对的对比度
 *
 * 无参数时打印用法。
 * 纯 Node.js 内置模块，无第三方依赖，Windows / macOS / Linux 通用。
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/* ---------------- CSV 解析（支持引号包裹的逗号与转义引号） ---------------- */
function parseCsv(path) {
  const text = readFileSync(path, 'utf-8').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') { inQuotes = true; continue; }
    if (ch === ',') { row.push(field); field = ''; continue; }
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    if (ch === '\r') continue;
    field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift();
  return rows
    .filter((r) => r.some((c) => c.trim()))
    .map((r) => Object.fromEntries(header.map((h, idx) => [h.trim(), (r[idx] ?? '').trim()])));
}

function load(name) {
  const path = join(ROOT, 'data', name);
  if (!existsSync(path)) {
    console.error(`[FAIL] 数据文件不存在：${path}`);
    process.exit(2);
  }
  return parseCsv(path);
}

/* ---------------- WCAG 对比度（与 contrast.js 同源算法） ---------------- */
function parseHex(input) {
  const hex = String(input).replace(/^#/, '');
  if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(hex)) return null;
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  return { r: parseInt(full.slice(0, 2), 16), g: parseInt(full.slice(2, 4), 16), b: parseInt(full.slice(4, 6), 16) };
}
function luminance({ r, g, b }) {
  const chan = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
}
function ratio(a, b) {
  const l1 = luminance(a), l2 = luminance(b);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/* ---------------- 输出助手 ---------------- */
const line = (c = '─') => c.repeat(72);
function hit(text, query) {
  if (!query) return text || '';
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text || '';
  return `${text.slice(0, idx)}【${text.slice(idx, idx + query.length)}】${text.slice(idx + query.length)}`;
}
function scoreOf(rec, query, fields) {
  if (!query) return 1;
  const q = query.toLowerCase();
  let score = 0;
  for (const f of fields) {
    const v = String(rec[f] ?? '').toLowerCase();
    if (!v) continue;
    if (v === q) score += 10;
    else if (v.includes(q)) score += 5;
    if (f === 'style_name' || f === 'product_type' || f === 'issue' || f === 'category') {
      if (String(rec[f]).toLowerCase().startsWith(q)) score += 3;
    }
  }
  return score;
}

const RULES = {
  style() {
    const rows = load('style-attributes.csv');
    const q = process.argv[3] || '';
    const f = ['style_name', 'style_id', 'keywords', 'aliases', 'family', 'best_for'];
    const matched = rows
      .map((r) => ({ r, s: scoreOf(r, q, f) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s);
    const out = matched.length ? matched.map((x) => x.r) : rows;
    console.log(line());
    console.log(`风格属性 · 共 ${rows.length} 式，命中 ${out.length} 式  ${q ? `查询="${q}"` : ''}`);
    console.log(line());
    for (const r of out) {
      console.log(`\n■ ${hit(r.style_name, q)}  [${r.style_id}]  族 ${r.family}`);
      console.log(`  关键词   : ${hit(r.keywords, q)}`);
      console.log(`  别名     : ${r.aliases}`);
      console.log(`  适用     : ${r.best_for}`);
      console.log(`  【禁用】 : ${hit(r.do_not_use_for, q)}`);
      console.log(`  暗色 ${r.dark_mode} | 移动 ${r.mobile} | 复杂度 ${r.complexity}`);
      console.log(`  性能 ${r.perf_cost} (${r.perf_drivers})`);
      console.log(`  无障碍 ${r.a11y_risk} — ${hit(r.a11y_notes, q)}`);
      console.log(`  适配     : ${r.framework_fit}`);
    }
    console.log('');
  },

  palette() {
    const rows = load('palette-presets.csv');
    const q = process.argv[3] || '';
    const out = rows.filter((r) => !q || JSON.stringify(r).toLowerCase().includes(q.toLowerCase()));
    console.log(line());
    console.log(`配色预设 · 共 ${rows.length} 套，命中 ${out.length} 套  ${q ? `查询="${q}"` : ''}`);
    console.log(`所有 on-* 配对均已通过 scripts/contrast.js 实测；改色后请重跑 catalog.js verify`);
    console.log(line());
    for (const r of out) {
      console.log(`\n■ ${hit(r.product_type, q)}`);
      console.log(`  主色 ${r.primary} / 反色 ${r.on_primary}   强调 ${r.accent} / 反色 ${r.on_accent}`);
      console.log(`  次色 ${r.secondary} / 反色 ${r.on_secondary}   危险 ${r.destructive} / 反色 ${r.on_destructive}`);
      console.log(`  背景 ${r.background}   文字 ${r.foreground}   卡片 ${r.card}/${r.card_fg}`);
      console.log(`  弱化 ${r.muted}/${r.muted_fg}   分割线 ${r.border}   功能边框 ${r.border_strong}   焦点环 ${r.ring}`);
      console.log(`  说明 : ${r.notes}`);
    }
    console.log('');
  },

  motion() {
    const rows = load('motion-presets.csv');
    const q = process.argv[3] || '';
    const f = ['preset_id', 'category', 'trigger', 'do', 'dont'];
    const matched = rows.map((r) => ({ r, s: scoreOf(r, q, f) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
    const out = matched.length ? matched.map((x) => x.r) : rows;
    console.log(line());
    console.log(`动效预设 · 共 ${rows.length} 条，命中 ${out.length} 条  ${q ? `查询="${q}"` : ''}`);
    console.log(line());
    for (const r of out) {
      console.log(`\n■ ${hit(r.preset_id, q)}  [${r.category} / 强度 ${r.intensity}]`);
      console.log(`  触发 ${r.trigger} | 时长 ${r.duration} | 缓动 ${r.easing}`);
      console.log(`  宜 : ${hit(r.do, q)}`);
      console.log(`  忌 : ${hit(r.dont, q)}`);
      console.log(`  降级: ${r.reduced_motion_fallback}`);
    }
    console.log('');
  },

  ux() {
    const rows = load('ux-rules.csv');
    const q = process.argv[3] || '';
    const f = ['issue', 'category', 'do', 'dont', 'platform'];
    const matched = rows.map((r) => ({ r, s: scoreOf(r, q, f) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
    const out = matched.length ? matched.map((x) => x.r) : rows;
    const order = { High: 0, Medium: 1, Low: 2 };
    out.sort((a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3));
    console.log(line());
    console.log(`UX 规则 · 共 ${rows.length} 条，命中 ${out.length} 条  ${q ? `查询="${q}"` : ''}（按严重度排序）`);
    console.log(line());
    for (const r of out) {
      console.log(`\n[${r.severity}] ${r.rule_id} ${hit(r.issue, q)}  (${r.category} · ${r.platform})`);
      console.log(`  宜 : ${hit(r.do, q)}`);
      console.log(`  忌 : ${hit(r.dont, q)}`);
      console.log(`  ✓  ${r.good_example}`);
      console.log(`  ✗  ${r.bad_example}`);
    }
    console.log('');
  },

  list() {
    for (const [file, title, key] of [
      ['style-attributes.csv', '风格', 'style_name'],
      ['palette-presets.csv', '配色', 'product_type'],
      ['motion-presets.csv', '动效', 'preset_id'],
      ['ux-rules.csv', 'UX 规则', 'rule_id'],
    ]) {
      const rows = load(file);
      console.log(`\n${title} (${rows.length})`);
      console.log('  ' + rows.map((r) => r[key]).join(' / '));
    }
    console.log('');
  },

  /** 校验配色目录中每一个 on_X 与 X 的对比度 */
  verify() {
    const rows = load('palette-presets.csv');
    const pairs = [];
    for (const r of rows) {
      const fields = Object.keys(r).filter((k) => k.startsWith('on_'));
      for (const onKey of fields) {
        const baseKey = onKey.slice(3);
        if (!r[baseKey]) continue;
        pairs.push({
          product: r.product_type,
          label: `${onKey} / ${baseKey}`,
          fg: r[onKey],
          bg: r[baseKey],
        });
      }
    }
    let failed = 0;
    console.log(line());
    console.log(`配色目录校验 · ${rows.length} 套 × 反色配对 = ${pairs.length} 组`);
    console.log(line());
    for (const p of pairs) {
      const fg = parseHex(p.fg), bg = parseHex(p.bg);
      if (!fg || !bg) {
        console.log(`[FAIL] ${p.product} ${p.label} 色值格式错误 ${p.fg}/${p.bg}`);
        failed++;
        continue;
      }
      const v = ratio(fg, bg);
      const ok = v >= 4.5;
      if (!ok) failed++;
      console.log(`[${ok ? 'OK  ' : 'FAIL'}] ${p.product.padEnd(14)} ${p.label.padEnd(22)} ${v.toFixed(2).padStart(6)}:1`);
    }
    console.log('');
    console.log(`合计 ${pairs.length} 组，未达标 ${failed} 组。`);
    if (failed) {
      console.log('修法：加深 on_* 或加深其底色，不要下调 4.5:1 阈值。');
      process.exit(1);
    }
    console.log('全部通过。');
    process.exit(0);
  },
};

/* ---------------- 入口 ---------------- */
const cmd = process.argv[2];
if (!cmd || !RULES[cmd]) {
  console.log(`
${line()}
catalog.js — 设计铁律数据目录
${line()}
  node scripts/catalog.js style    "科技感"    按关键词/别名检索风格属性
  node scripts/catalog.js palette  "校园"      取成套配色（含实测反色配对）
  node scripts/catalog.js motion   "悬停"      取动效预设
  node scripts/catalog.js ux       "焦点"      取 UX 规则（按严重度排序）
  node scripts/catalog.js list                列出全部条目
  node scripts/catalog.js verify              校验配色目录全部对比度
${line()}
`);
  process.exit(2);
}
RULES[cmd]();
