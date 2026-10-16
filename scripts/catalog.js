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
 *   node scripts/catalog.js typography "科技"      取字体搭配（含中文 CJK 字体栈）
 *   node scripts/catalog.js chart    "趋势"       取图表选型（何时用/何时别用）
 *   node scripts/catalog.js icon     "新中式"     取图标系统选型（图标库 + 线宽 + 尺寸）
 *   node scripts/catalog.js list                 列出全部条目的标题
 *   node scripts/catalog.js verify               校验配色对比度 + 全部目录的结构完整性
 *
 * 无参数时打印用法。
 * 纯 Node.js 内置模块，无第三方依赖，Windows / macOS / Linux 通用。
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/* ---------------- CSV 解析（支持引号包裹的逗号与转义引号） ---------------- */

/**
 * 最近一次 parseCsv 中「字段数与表头不一致」的行。
 * CSV 最常见的翻车是字段值里的逗号忘了加引号，导致整行错位——
 * 这类错位不会报错，只会静默地把列读串，因此必须显式检查。
 * 每次 parseCsv 都会重置，调用方需在 load() 之后立即读取。
 */
const widthErrors = [];

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
  const data = rows.filter((r) => r.some((c) => c.trim()));
  widthErrors.length = 0;
  for (const r of data) {
    if (r.length !== header.length) {
      widthErrors.push(`「${r[0] || '(无主键)'}」解析出 ${r.length} 个字段，表头是 ${header.length} 个——字段值里的逗号可能没加引号`);
    }
  }
  return data.map((r) => Object.fromEntries(header.map((h, idx) => [h.trim(), (r[idx] ?? '').trim()])));
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

/** 从 CSS font-family 栈里取出首个字体名，用于紧凑展示 */
function firstFont(stack) {
  const s = String(stack || '').trim();
  if (!s) return '-';
  return s.split(',')[0].replace(/^["']|["']$/g, '').trim() || s;
}
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

/**
 * 把口语查询解析成 style-attributes.csv 里的 style_id 集合。
 * 有了它，查「新中式」也能命中 style_id=oriental-minimal 的行——
 * 否则用户必须知道内部英文 id 才能查到东西。
 */
function resolveStyleIds(query) {
  const ids = new Set();
  if (!query) return ids;
  const q = query.toLowerCase();
  for (const r of load('style-attributes.csv')) {
    const hay = [r.style_id, r.style_name, r.family, r.keywords, r.aliases].join(' ').toLowerCase();
    if (hay.includes(q)) ids.add(r.style_id);
  }
  return ids;
}

/** 检索模板：关键词打分 + 跨表 style_id 命中加成 */
function search(rows, query, fields) {
  const styleHits = resolveStyleIds(query);
  const matched = rows
    .map((r) => {
      let s = scoreOf(r, query, fields);
      if (r.style_id && styleHits.has(r.style_id)) s += 6;
      return { r, s };
    })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);
  return matched.length ? matched.map((x) => x.r) : rows;
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

  typography() {
    const rows = load('typography-pairs.csv');
    const q = process.argv[3] || '';
    const f = ['pair_name', 'pair_id', 'keywords', 'best_for', 'style_id'];
    const out = search(rows, q, f);
    console.log(line());
    console.log(`字体搭配 · 共 ${rows.length} 组，命中 ${out.length} 组  ${q ? `查询="${q}"` : ''}`);
    console.log(`中文界面必须显式声明 cjk_stack；西文字体不含汉字，靠 font fallback 会导致字重不匀`);
    console.log(line());
    for (const r of out) {
      console.log(`\n■ ${hit(r.pair_name, q)}  [${r.pair_id}]${r.style_id !== '-' ? `  风格 ${r.style_id}` : '  跨风格'}`);
      console.log(`  标题   : ${firstFont(r.heading_font)}    正文: ${firstFont(r.body_font)}    等宽: ${firstFont(r.mono_font)}`);
      console.log(`  中文   : ${firstFont(r.cjk_stack)}`);
      console.log(`  字重   : ${r.weights}`);
      console.log(`  适用   : ${hit(r.best_for, q)}`);
      console.log(`  【禁用】: ${hit(r.do_not_use_for, q)}`);
      console.log(`  注意   : ${r.notes}`);
    }
    console.log('');
  },

  chart() {
    const rows = load('chart-types.csv');
    const q = process.argv[3] || '';
    const f = ['chart_id', 'data_type', 'keywords', 'best_chart', 'when_to_use'];
    const out = search(rows, q, f);
    console.log(line());
    console.log(`图表选型 · 共 ${rows.length} 类，命中 ${out.length} 类  ${q ? `查询="${q}"` : ''}`);
    console.log(`铁律 1：颜色不得作为唯一信息载体 —— 每类都必须配直接标注或数据标签`);
    console.log(line());
    for (const r of out) {
      console.log(`\n■ ${hit(r.data_type, q)}  [${r.chart_id}] → 首选 ${hit(r.best_chart, q)}`);
      console.log(`  备选   : ${r.secondary_options}`);
      console.log(`  宜     : ${hit(r.when_to_use, q)}`);
      console.log(`  【忌】 : ${hit(r.when_not_to_use, q)}`);
      console.log(`  量级   : ${r.volume_threshold}`);
      console.log(`  配色   : ${r.color_rule}`);
      console.log(`  渲染   : ${r.render_note}`);
      console.log(`  无障碍 : ${r.a11y_fallback}`);
    }
    console.log('');
  },

  icon() {
    const rows = load('icon-guidance.csv');
    const q = process.argv[3] || '';
    const f = ['icon_id', 'scope', 'library', 'best_for', 'style_id'];
    const out = search(rows, q, f);
    console.log(line());
    console.log(`图标选型 · 共 ${rows.length} 组，命中 ${out.length} 组  ${q ? `查询="${q}"` : ''}`);
    console.log(`L1 铁律：线宽全局二选一（1.5px / 2px）不得混用；图标不单独承载语义，须配文字或 aria-label`);
    console.log(line());
    for (const r of out) {
      console.log(`\n■ ${hit(r.scope, q)}  [${r.icon_id}]${r.style_id !== '-' ? `  风格 ${r.style_id}` : '  通用'}`);
      console.log(`  图标库 : ${hit(r.library, q)}`);
      console.log(`  线宽   : ${r.stroke_weight}    风格: ${r.fill_style}`);
      console.log(`  尺寸   : ${r.size_rule}`);
      console.log(`  宜     : ${hit(r.best_for, q)}`);
      console.log(`  【忌】 : ${hit(r.do_not_use_for, q)}`);
      console.log(`  无障碍 : ${r.a11y_rule}`);
    }
    console.log('');
  },

  list() {
    for (const [file, title, key] of [
      ['style-attributes.csv', '风格', 'style_name'],
      ['palette-presets.csv', '配色', 'product_type'],
      ['motion-presets.csv', '动效', 'preset_id'],
      ['ux-rules.csv', 'UX 规则', 'rule_id'],
      ['typography-pairs.csv', '字体搭配', 'pair_name'],
      ['chart-types.csv', '图表', 'data_type'],
      ['icon-guidance.csv', '图标', 'scope'],
    ]) {
      const rows = load(file);
      console.log(`\n${title} (${rows.length})`);
      console.log('  ' + rows.map((r) => r[key]).join(' / '));
    }
    console.log('');
  },

  /**
   * 两类校验：
   *   1. 配色目录每一个 on_X 与 X 的 WCAG 对比度
   *   2. 全部目录的结构完整性 —— 跨表 style_id 引用、主键唯一、必填字段非空
   * 任一失败返回非零退出码，可直接接 CI。
   */
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
    console.log(`[1/2] 配色目录校验 · ${rows.length} 套 × 反色配对 = ${pairs.length} 组`);
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
    if (failed) console.log('修法：加深 on_* 或加深其底色，不要下调 4.5:1 阈值。');

    /* ---- 结构完整性：跨表引用与主键 ---- */
    const CATALOGS = [
      ['style-attributes.csv', 'style_id', []],
      ['palette-presets.csv', 'product_type', []],
      ['motion-presets.csv', 'preset_id', []],
      ['ux-rules.csv', 'rule_id', []],
      ['typography-pairs.csv', 'pair_id', ['style_id', 'cjk_stack', 'weights']],
      ['chart-types.csv', 'chart_id', ['best_chart', 'when_not_to_use']],
      ['icon-guidance.csv', 'icon_id', ['style_id', 'library', 'a11y_rule']],
    ];
    const styleIds = new Set(load('style-attributes.csv').map((r) => r.style_id));
    let lintFail = 0;
    console.log(line());
    console.log('[2/2] 目录结构校验 · 跨表引用 / 主键唯一 / 必填非空');
    console.log(line());
    for (const [file, pk, required] of CATALOGS) {
      const recs = load(file);
      const problems = [...widthErrors];
      const seen = new Set();
      for (const r of recs) {
        const id = r[pk];
        if (!id) problems.push(`存在无 ${pk} 的行`);
        else if (seen.has(id)) problems.push(`${pk} 重复: ${id}`);
        seen.add(id);
        for (const f of required) {
          if (!String(r[f] ?? '').trim()) problems.push(`${id} 的 ${f} 为空`);
        }
        const ref = r.style_id;
        if (ref && ref !== '-' && file !== 'style-attributes.csv' && !styleIds.has(ref)) {
          problems.push(`${id} 引用了不存在的 style_id: ${ref}`);
        }
      }
      const tag = problems.length ? 'FAIL' : 'OK  ';
      if (problems.length) lintFail++;
      console.log(`[${tag}] ${file.padEnd(24)} ${String(recs.length).padStart(3)} 行`);
      for (const p of [...new Set(problems)]) console.log(`         - ${p}`);
    }
    console.log('');
    if (lintFail) {
      console.log(`${lintFail} 个目录存在结构问题。修法：补齐空字段，或把 style_id 改成 style-attributes.csv 中真实存在的值（或填 - 表示跨风格）。`);
    } else {
      console.log('全部目录结构完整，跨表引用全部命中。');
    }

    if (failed || lintFail) process.exit(1);
    console.log('');
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
  node scripts/catalog.js style       "科技感"    按关键词/别名检索风格属性
  node scripts/catalog.js palette     "校园"      取成套配色（含实测反色配对）
  node scripts/catalog.js motion      "悬停"      取动效预设
  node scripts/catalog.js ux          "焦点"      取 UX 规则（按严重度排序）
  node scripts/catalog.js typography  "科技"      取字体搭配（含中文 CJK 字体栈）
  node scripts/catalog.js chart       "趋势"      取图表选型（何时用/何时别用）
  node scripts/catalog.js icon        "新中式"    取图标系统选型（图标库/线宽/尺寸）
  node scripts/catalog.js list                   列出全部条目
  node scripts/catalog.js verify                 校验配色对比度 + 目录结构完整性（可接 CI）
${line()}
`);
  process.exit(2);
}
RULES[cmd]();
