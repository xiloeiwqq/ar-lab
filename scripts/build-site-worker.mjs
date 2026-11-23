import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = new URL('../dist/', import.meta.url);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8',
  '.usdz': 'model/vnd.usdz+zip',
  '.glb': 'model/gltf-binary',
  '.woff2': 'font/woff2',
};

async function collect(dir, prefix = '') {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isDirectory() && ['assets', 'vendor'].includes(entry.name)) {
      files.push(...await collect(new URL(`${entry.name}/`, dir), `${prefix}${entry.name}/`));
    }
    if (!entry.isFile()) continue;
    const contents = await readFile(new URL(entry.name, dir));
    const type = types[extname(entry.name)] ?? 'application/octet-stream';
    files.push([`/${prefix}${entry.name}`, [type, contents.toString('base64'), contents.length]]);
  }
  return files;
}

const files = await collect(dist);
const worker = await readFile(new URL('./site-worker.mjs', import.meta.url), 'utf8');
const target = new URL('server/', dist);
await mkdir(target, { recursive: true });
await writeFile(fileURLToPath(new URL('index.js', target)), worker.replace('/* ASSET_ENTRIES */', JSON.stringify(files)));
