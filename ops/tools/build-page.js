#!/usr/bin/env node
/* Builds the claude.ai page version of Komat Back Office.
 * claude.ai wraps a published page in its own <html>/<head>/<body>, so the page file holds only
 * what sits between the page:start and page:end markers in index.html. Styles and scripts are
 * copied next to it unchanged.
 *
 *   node ops/tools/build-page.js <output folder>
 */
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const out = path.resolve(process.argv[2] || path.join(root, 'build'));

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const start = html.indexOf('<!-- page:start');
const end = html.indexOf('<!-- page:end -->');
if (start < 0 || end < 0) throw new Error('index.html is missing the page:start / page:end markers');

const page = html
  .slice(html.indexOf('\n', start) + 1, end)
  .split('\n')
  .filter(line => !/^\s*<\/head>\s*$|^\s*<body>\s*$/.test(line))
  .join('\n')
  .trim() + '\n';

const files = ['styles.css'].concat(fs.readdirSync(path.join(root, 'js')).filter(f => f.endsWith('.js')).map(f => 'js/' + f));
fs.mkdirSync(path.join(out, 'js'), { recursive: true });
fs.writeFileSync(path.join(out, 'index.html'), page);
files.forEach(f => fs.copyFileSync(path.join(root, f), path.join(out, f)));
console.log('Wrote ' + path.join(out, 'index.html') + ' and ' + files.join(', '));
