import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The startup bundle carries no tinytinkerer runtime (#152): with the assistant off, or before it opens, the page loads exactly what it
 * did before the embed. Reads a built apps/web/dist, follows the entry's static imports (what the browser must load before the app
 * runs; dynamic import() chunks are left out) and fails if any of them holds code from the @nntin/tinytinkerer-embed root. Only the
 * side-effect-free /oauth and /stage subpaths may be eager. One static import of the root, even of a constant, pulls the whole runtime in (+437 KB
 * gzipped, measured in phase 0); this is the check that would catch it. Run after `npm run build`.
 */
const dist = process.argv[2] ?? 'apps/web/dist';
const assets = join(dist, 'assets');
if (!existsSync(join(dist, 'index.html'))) throw new Error(`No build in ${dist}: run npm run build first.`);

/** String literals of the package root's runtime that survive minification, and that its /oauth subpath doesn't contain. */
const MARKERS = ['createBrowserApp', 'Sign in with GitHub'];

const html = readFileSync(join(dist, 'index.html'), 'utf8');
const entries = [...html.matchAll(/<script[^>]+src="\/assets\/([^"]+\.js)"/g), ...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="\/assets\/([^"]+\.js)"/g)].map(match => match[1] ?? '');
if (entries.length === 0) throw new Error('index.html loads no script from /assets/.');

// Static imports and re-exports only: `from"./x.js"` and `import"./x.js"`, never `import("./x.js")`.
const staticImports = (source: string) => [...source.matchAll(/(?:\bfrom|\bimport)\s*["']\.\/([^"']+\.js)["']/g)].map(match => match[1] ?? '');
/** A chunk and everything it imports statically. */
function graph(roots: string[]): Set<string> {
  const files = new Set<string>();
  const pending = [...roots];
  for (let file = pending.pop(); file !== undefined; file = pending.pop()) {
    if (files.has(file)) continue;
    files.add(file);
    pending.push(...staticImports(readFileSync(join(assets, file), 'utf8')));
  }
  return files;
}
const read = (files: Iterable<string>) => [...files].map(file => readFileSync(join(assets, file), 'utf8')).join('\n');
const startup = graph(entries);

const failures: string[] = [];
for (const file of startup) {
  const source = readFileSync(join(assets, file), 'utf8');
  for (const marker of MARKERS) if (source.includes(marker)) failures.push(`${file} contains “${marker}”`);
}
// Not vacuous: the markers are in the lazy assistant chunk, and that chunk is not part of startup.
const lazy = readdirSync(assets).filter(file => /^AssistantHost-.*\.js$/.test(file));
if (lazy.length !== 1) failures.push(`expected one lazy AssistantHost chunk, found ${lazy.length}`);
for (const file of lazy) if (startup.has(file)) failures.push(`${file} is loaded at startup`);
const lazySource = read(graph(lazy));
for (const marker of MARKERS) if (!lazySource.includes(marker)) failures.push(`the assistant chunks lack “${marker}”: update MARKERS for this package version`);

if (failures.length > 0) {
  console.error(`FAIL tinytinkerer code in the startup bundle (${[...startup].join(', ')}):\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log(`PASS startup bundle (${[...startup].join(', ')}) holds no tinytinkerer runtime; ${lazy.join(', ')} loads lazily`);
