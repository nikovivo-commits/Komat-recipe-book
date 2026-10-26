// node bundle.mjs -> ../../vendor/firebase.js (window.FB). Run after changing the Firebase version.
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const version = JSON.parse(readFileSync(new URL('./node_modules/firebase/package.json', import.meta.url))).version;
await build({
  entryPoints: [new URL('./entry.js', import.meta.url).pathname],
  outfile: new URL('../../vendor/firebase.js', import.meta.url).pathname,
  bundle: true, minify: true, format: 'iife', globalName: 'FB', target: 'es2019', legalComments: 'none',
  define: { 'process.env.NODE_ENV': '"production"' },
  banner: { js: `/* Firebase JS SDK ${version} (Apache-2.0), bundled by tools/firebase/bundle.mjs */` },
  logLevel: 'info',
});
