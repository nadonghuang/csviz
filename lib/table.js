// lib/table.js — 美观的数据表格渲染器（零依赖，纯 Unicode）

'use strict';

const { PALETTE, colorize, bold, dim, brightYellow, brightCyan, brightMagenta, C } = require('./colors');
const CSVParser = require('./parser');

// Unicode box-drawing characters
const BOX = {
  tl: '┌', tr: '┐', bl: '└', br: '┐',
  h: '─', v: '│',
  lj: '├', rj: '┤', tj: '┬', bj: '┴', cross: '┼',
};

/**
 * 渲染格式化表格
 * @param {object} data - { headers, rows, numericColumns }
 * @param {object} opts
 *   - maxRows: 最大行数
 *   - maxWidth: 每列最大宽度
 *   - columns: 要显示的列（默认全部）
 *   - title: 标题
 *   - compact: 紧凑模式（无框线）
 */
function renderTable(data, opts = {}) {
  const { headers, rows, numericColumns } = data;
  const terminalWidth = process.stdout.columns || 80;

  if (headers.length === 0) return dim('  (empty data)');

  // 选择列
  let colIndices = headers.map((_, i) => i);
  if (opts.columns) {
    const colNames = Array.isArray(opts.columns) ? opts.columns : [opts.columns];
    colIndices = colNames.map(name => {
      const idx = headers.indexOf(name);
      return idx >= 0 ? idx : -1;
    }).filter(i => i >= 0);
    if (colIndices.length === 0) colIndices = headers.map((_, i) => i);
  }

  // 限制行数
  const maxRows = opts.maxRows || 30;
  const displayRows = rows.slice(0, maxRows);
  const numColSet = new Set(numericColumns.map(nc => nc.index));

  // 计算列宽
  const colWidths = colIndices.map(ci => {
    const headerLen = (headers[ci] || '').length;
    const maxDataLen = displayRows.reduce((max, r) =>
      Math.max(max, String(r[ci] || '').length), 0
    );
    const natural = Math.max(headerLen, maxDataLen);
    const maxColWidth = opts.maxWidth || Math.floor((terminalWidth - 10) / colIndices.length) - 3;
    return Math.min(natural, maxColWidth);
  });

  const totalWidth = colWidths.reduce((s, w) => s + w + 3, 0) + 1;
  const lines = [];

  // 标题
  if (opts.title) {
    lines.push('');
    lines.push(`  ${bold(brightCyan(opts.title))}`);
    lines.push('');
  }

  if (!opts.compact) {
    // 顶部框线
    lines.push(`  ${BOX.tl}${colWidths.map(w => BOX.h.repeat(w + 2)).join(BOX.tj)}${BOX.tr}`);
  }

  // 表头
  const headerCells = colIndices.map((ci, i) => {
    const h = headers[ci] || '';
    const padded = h.padEnd(colWidths[i]);
    return opts.compact
      ? ` ${bold(brightCyan(padded))} `
      : `${C.brightCyan} ${bold(padded)} ${C.reset}`;
  });
  lines.push(`  ${opts.compact ? '' : BOX.v}${headerCells.join(opts.compact ? '|' : BOX.v)}${opts.compact ? '' : BOX.v}`);

  if (!opts.compact) {
    // 分隔线
    lines.push(`  ${BOX.lj}${colWidths.map(w => BOX.h.repeat(w + 2)).join(BOX.cross)}${BOX.rj}`);
  }

  // 数据行
  displayRows.forEach((row, ri) => {
    const isAlt = ri % 2 === 1;
    const rowPrefix = opts.compact ? '' : BOX.v;
    const rowSuffix = opts.compact ? '' : BOX.v;

    const cells = colIndices.map((ci, i) => {
      const val = String(row[ci] || '');
      const truncated = val.length > colWidths[i] ? val.slice(0, colWidths[i] - 1) + '…' : val;
      const padded = truncated.padEnd(colWidths[i]);

      if (isAlt) {
        return ` ${dim(padded)} `;
      }

      // 数字列右对齐 + 高亮
      if (numColSet.has(ci) && CSVParser.isNumeric(val)) {
        const numVal = CSVParser.toNumber(val);
        const formatted = CSVParser.formatNumber(numVal).padStart(colWidths[i]);
        return ` ${brightYellow(formatted)} `;
      }

      return ` ${padded} `;
    });

    lines.push(`  ${rowPrefix}${cells.join(opts.compact ? '|' : BOX.v)}${rowSuffix}`);
  });

  // 被截断的行提示
  if (rows.length > maxRows) {
    const ellipsis = colIndices.map((_, i) =>
      ` ${dim('···'.padEnd(colWidths[i]))} `
    ).join(opts.compact ? '|' : BOX.v);
    lines.push(`  ${opts.compact ? '' : BOX.v}${ellipsis}${opts.compact ? '' : BOX.v}`);
    lines.push(`  ${dim(`  + ${rows.length - maxRows} more rows`)}`);
  }

  if (!opts.compact) {
    // 底部框线
    lines.push(`  ${BOX.bl}${colWidths.map(w => BOX.h.repeat(w + 2)).join(BOX.bj)}${BOX.br}`);
  }

  // 汇总
  lines.push('');
  lines.push(`  ${dim(`${rows.length} rows × ${colIndices.length} columns`)}`);
  lines.push('');

  return lines.join('\n');
}

module.exports = { renderTable };
