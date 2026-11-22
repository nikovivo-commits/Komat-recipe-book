# Hype sync

A small program for the laptop that stays on in the restaurant. Every 10 minutes it takes the
"Detailed sales data" export (and the stock export, if you switch it on) from Hype's web back office
and copies it into the Komat database, so the floor app can show bottle stock and guest orders.
No AI is involved when it runs: it downloads a file, reads it, and writes three documents.

## Read this first: Hype's terms

Hype's Terms and Conditions (version 4 of 10 August 2026, <https://hype-software.com/en/terms>) say in
Article 18(5):

> The User must not use deep links, robots, bots, spiders, automated devices, programs, scripts,
> algorithms, methods, or equivalent manual processes to access, obtain, copy, or monitor any part of
> the Software [...]

Article 19(1) lets Hype suspend access without notice and end the agreement for a breach, and
Article 19(3) sets a penalty of three monthly fees if the agreement ends through the customer's fault.

The automatic commands here (`once`, `run`, `capture`) are exactly such a script. **Do not run them
against Hype until Hype (PRO SOFT AD) has agreed in writing.** Article 17(2) of the same terms says
Hype can offer integrations, including through APIs, so asking is worth it: they may give you a proper feed.

Without that permission you can still use the part that never touches Hype: export the file yourself
in Hype, as you would for any other reason, and hand it to `import` (see "By hand" below).

## Status

The program is tested against a pretend Hype (`npm test`). It has **not yet been run against the real
Hype**: the addresses of the export buttons and the exact column names are not known yet, so
`config.example.json` holds placeholders. The `capture` command exists to find them out (step 6).

## Setup on the laptop

1. **Install Node.js.** Go to <https://nodejs.org>, download the "LTS" installer (version 20 or newer) and run it
   with the default answers.
2. **Open a terminal.** macOS: the app "Terminal". Windows: the app "PowerShell".
3. **Get the program.** If Git is not installed, get it from <https://git-scm.com/downloads> first.

   ```bash
   git clone https://github.com/nikovivo-commits/Komat-recipe-book.git
   ```

   ```bash
   cd Komat-recipe-book/tools/hype-sync
   ```

   ```bash
   npm install
   ```

   ```bash
   npx playwright install chromium
   ```

4. **Create the database key.** In the [Firebase console](https://console.firebase.google.com/) open the
   project `komat-kitchen` > the gear > Project settings > Service accounts > **Generate new private key**.
   A `.json` file downloads. Move it somewhere outside the `Komat-recipe-book` folder, for example your home
   folder, and never send it to anyone or put it in the repository: whoever holds it can read and
   change the whole database.

   Tell the program where it is (use your own path):

   macOS, then close and reopen Terminal:

   ```bash
   echo 'export HYPE_SYNC_FIREBASE_KEY="$HOME/komat-hype-sync-key.json"' >> ~/.zshrc
   ```

   Windows, then close and reopen PowerShell:

   ```bash
   setx HYPE_SYNC_FIREBASE_KEY "C:\Users\YOU\komat-hype-sync-key.json"
   ```

5. **Create the settings file.** Copy `config.example.json` to `config.json` (macOS: `cp config.example.json config.json`,
   Windows: `copy config.example.json config.json`), open `config.json` in a text editor and set `baseUrl` to
   the address you see in the browser when you are in Hype's back office (the part up to the first single `/`).
6. **Sign in to Hype once.**

   ```bash
   node hype-sync.mjs login
   ```

   A browser window opens. Sign in, wait for the back office, close the window. Your password is typed
   into Hype only; the program never sees or stores it. The login is remembered in the `profile` folder.

7. **Find out what the export buttons do** (once; only with Hype's permission, see above).

   ```bash
   node hype-sync.mjs capture
   ```

   In the window, open "Detailed sales data", choose today, press the CSV export button; do the same for
   the stock report if there is one; close the window. The folder `captures` now holds the downloaded
   files and a `capture-....json` that lists each request the buttons made: address, method, what was sent.
   Put those into `config.json`:

   - `sales.request.url` (and `method`, `body` or `form` if it was a POST), with `{from}` and `{to}` where
     the dates were, and `paramDateFormat` for how the dates were written (`DD.MM.YYYY`, `YYYY-MM-DD`...).
   - If a direct request does not work (some sites want a one-time token), set `"mode": "click"` and fill
     `sales.click`: the page address, the steps to set the dates, and the button to press.
   - `sales.columns`: the exact header of each column in the file. `timeFormat`: how the time is written.
     If date and time are two columns, name both (`date`, `time`) and write `timeFormat` for the two joined by a space.

   Check how a downloaded file is read, without touching Hype or the database:

   ```bash
   node hype-sync.mjs parse captures/NAME-OF-THE-FILE.csv
   ```

   Then update `docs/hype-export-format.md` with the real headers (with made-up rows, never real ones).

8. **Try one sync without writing**, then for real:

   ```bash
   node hype-sync.mjs once --dry
   ```

   ```bash
   node hype-sync.mjs once
   ```

9. **Start it.**

   ```bash
   node hype-sync.mjs run
   ```

   It syncs every 10 minutes (`intervalMinutes` in `config.json`) and carries on after errors.

## Start by itself after a reboot

The laptop must also be set not to sleep (macOS: System Settings > Battery/Energy > prevent sleeping when the
display is off, on power adapter; Windows: Settings > System > Power > Sleep: Never, when plugged in) and to
log in to your user account automatically, or someone has to log in after a reboot.

### macOS

Create the file `~/Library/LaunchAgents/bg.komat.hype-sync.plist` with this content, replacing `YOU` (three
places) and checking the path of `node` with `which node`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>bg.komat.hype-sync</string>
  <key>ProgramArguments</key><array>
    <string>/usr/local/bin/node</string>
    <string>/Users/YOU/Komat-recipe-book/tools/hype-sync/hype-sync.mjs</string>
    <string>run</string>
  </array>
  <key>EnvironmentVariables</key><dict>
    <key>HYPE_SYNC_FIREBASE_KEY</key><string>/Users/YOU/komat-hype-sync-key.json</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/Users/YOU/Komat-recipe-book/tools/hype-sync/hype-sync.log</string>
  <key>StandardErrorPath</key><string>/Users/YOU/Komat-recipe-book/tools/hype-sync/hype-sync.log</string>
</dict></plist>
```

Switch it on (it also starts at every login from now on):

```bash
launchctl load ~/Library/LaunchAgents/bg.komat.hype-sync.plist
```

Switch it off:

```bash
launchctl unload ~/Library/LaunchAgents/bg.komat.hype-sync.plist
```

What it is doing is in `hype-sync.log` in this folder.

### Windows

1. Open **Task Scheduler** > Create Task.
2. General: name "Komat Hype sync"; "Run only when user is logged on".
3. Triggers: New > "At log on" (your user).
4. Actions: New > Program: `C:\Program Files\nodejs\node.exe`; Arguments: `hype-sync.mjs run`;
   Start in: the full path of this folder, e.g. `C:\Users\YOU\Komat-recipe-book\tools\hype-sync`.
5. Settings: untick "Stop the task if it runs longer than"; tick "If the task fails, restart every 1 minute".

The key path set with `setx` in step 4 is picked up automatically.

## When it says the login expired

The floor app shows the feed as stale, and the window or `hype-sync.log` says "THE HYPE LOGIN HAS EXPIRED"
(in the database: `hypesync/status` has `ok: false, err: 'login'`).

1. Stop the program: Ctrl+C in its window, or the "switch it off" command above (Windows: Task Scheduler > End).
   This matters: two programs cannot use the saved login at the same time.
2. `node hype-sync.mjs login`, sign in, close the window.
3. Start it again (`node hype-sync.mjs run`, or switch the automatic start back on).

## By hand (no automatic access to Hype)

Export the file in Hype yourself, then:

```bash
node hype-sync.mjs import ~/Downloads/THE-FILE.csv
```

Add `--day 2026-11-21` for another day than today, `stock` after the file name for a stock export, and
`--dry` to only see what would be written. `import` needs `config.json` (for the column names) and the key,
but no Hype login.

## What it writes

See [`docs/hype-export-format.md`](../../docs/hype-export-format.md). In short: `hypesales/{YYYY-MM-DD}`
(only when the rows changed), `hypestock/current` (only if `stock.enabled`, only when changed) and
`hypesync/status` after every run.

## What stays on the laptop and out of Git

`config.json`, `state.json`, the `profile` folder (your Hype login), `captures` (real sales) and the key
file. They are listed in the repository's `.gitignore`. Only CSV exports are read; if Hype offers both, pick CSV, not XLS.
