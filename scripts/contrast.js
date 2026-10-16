#!/usr/bin/env node
/**
 * contrast.js — WCAG 对比度校验（设计铁律 · 铁律 1）
 *
 * 手算 WCAG 相对亮度公式极易出错，且需要逐项检查十余组配色。
 * 本脚本用于确定性地完成这项检查。
 *
 * 用法：
 *   node scripts/contrast.js "#111827" "#F7F8FA" [字号px] [字重]
 *   node scripts/contrast.js --batch pairs.txt
 *
 * 字号/字重可选，用于自动判定阈值：
 *   ≥ 24px，或 ≥ 18.66px 且字重 ≥ 700 → 阈值 3:1（大字号）
 *   否则 → 阈值 4.5:1（正文）
 *
 * pairs.txt 每行一条，支持逗号分隔：
 *   #111827,#F7F8FA,列表页正文
 *   #FFFFFF,#3B82F6,16
 * 以 # 或 // 开头的行视为注释，空行跳过。
 *
 * 跨平台：纯 Node.js 内置模块，无依赖。Windows / macOS / Linux 通用。
 */

import { readFileSync } from 'node:fs';

function parseHex(input) {
  const hex = String(input).trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(hex)) return null;
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

/** WCAG 2.x 相对亮度 */
function luminance({ r, g, b }) {
  const chan = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
}

function ratio(fg, bg) {
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

function threshold(sizePx, weight) {
  const isLarge = sizePx >= 24 || (sizePx >= 18.66 && Number(weight) >= 700);
  return isLarge ? 3 : 4.5;
}

function judge(value, sizePx, weight) {
  const need = threshold(sizePx, weight);
  const pass = value >= need;
  const kind = need === 3 ? '大字/组件 (3:1)' : '正文 (4.5:1)';
  // 铁律 2：图标、边框、图形等非文本元素按 3:1 判定
  const passAsComponent = value >= 3;
  return { need, pass, kind, passAsComponent };
}

function report(fgHex, bgHex, sizePx, weight, label) {
  const fg = parseHex(fgHex);
  const bg = parseHex(bgHex);
  if (!fg || !bg) {
    console.error(`[FAIL] 颜色格式无法解析：${fgHex} / ${bgHex}`);
    return null;
  }
  const value = ratio(fg, bg);
  const j = judge(value, sizePx, weight);
  const mark = j.pass ? 'OK  ' : 'FAIL';
  const name = label ? `  ${label}` : '';
  console.log(
    `[${mark}] ${value.toFixed(2).padStart(6)}:1  (需 ≥ ${j.need})  ` +
    `${fgHex} → ${bgHex}${sizePx ? `  ${sizePx}px/${weight || 400}` : ''}${name}`
  );
  if (!j.pass) {
    console.log(`       └─ 未达 ${j.kind} 阈值` +
      (value >= 3 ? `（已达 3:1，非文本元素可用）` : `（连 3:1 组件阈值也未达到，必须调整）`));
  }
  return { value, ...j, label };
}

const argv = process.argv.slice(2);

/**
 * 注释判定：// 开头，或 # 开头但不是合法色值。
 * 注意：色值本身也以 # 开头，不能简单用 startsWith('#') 判注释。
 */
function isComment(line) {
  if (line.startsWith('//')) return true;
  if (line.startsWith('#') && !/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?\s*(,|$)/.test(line)) return true;
  return false;
}

if (argv[0] === '--batch') {
  const file = argv[1];
  if (!file) {
    console.error('用法：node scripts/contrast.js --batch pairs.txt');
    process.exit(2);
  }
  const lines = readFileSync(file, 'utf-8').replace(/^\uFEFF/, '').split(/\r?\n/);
  const results = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || isComment(line)) continue;
    const [fg, bg, label] = line.split(',').map((s) => s.trim());
    const r = report(fg, bg, 16, 400, label);
    if (r) results.push(r);
  }
  if (results.length === 0) {
    console.error('未读到任何有效配对。检查文件格式：每行应为 前景色,背景色,[标签]');
    process.exit(2);
  }
  const failed = results.filter((r) => !r.pass);
  console.log('');
  console.log(`合计 ${results.length} 项，未达标 ${failed.length} 项。`);
  if (failed.length) {
    console.log('未达标项必须先修：改色值或改背景，不能下调阈值。');
    process.exit(1);
  }
  process.exit(0);
}

if (argv.length < 2) {
  console.log('用法：');
  console.log('  node scripts/contrast.js "#111827" "#F7F8FA" [字号px] [字重]');
  console.log('  node scripts/contrast.js --batch pairs.txt');
  console.log('');
  console.log('pairs.txt 每行：前景色,背景色,[标签或字号]');
  process.exit(2);
}

const [fgHex, bgHex, sizeArg, weightArg] = argv;
const sizePx = sizeArg ? Number(sizeArg) : 16;
const weight = weightArg || 400;
const r = report(fgHex, bgHex, sizePx, weight);
process.exit(r && r.pass ? 0 : 1);