#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const CSVParser = require('../lib/parser');
const { renderTable } = require('../lib/table');
const { renderBar } = require('../lib/bar');
const { renderLine } = require('../lib/line');
const { renderSparkline } = require('../lib/line');
const { exportData } = require('../lib/export');
const { applyFilters } = require('../lib/filter');
const { watchFile } = require('../lib/watch');

const VERSION = '1.1.0';

const USAGE = `
🎬 csviz v${VERSION} — Beautiful CSV visualization in your terminal

Usage: csviz <file> [options]

Chart Types:
  -t, --type <type>      Chart type: table (default), bar, line, spark

Column Selection:
  -c, --column <col>     Column to chart (for bar/line)
  -x, --x-column <col>   X-axis column (for line)
  -y, --y-column <col>   Y-axis column(s) for line chart (comma-separated)

Display:
  -n, --rows <n>         Max rows to display (default: 30)
  -W, --width <n>        Chart width in characters
  -H, --height <n>       Chart height in characters
      --title <title>    Chart title
      --compact          Compact table mode (no borders)
      --color <scheme>   Color scheme: auto, 256, 16, none

Filtering:
  -f, --filter <expr>    Filter rows (repeatable). Operators: =, !=, >, >=, <, <=, ~=, ~!
                         Examples: "Status=Active"  "Price>100"  "Name~=^A"

Export:
  -e, --export <fmt>     Export data as: json, yaml (no chart rendered)

Live:
      --watch            Watch file for changes and auto-refresh chart

Other:
  -h, --help             Show this help
  -v, --version          Show version

Examples:
  csviz data.csv                           # Show table
  csviz data.csv -t bar -c "Revenue"       # Bar chart
  csviz data.csv -t line -y "Price,Volume" # Multi-line chart
  csviz data.csv -t spark -c "Temp"        # Sparkline
  csviz data.csv -f "Region=APAC" -f "Revenue>1000"  # Filtered view
  csviz data.csv --export json > out.json  # Export to JSON
  csviz data.csv --watch -t bar -c "Sales" # Live-updating bar chart
  cat data.csv | csviz -t bar -c "Sales"   # Pipe from stdin
`.trim();

function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = { type: 'table', filters: [] };
  const positional = [];

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-t' || a === '--type') { opts.type = args[++i]; }
    else if (a === '-c' || a === '--column') { opts.column = args[++i]; }
    else if (a === '-x' || a === '--x-column') { opts.xColumn = args[++i]; }
    else if (a === '-y' || a === '--y-column') { opts.yColumns = args[++i].split(','); }
    else if (a === '-n' || a === '--rows') { opts.maxRows = parseInt(args[++i]); }
    else if (a === '-W' || a === '--width') { opts.width = parseInt(args[++i]); }
    else if (a === '-H' || a === '--height') { opts.height = parseInt(args[++i]); }
    else if (a === '--title') { opts.title = args[++i]; }
    else if (a === '--compact') { opts.compact = true; }
    else if (a === '--color') { opts.colorScheme = args[++i]; }
    else if (a === '-f' || a === '--filter') { opts.filters.push(args[++i]); }
    else if (a === '-e' || a === '--export') { opts.exportFormat = args[++i]; }
    else if (a === '--watch') { opts.watch = true; }
    else if (a === '-h' || a === '--help') { console.log(USAGE); process.exit(0); }
    else if (a === '-v' || a === '--version') { console.log(`csviz v${VERSION}`); process.exit(0); }
    else if (!a.startsWith('-')) { positional.push(a); }
  }

  return { ...opts, file: positional[0] || null };
}

/**
 * Load and optionally filter CSV data.
 */
function loadData(opts) {
  const input = opts.file
    ? fs.readFileSync(opts.file, 'utf-8')
    : fs.readFileSync('/dev/stdin', 'utf-8');

  let data = CSVParser.parse(input);

  if (data.headers.length === 0) {
    console.error('Error: No data found. Check your CSV format.');
    process.exit(1);
  }

  // Apply filters
  if (opts.filters && opts.filters.length > 0) {
    data = applyFilters(data, opts.filters);
  }

  return data;
}

/**
 * Render data to a string based on type and options.
 */
function render(data, opts) {
  // Export mode — no chart, just output data
  if (opts.exportFormat) {
    return exportData(data, opts.exportFormat, { pretty: true });
  }

  switch (opts.type) {
    case 'bar':
      return renderBar(data, { valueColumn: opts.column, ...opts });
    case 'line':
      return renderLine(data, { yColumns: opts.yColumns, xColumn: opts.xColumn, ...opts });
    case 'spark':
    case 'sparkline': {
      const col = opts.column || (data.numericColumns[0] && data.numericColumns[0].name);
      if (!col) { console.error('Error: No numeric column found for sparkline'); process.exit(1); }
      const ci = data.headers.indexOf(col);
      const values = data.rows.map(r => CSVParser.toNumber(r[ci])).filter(v => !isNaN(v));
      return renderSparkline(values, opts);
    }
    case 'table':
    default:
      return renderTable(data, opts);
  }
}

/**
 * Run in watch mode — clear screen and re-render on file change.
 */
function runWatch(opts) {
  if (!opts.file) {
    console.error('Error: --watch requires a file path (stdin not supported)');
    process.exit(1);
  }

  const filePath = path.resolve(opts.file);

  function refresh() {
    try {
      const data = loadData(opts);
      const output = render(data, opts);

      // Clear screen and redraw
      process.stdout.write('\x1b[2J\x1b[H'); // clear + cursor home
      process.stdout.write(output);
      process.stdout.write(`\n\n  ${'─'.repeat(40)}\n`);
      process.stdout.write(`  🔄 Watching: ${opts.file} (press Ctrl+C to stop)\n`);
    } catch (err) {
      process.stdout.write(`\n  ⚠ Error: ${err.message}\n`);
    }
  }

  // Initial render
  refresh();

  const stop = watchFile(filePath, () => {
    refresh();
  });

  // Graceful exit
  process.on('SIGINT', () => {
    stop();
    process.stdout.write('\n  👋 Stopped watching.\n');
    process.exit(0);
  });
}

function main() {
  const opts = parseArgs(process.argv);

  // Watch mode
  if (opts.watch) {
    return runWatch(opts);
  }

  // One-shot mode
  const data = loadData(opts);
  const output = render(data, opts);
  console.log(output);
}

main();
