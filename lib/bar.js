// lib/bar.js — 水平条形图渲染器（零依赖，纯 Unicode）
// 支持排序、分组、热力渐变、自定义宽度

'use strict';

const { PALETTE, colorize, bold, dim, brightYellow, brightCyan, brightMagenta } = require('./colors');
const CSVParser = require('./parser');
const { niceScale, formatTick, mean, sum, min, max } = require('./stats');

/**
 * 渲染水平条形图
 * @param {object} data - { headers, rows, numericColumns }
 * @param {object} opts
 *   - labelColumn: string|number — 标签列名或索引（默认第一个非数字列）
 *   - valueColumn: string|number — 值列名或索引（默认第一个数字列）
 *   - sort: 'asc'|'desc'|'none' — 排序方式（默认 desc）
 *   - maxBars: number — 最多显示条数（默认 25）
 *   - barWidth: number — 图表区域宽度（字符数，默认自动）
 *   - title: string — 标题
 *   - heatmap: boolean — 热力渐变色（默认 false）
 *   - stacked: boolean — 是否堆叠所有数字列
 *   - showStats: boolean — 显示统计信息（默认 true）
 */
function renderBar(data, opts = {}) {
  const { headers, rows, numericColumns } = data;
  const terminalWidth = process.stdout.columns || 80;

  // 确定标签列和值列
  const numColIndices = new Set(numericColumns.map(nc => nc.index));
  let labelColIndex = headers.length > 0 ? 0 : -1;

  if (opts.labelColumn != null) {
    labelColIndex = typeof opts.labelColumn === 'string'
      ? headers.indexOf(opts.labelColumn)
      : opts.labelColumn;
  } else {
    // 自动选择第一个非数字列
    for (let i = 0; i < headers.length; i++) {
      if (!numColIndices.has(i)) { labelColIndex = i; break; }
    }
  }

  let valueColIndex;
  if (opts.valueColumn != null) {
    valueColIndex = typeof opts.valueColumn === 'string'
      ? headers.indexOf(opts.valueColumn)
      : opts.valueColumn;
  } else if (numericColumns.length > 0) {
    valueColIndex = numericColumns[0].index;
  } else {
    // 没有数字列 — 降级为表格模式
    return require('./table').render(data, opts);
  }

  // 准备数据
  let items = rows
    .filter(r => r.length > Math.max(labelColIndex, valueColIndex))
    .map(r => ({
      label: String(r[labelColIndex] || '').slice(0, 20),
      value: CSVParser.toNumber(r[valueColIndex]) || 0,
    }))
    .filter(item => !isNaN(item.value));

  // 排序
  const sortDir = opts.sort === 'asc' ? 1 : opts.sort === 'none' ? 0 : -1;
  if (sortDir !== 0) {
    items.sort((a, b) => sortDir * (a.value - b.value));
  }

  // 限制条数
  if (opts.maxBars && items.length > opts.maxBars) {
    items = items.slice(0, opts.maxBars);
  }

  if (items.length === 0) {
    return dim('  (no numeric data to chart)');
  }

  // 计算尺寸
  const maxLabelLen = Math.max(...items.map(i => i.label.length), 4);
  const maxValueLen = Math.max(...items.map(i => CSVParser.formatNumber(i.value).length), 4);
  const barAreaWidth = opts.barWidth || Math.max(20, terminalWidth - maxLabelLen - maxValueLen - 12);
  const absMax = Math.max(...items.map(i => Math.abs(i.value)), 1);

  // 统计
  const values = items.map(i => i.value);
  const stats = {
    total: sum(values),
    avg: mean(values),
    min: min(values),
    max: max(values),
  };

  // 构建输出
  const lines = [];

  // 标题
  const titleText = opts.title || `${headers[valueColIndex]}`;
  lines.push('');
  lines.push(`  ${bold(brightCyan(titleText))}`);
  if (headers[labelColIndex]) {
    lines.push(`  ${dim(`by ${headers[labelColIndex]} · ${items.length} items`)}`);
  }
  lines.push('');

  // 绘制条形
  const palette = PALETTE.bars;
  items.forEach((item, idx) => {
    const barLen = Math.max(1, Math.round((Math.abs(item.value) / absMax) * barAreaWidth));
    const paddedLabel = item.label.padEnd(maxLabelLen);
    const formattedValue = CSVParser.formatNumber(item.value).padStart(maxValueLen);

    let barColor;
    if (opts.heatmap) {
      barColor = require('./colors').heatColor(item.value, stats.min, stats.max);
    } else {
      barColor = palette[idx % palette.length];
    }

    const bar = '█'.repeat(barLen);
    const empty = '░'.repeat(barAreaWidth - barLen);

    lines.push(
      `  ${dim(paddedLabel)} ${colorize(bar, barColor)}${dim(empty)} ${brightYellow(formattedValue)}`
    );
  });

  // 统计行
  if (opts.showStats !== false) {
    lines.push('');
    const statsLine = [
      `Total: ${brightYellow(CSVParser.formatNumber(stats.total))}`,
      `Avg: ${brightYellow(CSVParser.formatNumber(stats.avg))}`,
      `Min: ${brightYellow(CSVParser.formatNumber(stats.min))}`,
      `Max: ${brightYellow(CSVParser.formatNumber(stats.max))}`,
    ];
    lines.push(`  ${dim(statsLine.join('  ·  '))}`);
  }

  lines.push('');
  return lines.join('\n');
}

module.exports = { renderBar };
