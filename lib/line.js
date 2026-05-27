// lib/line.js — Braille 字符折线图渲染器（零依赖）
// 使用 Unicode Braille 实现高分辨率终端折线图

'use strict';

const { PALETTE, colorize, bold, dim, brightYellow, brightCyan, brightMagenta } = require('./colors');
const CSVParser = require('./parser');
const { niceScale, formatTick } = require('./stats');

// Braille 点位映射（2列×4行的每个点位对应的 bit 偏移）
// 列0: 行0→bit0, 行1→bit1, 行2→bit2, 行3→bit6
// 列1: 行0→bit3, 行1→bit4, 行2→bit5, 行3→bit7
const BRAILLE_MAP = [
  [0, 3],  // 行 0: 列0→bit0, 列1→bit3
  [1, 4],  // 行 1: 列1→bit1, 列1→bit4
  [2, 5],  // 行 2: 列0→bit2, 列1→bit5
  [6, 7],  // 行 3: 列0→bit6, 列1→bit7
];
const BRAILLE_BASE = 0x2800;

/**
 * 渲染折线图
 * @param {object} data - { headers, rows, numericColumns }
 * @param {object} opts
 *   - xColumn: X轴列
 *   - yColumns: Y轴列（可多列，多线）
 *   - height: 图表高度（行数，默认自动）
 *   - width: 图表宽度（字符数，默认自动）
 *   - title: 标题
 *   - showDots: 在数据点处显示标记
 */
function renderLine(data, opts = {}) {
  const { headers, rows, numericColumns } = data;
  const terminalWidth = process.stdout.columns || 80;

  // 确定 X 轴列（标签）
  const numColSet = new Set(numericColumns.map(nc => nc.index));
  let xColIndex = -1;

  if (opts.xColumn != null) {
    xColIndex = typeof opts.xColumn === 'string'
      ? headers.indexOf(opts.xColumn) : opts.xColumn;
  } else {
    for (let i = 0; i < headers.length; i++) {
      if (!numColSet.has(i)) { xColIndex = i; break; }
    }
    if (xColIndex === -1 && numericColumns.length > 1) {
      // 全是数字列 — 用第一列做 X
      xColIndex = numericColumns[0].index;
    }
  }

  // 确定 Y 轴列
  let yCols;
  if (opts.yColumns) {
    const cols = Array.isArray(opts.yColumns) ? opts.yColumns : [opts.yColumns];
    yCols = cols.map(c =>
      typeof c === 'string' ? { index: headers.indexOf(c), name: c }
        : { index: c, name: headers[c] || `Col ${c}` }
    ).filter(c => c.index >= 0);
  } else {
    yCols = numericColumns
      .filter(nc => nc.index !== xColIndex)
      .map(nc => ({ index: nc.index, name: nc.name }));
  }

  if (yCols.length === 0) return dim('  (no numeric columns to plot)');

  // 提取数据点
  const points = rows
    .filter(r => r.length > Math.max(xColIndex, ...yCols.map(c => c.index)))
    .map(r => {
      const x = xColIndex >= 0 ? r[xColIndex] : '';
      const ys = yCols.map(c => CSVParser.toNumber(r[c.index]));
      return { x, ys };
    })
    .filter(p => p.ys.some(y => !isNaN(y)));

  if (points.length < 2) return dim('  (need at least 2 data points for a line chart)');

  // 计算尺寸
  const chartWidth = opts.width || Math.min(60, terminalWidth - 14);
  const chartHeight = opts.height || Math.min(20, Math.max(8, Math.floor(terminalWidth / 4)));
  const yScaleHeight = chartHeight * 4; // Braille 4x 纵向分辨率
  const xScaleWidth = chartWidth * 2;   // Braille 2x 横向分辨率

  // 为每条线计算 Y 轴范围
  const allYValues = points.flatMap(p => p.ys.filter(v => !isNaN(v)));
  const yMin = Math.min(...allYValues);
  const yMax = Math.max(...allYValues);
  const yRange = yMax - yMin || 1;
  const scale = niceScale(yMin, yMax);

  // 为每条线生成高分辨率点阵
  const seriesColors = [
    PALETTE.bars[0], // brightCyan
    PALETTE.bars[3], // brightGreen
    PALETTE.bars[5], // yellow
    PALETTE.bars[7], // magenta
    PALETTE.bars[8], // red
    PALETTE.bars[9], // brightRed
  ];

  const lineData = yCols.map((col, si) => {
    const color = seriesColors[si % seriesColors.length];
    // 插值到高分辨率网格
    const grid = new Set();

    for (let px = 0; px < xScaleWidth; px++) {
      const t = points.length > 1 ? (px / (xScaleWidth - 1)) * (points.length - 1) : 0;
      const idx = Math.min(Math.floor(t), points.length - 2);
      const frac = t - idx;
      const y0 = points[idx].ys[si];
      const y1 = points[Math.min(idx + 1, points.length - 1)].ys[si];

      if (isNaN(y0) && isNaN(y1)) continue;

      const yVal = isNaN(y0) ? y1 : isNaN(y1) ? y0 : y0 + frac * (y1 - y0);
      const py = Math.round((1 - (yVal - scale.min) / (scale.max - scale.min || 1)) * (yScaleHeight - 1));
      const clampedPy = Math.max(0, Math.min(yScaleHeight - 1, py));

      grid.add(`${px},${clampedPy}`);
    }

    return { col, color, grid };
  });

  // Y 轴刻度标签宽度
  const yLabelWidth = Math.max(...scale.ticks.map(t => formatTick(t).length), 5);

  // 构建 Braille 字符网格
  const gridWidth = Math.ceil(xScaleWidth / 2);
  const gridHeight = Math.ceil(yScaleHeight / 4);

  const lines = [];

  // 标题
  const titleText = opts.title || yCols.map(c => c.name).join(' vs ');
  lines.push('');
  lines.push(`  ${bold(brightCyan(titleText))}`);
  lines.push('');

  // 图例
  if (yCols.length > 1) {
    const legend = yCols.map((col, i) =>
      `${colorize('━━', lineData[i].color)} ${col.name}`
    ).join('   ');
    lines.push(`  ${legend}`);
    lines.push('');
  }

  // 渲染 Braille 网格
  for (let gy = 0; gy < gridHeight; gy++) {
    let row = '';
    let lineChars = '';

    // Y 轴标签
    const yVal = scale.max - (gy * 4 / yScaleHeight) * (scale.max - scale.min);
    const yLabel = formatTick(yVal).padStart(yLabelWidth);

    // 网格线标记
    const isGridLine = (gy * 4) % Math.round(yScaleHeight / (scale.ticks.length - 1 || 1)) < 4;

    for (let gx = 0; gx < gridWidth; gx++) {
      let brailleChar = BRAILLE_BASE;

      for (const series of lineData) {
        for (let dy = 0; dy < 4; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            const px = gx * 2 + dx;
            const py = gy * 4 + (3 - dy); // Braille 行是倒序的
            if (series.grid.has(`${px},${py}`)) {
              const bit = BRAILLE_MAP[dy][dx];
              brailleChar |= (1 << bit);
            }
          }
        }
      }

      if (brailleChar !== BRAILLE_BASE) {
        // 找到这个格子中哪个系列的颜色
        let dominantColor = PALETTE.line;
        for (const series of lineData) {
          for (let dy = 0; dy < 4; dy++) {
            for (let dx = 0; dx < 2; dx++) {
              const px = gx * 2 + dx;
              const py = gy * 4 + (3 - dy);
              if (series.grid.has(`${px},${py}`)) {
                dominantColor = series.color;
              }
            }
          }
        }
        lineChars += `${dominantColor}${String.fromCodePoint(brailleChar)}${PALETTE.reset}`;
      } else {
        // 空格子 — 网格线用点表示
        lineChars += dim(isGridLine ? '·' : ' ');
      }
    }

    row = `${dim(yLabel)} ${lineChars}`;
    lines.push(`  ${row}`);
  }

  // X 轴
  const xLine = dim('─'.repeat(yLabelWidth + 1)) + ' ' + dim('─'.repeat(gridWidth));
  lines.push(`  ${xLine}`);

  // X 轴标签 — 在底部均匀分布
  let xLabelLine = ' '.repeat(yLabelWidth + 1) + ' ';
  const step = Math.max(1, Math.floor(points.length / Math.min(points.length, 8)));
  for (let i = 0; i < points.length; i += step) {
    const x = Math.round((i / (points.length - 1)) * (gridWidth - 1));
    const label = String(points[i].x).slice(0, 8);
    const pad = x - xLabelLine.length + yLabelWidth + 2;
    if (pad >= 0) {
      xLabelLine += ' '.repeat(pad) + label;
    }
  }
  lines.push(`  ${dim(xLabelLine)}`);

  // 范围标注
  lines.push('');
  const rangeInfo = `${brightYellow(formatTick(scale.min))} → ${brightYellow(formatTick(scale.max))}`;
  const countInfo = `${points.length} data points`;
  lines.push(`  ${dim(`Range: ${rangeInfo}  ·  ${countInfo}  ·  ${yCols.length} series`)}`);

  lines.push('');
  return lines.join('\n');
}

/**
 * 渲染迷你 Sparkline（单行）
 */
function renderSparkline(values, opts = {}) {
  const width = opts.width || 40;
  const color = opts.color || PALETTE.line;
  const validValues = values.filter(v => !isNaN(v));
  if (validValues.length < 2) return dim('·'.repeat(width));

  const vMin = Math.min(...validValues);
  const vMax = Math.max(...validValues);
  const range = vMax - vMin || 1;
  const yScale = 4; // 单行 Braille = 4px 高

  let result = color;
  for (let col = 0; col < width; col++) {
    let brailleChar = BRAILLE_BASE;
    for (let dx = 0; dx < 2; dx++) {
      const px = col * 2 + dx;
      const t = (px / (width * 2 - 1)) * (validValues.length - 1);
      const idx = Math.min(Math.floor(t), validValues.length - 2);
      const frac = t - idx;
      const val = validValues[idx] + frac * (validValues[idx + 1] - validValues[idx]);
      const py = Math.round((1 - (val - vMin) / range) * (yScale - 1));
      const dy = 3 - py;
      const bit = BRAILLE_MAP[dy] ? BRAILLE_MAP[dy][dx] : -1;
      if (bit >= 0) brailleChar |= (1 << bit);
    }
    result += String.fromCodePoint(brailleChar);
  }
  result += PALETTE.reset;
  return result;
}

module.exports = { renderLine, renderSparkline };
