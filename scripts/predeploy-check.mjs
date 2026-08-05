import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const jsOnly = process.argv.includes('--js-only');
const srcDir = join(root, 'src');
const scriptsDir = join(root, 'scripts');
const distDir = join(root, 'dist');
// El build (ver vite.config.js) genera el sitio anidado bajo esta subcarpeta
// para que la estructura física coincida con la ruta pública real
// (https://resiarg.com.ar/examenes-medicos/). Todos los checks de "¿está
// completo el build?" deben mirar acá, no en la raíz de dist/.
const publishDir = join(distDir, 'examenes-medicos');

const formatBytes = (bytes) => {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = Number(bytes) || 0;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 2)} ${units[unit]}`;
};

const walk = (dir, predicate = () => true) => {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) out.push(...walk(path, predicate));
    else if (predicate(path, stat)) out.push(path);
  }
  return out;
};

const fail = (message) => {
  console.error(`\n[predeploy] ERROR: ${message}`);
  process.exitCode = 1;
};

const warn = (message) => {
  console.warn(`[predeploy] aviso: ${message}`);
};

const info = (message) => {
  console.log(`[predeploy] ${message}`);
};

const jsFiles = [
  ...walk(srcDir, (path) => path.endsWith('.js')),
  ...walk(scriptsDir, (path) => path.endsWith('.mjs')),
].filter((path) => !path.endsWith('predeploy-check.mjs'));

info(`validando sintaxis JS/MJS (${jsFiles.length} archivos)...`);
for (const file of jsFiles) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (error) {
    fail(`falló node --check en ${relative(root, file)}\n${String(error.stderr || error.message)}`);
  }
}

if (process.exitCode) process.exit(process.exitCode);
info('sintaxis OK.');

if (jsOnly) process.exit(0);

if (!existsSync(publishDir)) {
  fail('no existe dist/examenes-medicos/. Ejecutá npm run build antes de subir a Cloudflare.');
  process.exit(process.exitCode);
}

const distFiles = walk(distDir);
const totalSize = distFiles.reduce((sum, file) => sum + statSync(file).size, 0);
const assetsDir = join(publishDir, 'assets');
const assetFiles = walk(assetsDir);
const jsAssets = assetFiles.filter((file) => file.endsWith('.js'));
const cssAssets = assetFiles.filter((file) => file.endsWith('.css'));
const indexJsAssets = jsAssets.filter((file) => /(^|[/\\])index-[^/\\]+\.js$/.test(file));
const indexCssAssets = cssAssets.filter((file) => /(^|[/\\])index-[^/\\]+\.css$/.test(file));

info(`dist total: ${formatBytes(totalSize)} (${distFiles.length} archivos).`);
info(`assets: ${assetFiles.length}; JS: ${jsAssets.length}; CSS: ${cssAssets.length}.`);

if (!existsSync(join(publishDir, 'index.html'))) {
  fail('dist/examenes-medicos/index.html no existe. El build no está completo.');
}

for (const forbidden of ['node_modules', 'src', '.env', '.env.local']) {
  if (existsSync(join(distDir, forbidden)) || existsSync(join(publishDir, forbidden))) {
    fail(`dist/ contiene ${forbidden}. No subas dependencias, fuentes ni secretos.`);
  }
}

if (indexJsAssets.length > 1) {
  warn(`hay ${indexJsAssets.length} archivos index-*.js. Si pegaste builds encima, borrá dist/ y reconstruí.`);
}

if (indexCssAssets.length > 1) {
  warn(`hay ${indexCssAssets.length} archivos index-*.css. Si pegaste builds encima, borrá dist/ y reconstruí.`);
}

if (totalSize > 8 * 1024 * 1024) {
  warn(`dist supera 8 MB sin comprimir (${formatBytes(totalSize)}). Revisar bundle si sigue creciendo.`);
}

const largest = distFiles
  .map((file) => ({ file: relative(distDir, file), size: statSync(file).size }))
  .sort((a, b) => b.size - a.size)
  .slice(0, 8);

info('archivos más pesados:');
for (const item of largest) {
  console.log(`  ${formatBytes(item.size).padStart(10)}  ${item.file}`);
}

if (process.exitCode) process.exit(process.exitCode);
info('predeploy OK.');
