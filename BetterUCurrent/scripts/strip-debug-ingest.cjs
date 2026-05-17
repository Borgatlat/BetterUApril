#!/usr/bin/env node
/** Remove agent debug ingest lines without changing file encoding. */
const fs = require('fs');
const path = require('path');

const files = process.argv.slice(2);
if (!files.length) {
  console.error('Usage: node scripts/strip-debug-ingest.cjs <file> ...');
  process.exit(1);
}

for (const file of files) {
  const p = path.resolve(file);
  const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);
  const filtered = lines.filter(
    (line) =>
      !line.includes('7243/ingest') &&
      !line.includes('#region agent log') &&
      !/^\s*\/\/ #endregion\s*$/.test(line),
  );
  const removed = lines.length - filtered.length;
  fs.writeFileSync(p, filtered.join('\n'), 'utf8');
  console.log(`${path.relative(process.cwd(), p)}: removed ${removed} lines`);
}
