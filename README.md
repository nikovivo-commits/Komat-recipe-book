# Komat Kitchen Book

The Komat kitchen's recipe book and day-to-day tool: recipes and dishes, each station's mise en place, ordering, the staff rota and events. It is written for phones on the pass first, and works just as well on a tablet or laptop.

## What's in it

- **Recipes**: the search sits at the top and stays under the header as you scroll (tap Recipes again to jump into it). Search in Bulgarian or Latin letters (`gyozi` finds Гьози), or by ingredient. Filter by folder, dish/recipe and "on the menu now". Dishes are broken into their parts, each with its own yield. Plating photos open full screen and swipe; recipes without a photo, and every part of a dish, show an illustration marked as such.
  - Scale by yield, ×½ to ×4, a custom factor, or from what you have ("I have 750 g celeriac"). Grams switch to kilos at 1000.
  - Tap ingredients and steps to cross them off. Times in a method ("20 минути") become tap-to-start **timers**. They keep running across pages and ring when done. Temperatures are highlighted.
  - **Cook mode**: one big step at a time, swipe or tap Next. The screen stays on.
  - Allergens (EU 14) are found automatically from the ingredient names, then confirmed by the head chef.
  - Bulgarian / English switch for recipe text.
  - Editor (Settings → Add a recipe by hand, or Edit on a recipe): paste a whole ingredient list at once, reorder parts, add photos, plating photos and videos. In the Claude version you can also scan a paper recipe sheet.
- **Today**: pick your station (Hot, Cold, Pass & pastry). Tap a mise en place row once for **DO**, twice for **ready**, or swipe it (right = ready, left = DO); **!** flags it urgent for the whole kitchen. Finishing a station gets confetti. You get a to-do list (tap the circle or swipe right when done, swipe left to remove) with comments, notes left for tomorrow's shift, repeating tasks (like ordering bread on Sun/Tue/Thu), event prep, and a daily brief with urgent items, coming events and who's on. Every "Done" has an Undo.
  - **Print**: the small printer icon next to To do prints a black-and-white sheet with tick boxes and lines to write on, for today or tomorrow, one station or all three (one page each). On the stand-alone site; the Claude version cannot print.
  - **Tomorrow's prep list**: from the closing hour (21:00 by default, set in Kitchen rules) the mise en place list switches to tomorrow. Whoever closes marks DO on what the next shift must make, and the morning shift finds it on its list and to-do. A Today / Tomorrow switch is always there. The kitchen day runs until 4 am.
- **Order check**: it asks only about the ingredients for what is marked DO on tomorrow's prep list (mark Benedict, and it asks about butter, eggs, lemons and the rest of that dish, with the amounts). Sauces and other house-made parts open up into their own ingredients. One product card at a time, with a photo. Swipe right = have it, left = out, up = running low (or use the buttons, or the classic list). Spellings of the same product are merged, salt, pepper and water are never asked, and the head chef can retire any other basic with "Stop asking" (listed in Kitchen rules).
- **Orders**: the Orders tab combines every station's Low / Out into one copyable list next to the whiteboard photo.
- **Schedule**: your own week at a glance plus the full rota, using the same shift codes as the spreadsheet. The head chef sets shifts with a few taps.
- **Events**: calendar, countdowns, the food (linked recipes open already scaled to the guest count) and a prep list that lands on each station's Today on the right day.

## Three ways to run it

### 1. The real app: the stand-alone site with the kitchen's own database

The site in this repo (GitHub Pages) plus a free Google Firebase project. Cooks add the site to their phone's home screen and it opens full screen like an app. Everyone shares one live book, no Claude accounts needed:

- **Cooks** join once per phone with their name and the **kitchen code**. They can tick, add tasks, orders, photos and problem reports.
- **The head chef** signs in with email and password and can also change recipes, lists, the rota, events and settings, see and change the kitchen code, make other people head chef, and remove people who have left.
- A copy of the book stays on each phone, so it opens and ticks save without Wi-Fi, then catch up.
- Photos and videos are kept in the database too, so the free plan (no card) is enough.

Setting it up (about 10 minutes, once):

1. At [console.firebase.google.com](https://console.firebase.google.com) create a project (Google Analytics is not needed).
2. **Build → Authentication → Get started → Sign-in method**: turn on **Email/Password** and **Anonymous**.
3. **Build → Firestore Database → Create database**: pick a location near the restaurant (for example `eur3`), start in production mode.
4. **Firestore → Rules**: replace everything with the contents of [`firebase/firestore.rules`](firebase/firestore.rules) and Publish.
5. **Project settings → Your apps → Web (`</>`)**: register an app (no hosting), copy the `firebaseConfig` values into [`firebase-config.js`](firebase-config.js) and push. These values are meant to be public; the rules decide who sees what.
6. Open the site with `#setup` at the end of the address (for example `https://nikovivo-commits.github.io/Komat-recipe-book/#setup`). Enter your name, email, a password and the kitchen code for cooks. The first account to do this becomes the owner; nobody else can afterwards.
7. The empty book offers **Load a backup** (a backup file from the Claude version or the device-only site) or **Start with the built-in recipes**.
8. Tell the team the address and the kitchen code. Settings → People and kitchen code shows who has joined.

The rules are tested against the Firebase emulators: `cd tools/firebase && npm install && npm run emulators`, then `npm run test:rules` in another terminal.

### 2. Device-only site

With `firebase-config.js` left as `null`, the same site keeps everything **in that browser only**. It starts with the book's 52 recipes, the stations' mise en place lists and the rota codes from `data/`. Settings → Backup exports and imports a file; Settings → Start over restores the original book. Run it locally with any static server:

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

### 3. Shared, inside Claude

The same code runs as a Claude artifact with a live shared database: every cook with access sees ticks, tasks and orders as they happen. Build the single-file page with:

```sh
node tools/build.mjs   # writes dist/komat-kitchen-book.html
```

Publish it as an artifact with these capabilities: `db` (rules below), `assets`, `user` (scope `profile`) and `sample`. The artifact version holds no recipes in the page; they live in its database. Only this version can scan a paper recipe sheet.

| Path | Who can write |
| --- | --- |
| everything (`prep`, `checks`, `orders`, `boards`, `bugs`) | anyone with Contributor access |
| `recipes`, `settings`, `schedules`, `events` | Editors and the owner (the head chef) |

## Data

The collections and fields are the same as the first version of the book (`recipes`, `settings/{branding,checklists,staff,shiftcodes}`, `checks`, `prep`, `orders`, `boards`, `schedules`, `events`, `bugs`), plus `settings/kitchen` for the closing hour (when the list turns to tomorrow's), repeating tasks, products to check daily and basics never asked about. A row marked for tomorrow is saved in `checks/<tomorrow>_<station>`. So this version can run on top of the existing live data.

The kitchen's own database adds `members/<id>` (name and role of everyone who has joined), `private/owner` and `private/join` (the owner and the kitchen code, readable by head chefs only) and `blobs/<id>` (uploaded photos and videos, stored in pieces under `blobs/<id>/p`). A backup file is `{docs: {path: data}}` and may carry photos as `{assets: {id: data URL}}`.

The repo is public, so `data/` only holds recipes, mise en place lists and shift codes. Staff names, rotas, events, problem reports and the team photos stay in the private shared databases and are not committed.

Photos: `assets/photos/theme` (page headers, the courtyard cat), `assets/photos/gallery` (plating photos), `assets/photos/produce` (order-check products, named in `data/produce.js`) and `assets/photos/art` (illustrations for recipes without a photo, and in `art/parts` for each part of a dish by its part id, both listed in `data/art.js`). Product photos and illustrations are AI-generated.

## Code

Plain HTML, CSS and JavaScript with no build step for the site. The one dependency, the Firebase SDK, is bundled into `vendor/firebase.js` (rebuild with `cd tools/firebase && npm install && npm run bundle`).

```
index.html          site entry
css/app.css         all styles (light and dark)
js/core.js          DOM helper, dates (the kitchen day runs to 4 am), quantities, toasts, icons
js/allergens.js     allergen detection (English + Bulgarian)
js/store.js         storage: Claude database or this browser, one API
js/data.js          live data, recipes model, stations, tasks, orders, rota, events
js/cloud.js         the kitchen's own database (Firebase): same API, sign-in, photos, offline copy
js/timers.js        timers found in method text
js/gestures.js      swipeable rows, drag-to-close sheets, confetti
js/app.js           boot, routing, header, tab bar
js/photos.js        page photos, galleries, photo viewer, quiet-state cat
js/recipes.js       list, recipe pages, scaling, cook mode
js/editor.js        recipe editor, recipe-sheet scanning, list sync
js/today.js         Today, list editor
js/ordercheck.js    the swipe order check and its summary
js/orders.js        Orders
js/schedule.js      Schedule
js/events.js        Events
js/admin.js         settings, kitchen rules, branding, backups, problem reports
js/login.js         joining the kitchen, head chef sign-in and setup, people and kitchen code
js/print.js         the printed to-do list
data/*.js           starting data for the site, product photo names, illustrated recipes
firebase-config.js  the Firebase project's web settings (null = device-only)
firebase/           Firestore security rules
vendor/firebase.js  the Firebase SDK, bundled
sw.js               offline cache for the stand-alone site
tools/build.mjs     builds the single-file artifact page
tools/firebase/     bundles the SDK, runs the emulators, tests the rules
```
