import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
import 'fake-indexeddb/auto';

// Load the application's TypeScript data modules with the same @/ alias as Next.
const require = createRequire(import.meta.url);
const cache = new Map();
export function load(path) {
  const filename = resolve(path);
  if (cache.has(filename)) return cache.get(filename);
  const source = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const loaded = { exports: {} };
  const localRequire = name => name.startsWith('@/') ? load('src/' + name.slice(2) + '.ts') : name.startsWith(".") ? load(resolve(dirname(filename), name + ".ts")) : require(name);
  new Function('require', 'module', 'exports', source)(localRequire, loaded, loaded.exports);
  cache.set(filename, loaded.exports);
  return loaded.exports;
}
