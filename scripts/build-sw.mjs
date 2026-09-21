import { readFile, readdir, writeFile } from 'node:fs/promises';
const version = (await readFile('.next/BUILD_ID', 'utf8')).trim();
async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? files(`${dir}/${entry.name}`) : `${dir}/${entry.name}`))).flat();
}
const assets = (await files('.next/static')).filter(path => /\.(js|css|woff2?)$/.test(path)).map(path => path.replace('.next/', '/_next/'));
const routes = ['/', '/library', '/study', '/progress', '/settings', '/practice', '/review', '/install', '/offline', '/manifest.webmanifest', '/icon.svg', '/icon-192.png', '/icon-512.png'];
const template = await readFile('scripts/sw-template.js', 'utf8');
await writeFile('public/sw.js', template.replace('__VERSION__', JSON.stringify(version)).replace('__ASSETS__', JSON.stringify([...routes, ...assets])));
console.log(`Offline bundle: ${assets.length} assets and ${routes.length} routes.`);
