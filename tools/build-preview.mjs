// Builds a stand-alone preview of the book as one page, for trying new work before it goes live.
// It always runs device-only: no Firebase settings, no Claude database. Whatever is done in it
// stays in that browser and never reaches the kitchen's live book. It starts from the book's own
// recipes and station lists, with example quantities per 10 covers on a few Cold & pastry rows so
// the covers planner can be tried straight away. Printing is hidden: a preview page can't print.
//   node tools/build-preview.mjs <out.html>
// The page loads its photos and films from assets/ next to it: publish the assets folder alongside.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(process.argv[2] || join(root, 'dist', 'preview.html'));
const index = readFileSync(join(root, 'index.html'), 'utf8');
/* the kitchen's live database stays out of the preview */
const LIVE_ONLY = /^(vendor\/firebase\.js|firebase-config\.js)$/;
const scripts = [...index.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]).filter((s) => !LIVE_ONLY.test(s));
const fonts = index.match(/<link rel="stylesheet" href="(https:\/\/fonts\.googleapis\.com[^"]+)">/)[1];
const read = (p) => readFileSync(join(root, p), 'utf8').replace(/<\/(script|style)/gi, '<\\/$1');
function source(p) {
  let s = read(p);
  if (p === 'js/app.js') {
    /* never the Claude database either: the preview keeps everything on the device */
    const was = "const cl = window.claude && typeof window.claude.use === 'function' ? window.claude : null;";
    if (!s.includes(was)) throw new Error('app.js boot changed: update build-preview.mjs');
    s = s.replace(was, 'const cl = null;');
  }
  return s;
}

/* example amounts for trying the planner: change them in the list editor */
const EXAMPLES = { cold: { i2: { q: 0.5, u: 'L' }, i3: { q: 2, u: 'portions' }, i45: { q: 300, u: 'g' }, i47: { q: 150, u: 'g' } } };
const examples = `(function () {
  var ex = ${JSON.stringify(EXAMPLES)}, st = (((window.KOMAT_SEED || {}).settings || {}).checklists || {}).stations || {};
  Object.keys(ex).forEach(function (k) { ((st[k] || {}).sections || []).forEach(function (sec) { sec.groups.forEach(function (g) { g.items.forEach(function (it) { if (ex[k][it.id] && !it.par) it.par = ex[k][it.id]; }); }); }); });
})();`;

const badgeCss = `
.preview-badge { position: fixed; z-index: 60; top: calc(env(safe-area-inset-top, 0px) + 6px); left: 50%; transform: translateX(-50%); padding: 4px 9px; border-radius: 999px; background: var(--todo); color: var(--todo-ink); font: 800 .66rem/1 var(--mono); letter-spacing: .12em; text-transform: uppercase; pointer-events: none; white-space: nowrap; }
@media (min-width: 900px) { .preview-badge { top: auto; bottom: calc(env(safe-area-inset-bottom, 0px) + 14px); left: max(16px, env(safe-area-inset-left, 0px)); transform: none; } }`;

const page = [
  '<meta charset="utf-8">',
  '<title>Komat Kitchen Book Preview</title>',
  '<meta name="claude:viewport-fit-sides" content="cover">',
  '<link rel="preconnect" href="https://fonts.googleapis.com">',
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
  `<link rel="stylesheet" href="${fonts}">`,
  `<style>\n${read('css/app.css')}\n${badgeCss}\n</style>`,
  '<div id="app"></div>',
  '<div class="preview-badge" aria-hidden="true">Preview · stays in this browser</div>',
  "<script>window.K = { BUILD: 'preview' }; window.KOMAT_FIREBASE = null;</script>",
  ...scripts.map((s) => `<script>\n/* ${s} */\n${source(s)}\n</script>` + (s === 'data/settings.js' ? `\n<script>\n/* example quantities per 10 covers */\n${examples}\n</script>` : '')),
  '<script>\n/* a preview page cannot open the print dialog */\nK.canPrint = function () { return false; };\n</script>',
  '',
].join('\n');

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, page);
console.log(`${out}  ${(page.length / 1024).toFixed(0)} KB  (${scripts.length} scripts)`);
