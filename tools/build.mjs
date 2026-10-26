// Builds the single-file page published as the shared Claude artifact.
// The artifact keeps its recipes and lists in its live database, so the starting data
// files (data/recipes.js, data/settings.js) are left out; the translation list stays in.
//   node tools/build.mjs        -> dist/komat-kitchen-book.html
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const index = readFileSync(join(root, 'index.html'), 'utf8');
const scripts = [...index.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]).filter((s) => !/^data\/(recipes|settings)\.js$/.test(s));
const fonts = index.match(/<link rel="stylesheet" href="(https:\/\/fonts\.googleapis\.com[^"]+)">/)[1];
const read = (p) => readFileSync(join(root, p), 'utf8').replace(/<\/(script|style)/gi, '<\\/$1');

const page = [
  '<meta charset="utf-8">',
  '<title>Komat Kitchen Book</title>',
  '<meta name="claude:viewport-fit-sides" content="cover">',
  '<link rel="preconnect" href="https://fonts.googleapis.com">',
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
  `<link rel="stylesheet" href="${fonts}">`,
  `<style>\n${read('css/app.css')}\n</style>`,
  '<div id="app"></div>',
  "<script>window.K = { BUILD: 'artifact' };</script>",
  ...scripts.map((s) => `<script>\n/* ${s} */\n${read(s)}\n</script>`),
  '',
].join('\n');

mkdirSync(join(root, 'dist'), { recursive: true });
const out = join(root, 'dist', 'komat-kitchen-book.html');
writeFileSync(out, page);
console.log(`dist/komat-kitchen-book.html  ${(page.length / 1024).toFixed(0)} KB  (${scripts.length} scripts)`);
