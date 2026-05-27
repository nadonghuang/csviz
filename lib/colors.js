// lib/colors.js — 零依赖 ANSI 颜色工具
// 支持 16 色 + 256 色梯度 + 样式

'use strict';

const C = {
  reset: '\x1b[0m',

  // 基础色
  black:   '\x1b[30m',
  red:     '\x1b[31m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  blue:    '\x1b[34m',
  magenta: '\x1b[35m',
  cyan:    '\x1b[36m',
  white:   '\x1b[37m',

  // 亮色
  brightBlack:   '\x1b[90m',
  brightRed:     '\x1b[91m',
  brightGreen:   '\x1b[92m',
  brightYellow:  '\x1b[93m',
  brightBlue:    '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan:    '\x1b[96m',
  brightWhite:   '\x1b[97m',

  // 样式
  bold:      '\x1b[1m',
  dim:       '\x1b[2m',
  italic:    '\x1b[3m',
  underline: '\x1b[4m',

  // 背景
  bgBlack:   '\x1b[40m',
  bgRed:     '\x1b[41m',
  bgGreen:   '\x1b[42m',
  bgYellow:  '\x1b[43m',
  bgBlue:    '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan:    '\x1b[46m',
  bgWhite:   '\x1b[47m',
};

// 图表配色方案 — 精心挑选的 16 色渐变
const PALETTE = {
  reset: C.reset,
  bars: [
    C.brightCyan,
    C.cyan,
    C.brightBlue,
    C.brightGreen,
    C.green,
    C.brightYellow,
    C.yellow,
    C.brightMagenta,
    C.magenta,
    C.brightRed,
  ],
  line: C.brightCyan,
  lineFill: C.cyan,
  label: C.white,
  value: C.brightYellow,
  header: C.brightWhite,
  dim: C.brightBlack,
  accent: C.brightMagenta,
  success: C.brightGreen,
  title: C.brightBlue,
  grid: C.dim,
};

/**
 * 获取 256 色梯度中的颜色
 * 从 0-255 映射到蓝→青→绿→黄→红的渐变
 */
function heatColor(value, min = 0, max = 1) {
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  // 蓝(21) → 青(51) → 绿(46) → 黄(226) → 红(196)
  let r, g, b;
  if (t < 0.25) {
    const s = t / 0.25;
    r = 0; g = Math.round(s * 200); b = 255;
  } else if (t < 0.5) {
    const s = (t - 0.25) / 0.25;
    r = 0; g = 200 + Math.round(s * 55); b = Math.round(255 * (1 - s));
  } else if (t < 0.75) {
    const s = (t - 0.5) / 0.25;
    r = Math.round(s * 255); g = 255; b = 0;
  } else {
    const s = (t - 0.75) / 0.25;
    r = 255; g = Math.round(255 * (1 - s)); b = 0;
  }
  // 找最接近的 256 色
  const idx = 16 + 36 * Math.round(r / 255 * 5) + 6 * Math.round(g / 255 * 5) + Math.round(b / 255 * 5);
  return `\x1b[38;5;${idx}m`;
}

/**
 * 简单的颜色包裹函数
 */
function colorize(text, color) {
  return `${color}${text}${C.reset}`;
}

/**
 * 带样式的包裹
 */
function bold(text) { return colorize(text, C.bold); }
function dim(text) { return colorize(text, C.dim); }
function red(text) { return colorize(text, C.red); }
function green(text) { return colorize(text, C.green); }
function yellow(text) { return colorize(text, C.yellow); }
function blue(text) { return colorize(text, C.blue); }
function cyan(text) { return colorize(text, C.cyan); }
function magenta(text) { return colorize(text, C.magenta); }
function brightCyan(text) { return colorize(text, C.brightCyan); }
function brightYellow(text) { return colorize(text, C.brightYellow); }
function brightMagenta(text) { return colorize(text, C.brightMagenta); }

module.exports = {
  C, PALETTE, heatColor, colorize,
  bold, dim, red, green, yellow, blue, cyan, magenta,
  brightCyan, brightYellow, brightMagenta,
};
