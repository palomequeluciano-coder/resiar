import { readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';

const root = process.cwd();
const dist = join(root, 'dist');
const rows = [];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walk(path);
    else {
      const info = await stat(path);
      rows.push({ path: relative(dist, path).replaceAll('\\\\', '/'), size: info.size });
    }
  }
}

function fmt(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

try {
  await walk(dist);
  rows.sort((a, b) => b.size - a.size);
  const total = rows.reduce((sum, row) => sum + row.size, 0);
  console.log(`\n[resiar] dist total: ${fmt(total)}\n`);
  for (const row of rows.slice(0, 20)) {
    console.log(`${fmt(row.size).padStart(10)}  ${row.path}`);
  }
} catch (error) {
  console.error('[resiar] dist not found. Run npm run build first.');
  process.exitCode = 1;
}
