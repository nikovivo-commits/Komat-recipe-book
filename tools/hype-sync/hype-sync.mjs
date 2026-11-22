#!/usr/bin/env node
/* Copies Hype's exports ("Detailed sales data", and the stock report if there is one) to Firestore, for the floor app.
   No AI is involved: it downloads a file, reads it, writes three documents. See README.md.

     node hype-sync.mjs login            open a window to sign in to Hype by hand (once, and again when the login expires)
     node hype-sync.mjs capture          open a window, press the export buttons yourself: it writes down what they do
     node hype-sync.mjs once [--dry]     one sync (--dry: show what would be written, write nothing)
     node hype-sync.mjs run              a sync every 10 minutes, for ever
     node hype-sync.mjs import <file> [sales|stock] [--day YYYY-MM-DD] [--dry]
                                         read a file you exported from Hype by hand and write it
     node hype-sync.mjs parse <file> [sales|stock] [--day YYYY-MM-DD]
                                         only show how a file is read (to get the column names in config.json right) */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dayOf, hourOf, dayBefore, parseSales, parseStock } from './lib/parse.mjs';
import { LoginError, openBrowser, closeBrowser, download, loginWindow, captureWindow } from './lib/hype.mjs';
import { openFirestore, dryFirestore } from './lib/store.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MAX_DOC_BYTES = 900000; /* a Firestore document holds at most 1 MiB */

export function loadConfig(file = path.join(HERE, 'config.json')) {
  if (!fs.existsSync(file)) throw new Error(`there is no ${path.basename(file)} yet: copy config.example.json to config.json and fill it in (see README.md)`);
  const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!cfg.baseUrl || /REPLACE/.test(cfg.baseUrl)) throw new Error('config.json: set "baseUrl" to the address of your Hype back office');
  cfg.timezone ||= 'Europe/Sofia';
  cfg.profileDir = path.resolve(HERE, cfg.profileDir || 'profile');
  cfg.stateFile = path.resolve(HERE, cfg.stateFile || 'state.json');
  return cfg;
}

const stamp = () => new Date().toLocaleString('sv-SE');
const log = (...a) => console.log(`[${stamp()}]`, ...a);
const hash = (v) => crypto.createHash('sha1').update(JSON.stringify(v)).digest('hex');
const readState = (cfg) => { try { return JSON.parse(fs.readFileSync(cfg.stateFile, 'utf8')); } catch { return {}; } };
const writeState = (cfg, s) => fs.writeFileSync(cfg.stateFile, JSON.stringify(s, null, 2));

/* writes a document only if its rows differ from the ones written last time; returns whether it wrote */
async function writeIfChanged(cfg, db, state, docPath, data, dry) {
  const h = hash(data.rows);
  if (!dry && state[docPath] === h) return false;
  const size = Buffer.byteLength(JSON.stringify(data));
  if (size > MAX_DOC_BYTES) throw new Error(`${docPath} would be ${Math.round(size / 1024)} KB, more than one Firestore document can hold`);
  await db.set(docPath, data);
  if (!dry) { state[docPath] = h; writeState(cfg, state); }
  return true;
}

/* One sync. Always ends by writing hypesync/status; never throws.
   db: { set(path, data) }; now: for tests. Returns the status it wrote. */
export async function sync(cfg, db, { dry = false, now = Date.now() } = {}) {
  const status = { at: now, ok: true, rows: 0, err: null };
  const state = readState(cfg);
  let ctx = null;
  try {
    const today = dayOf(now, cfg.timezone);
    /* just after midnight the last sales of the evening may still be missing from yesterday's document */
    const days = hourOf(now, cfg.timezone) < (cfg.yesterdayUntilHour ?? 2) ? [dayBefore(today), today] : [today];
    ctx = await openBrowser(cfg, cfg.profileDir, { headless: cfg.headless !== false });
    for (const day of days) {
      const { rows, skipped } = parseSales(await download(ctx, cfg, cfg.sales, day), cfg.sales, cfg.timezone, day);
      const wrote = await writeIfChanged(cfg, db, state, `hypesales/${day}`, { day, at: now, rows }, dry);
      log(`sales ${day}: ${rows.length} rows${skipped ? ` (${skipped} lines left out)` : ''}, ${wrote ? (dry ? 'shown, not written' : 'written') : 'unchanged'}`);
      if (day === today) status.rows = rows.length;
    }
    if (cfg.stock?.enabled) {
      const { rows } = parseStock(await download(ctx, cfg, cfg.stock, today), cfg.stock);
      const wrote = await writeIfChanged(cfg, db, state, 'hypestock/current', { at: now, rows }, dry);
      log(`stock: ${rows.length} rows, ${wrote ? (dry ? 'shown, not written' : 'written') : 'unchanged'}`);
    }
  } catch (e) {
    status.ok = false;
    status.err = e instanceof LoginError ? 'login' : String(e.message || e).slice(0, 300);
    log(e instanceof LoginError ? 'THE HYPE LOGIN HAS EXPIRED: stop this, run "node hype-sync.mjs login", sign in, close the window, start again.' : 'sync failed: ' + (e.message || e));
  } finally {
    if (ctx) await closeBrowser(ctx, cfg.profileDir);
  }
  try { await db.set('hypesync/status', status); } catch (e) { log('could not write hypesync/status: ' + (e.message || e)); }
  return status;
}

/* a file exported from Hype by hand */
async function importFile(cfg, db, file, kind, day, dry) {
  const buf = fs.readFileSync(file), now = Date.now(), state = readState(cfg);
  if (kind === 'stock') {
    const { rows } = parseStock(buf, cfg.stock || {});
    const wrote = await writeIfChanged(cfg, db, state, 'hypestock/current', { at: now, rows }, dry);
    log(`stock: ${rows.length} rows, ${wrote ? (dry ? 'shown, not written' : 'written') : 'unchanged'}`);
    return;
  }
  const { rows, skipped } = parseSales(buf, cfg.sales, cfg.timezone, day);
  const wrote = await writeIfChanged(cfg, db, state, `hypesales/${day}`, { day, at: now, rows }, dry);
  log(`sales ${day}: ${rows.length} rows${skipped ? ` (${skipped} lines left out)` : ''}, ${wrote ? (dry ? 'shown, not written' : 'written') : 'unchanged'}`);
  if (day === dayOf(now, cfg.timezone)) await db.set('hypesync/status', { at: now, ok: true, rows: rows.length, err: null });
}

async function main(argv) {
  const [cmd, ...rest] = argv;
  const dry = rest.includes('--dry');
  const dayAt = rest.indexOf('--day');
  const args = rest.filter((a, i) => !a.startsWith('--') && !(dayAt >= 0 && i === dayAt + 1));
  if (!cmd || cmd === 'help' || cmd === '--help') { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0].replace(/^#!.*\n\/\* ?/, '')); return; }
  const cfg = loadConfig();
  const day = dayAt >= 0 ? rest[dayAt + 1] : dayOf(Date.now(), cfg.timezone);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('--day must look like 2026-11-22');

  if (cmd === 'login') {
    console.log('A browser window opens. Sign in to Hype in it, wait until you see the back office, then close the window.');
    await loginWindow(cfg, cfg.profileDir);
    console.log('Saved. You can now run: node hype-sync.mjs once --dry');
  } else if (cmd === 'capture') {
    console.log('A browser window opens. Go to each report, set the dates and press its CSV export button. Then close the window.');
    const file = await captureWindow(cfg, cfg.profileDir, path.join(HERE, 'captures'));
    console.log(`What the buttons did is written in ${file}; the downloaded files are next to it. They hold real sales: they stay on this computer.`);
  } else if (cmd === 'parse') {
    if (!args[0]) throw new Error('which file?');
    const out = args[1] === 'stock' ? parseStock(fs.readFileSync(args[0]), cfg.stock || {}) : parseSales(fs.readFileSync(args[0]), cfg.sales, cfg.timezone, day);
    console.log(`header line: ${out.header.join(' | ')}\n${out.rows.length} rows read, ${out.skipped} lines left out. The first rows:`);
    console.log(JSON.stringify(out.rows.slice(0, 5), null, 2));
  } else if (cmd === 'import') {
    if (!args[0]) throw new Error('which file?');
    await importFile(cfg, dry ? dryFirestore() : await openFirestore(cfg), args[0], args[1] === 'stock' ? 'stock' : 'sales', day, dry);
  } else if (cmd === 'once') {
    const status = await sync(cfg, dry ? dryFirestore() : await openFirestore(cfg), { dry });
    process.exitCode = status.ok ? 0 : 1;
  } else if (cmd === 'run') {
    const db = await openFirestore(cfg);
    const every = Math.max(1, Number(cfg.intervalMinutes) || 10) * 60000;
    log(`syncing every ${every / 60000} minutes. Leave this window open; Ctrl+C stops it.`);
    for (;;) {
      const started = Date.now();
      /* a sync that hangs must not stop the ones after it */
      await Promise.race([sync(cfg, db), new Promise((r) => setTimeout(r, Math.max(every, 5 * 60000)))]).catch((e) => log('sync failed: ' + (e.message || e)));
      await new Promise((r) => setTimeout(r, Math.max(5000, every - (Date.now() - started))));
    }
  } else {
    throw new Error(`unknown command "${cmd}". Try: login, capture, once, run, import, parse`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.on('unhandledRejection', (e) => log('error: ' + (e?.message || e)));
  main(process.argv.slice(2)).catch((e) => { console.error('\n' + (e.message || e)); process.exit(1); });
}
