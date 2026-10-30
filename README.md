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
- **Today**: pick your station (Hot, Cold, Pass & pastry). Tap a mise en place row once for **DO**, twice for **ready**, or swipe it (right = ready, left = DO); **!** flags it urgent for the whole kitchen. The page opens with a greeting under the Komat rays, three tiles (mise en place, to-do, and tonight's event or what is urgent) and a card for an event today or tomorrow with the run of the evening and its dishes. Finishing a station shows a full-screen Ready for service. You get a to-do list (tap the circle or swipe right when done, swipe left to remove) with comments, notes left for tomorrow's shift, repeating tasks (like ordering bread on Sun/Tue/Thu), event prep, and a daily brief with urgent items, coming events and who's on. Every "Done" has an Undo.
  - **Print**: the small printer icon next to To do prints a black-and-white sheet with tick boxes and lines to write on, for today or tomorrow, one station or all three (one page each). On the stand-alone site; the Claude version cannot print.
  - **Tomorrow's prep list**: from the closing hour (21:00 by default, set in Kitchen rules) the mise en place list switches to tomorrow. Whoever closes marks DO on what the next shift must make, and the morning shift finds it on its list and to-do. A Today / Tomorrow switch is always there. The kitchen day runs until 4 am.
  - **Three tabs**: on a phone Today shows one list at a time: To do (with the count), Mise en place (ready / total) and Tomorrow. Done tasks fold into one "N done" row under the list. On a wide screen everything sits side by side.
  - **Which day is it?** Every list has a dated label: green "Today's sheet · Thu 29 Oct, from 04:00 until 21:00" or amber "Tomorrow's sheet · you are writing it". Above the lists a day-line runs from 04:00 to 04:00 with a "now" pin, the 21:00 switch to tomorrow's sheet, and midnight marked "date changes, day doesn't"; after midnight it says "still Thu 29 Oct until 04:00".
  - **The bin**: the first time Today opens on a new kitchen day, a short film (made with Higgsfield) shows yesterday's handwritten sheet crumpled and dropped in the bin, with its date, then the sun comes up on "A fresh sheet". Closing your station plays the same film for today's sheet before the lights go off.
  - **Your marker**: the first time you open the app you pick your handwriting (12 styles, all with Cyrillic) and your Sharpie colour (8). DO is drawn on in Sharpie when you tap, done lines get a marker stroke through them, and comments are written in the writer's own hand and colour with their name, so the next shift knows who wrote what. Change it in Settings → Your marker.
  - **The + button**: the round + at the bottom right opens Add a task (it grows out of the button): type it, pick Today or Tomorrow, flip Urgent, pick the station. It steps aside while you scroll down the list.
  - **All ready**: a mise en place dish with more than one row left has an All ready button; its boxes tick one after another and the whole dish is saved in one go, with Undo.
  - **A clean list every day**: nothing left unticked comes back the next day, so tomorrow's prep list starts empty and each morning starts with a fresh to-do. Only what was planned for that day comes through: the DO marks made for it, the notes left for it, its repeating tasks and the event prep that falls due that day.
- **Film clips**: short Higgsfield clips play at the right moments: a gas flame (Hot) or morning light (other stations) behind Today's greeting, a flambé flare behind Ready for service, steam from a lid inside a finished timer, butter foaming behind cook mode, steam off a plate when you finish cooking, vegetables dropping into a crate after you send an order, and the kitchen lights going off when you finish mise en place. They live in `assets/motion/` as small WebM and MP4 files and are skipped on reduced motion or data saver.
- **Moments**: a timer that finishes pulses the screen green, sends out rings and drops a banner with a swinging bell (running timers show a draining ring); a sent order drops its products into a crate and stamps SENT; the first look at Today on a new kitchen day plays a short sunrise and says "A fresh list"; the greeting slides in word by word, the tile numbers flip, a ticked circle bursts, and Ready for service counts up.
- **Motion**: done rows fold away and the list closes the gap, a dish photo grows into its recipe page (Chrome and Safari 18; other pages fade in), scaled amounts roll into place, and the station and scale highlights slide to your choice, with each station's own glow (embers, frost, gold) behind the greeting. Phones set to reduce motion get none of it.
- **Recipe page**: a dark bar under your thumb with a − / + stepper that scales the whole dish and a big Cook button.
- **Schedule and Events**: Schedule shows your next shift and how many shifts you have this week on top of your week. Events opens with this week as a strip of days and tonight's event first.
- **Order check**: it asks only about the ingredients for what is marked DO on tomorrow's prep list (mark Benedict, and it asks about butter, eggs, lemons and the rest of that dish, with the amounts). Sauces and other house-made parts open up into their own ingredients. One product card at a time, with a photo. Swipe right = have it, left = out, up = running low (or use the buttons, or the classic list). Spellings of the same product are merged, salt, pepper and water are never asked, and the head chef can retire any other basic with "Stop asking" (listed in Kitchen rules).
- **Whiteboard** (the bottom tab): everyone writes what the kitchen needs and how much, in their own handwriting and marker colour, with their station and name under it. Lines from the ingredient check land on it too; × wipes a line. The order runs on its own clock: everything written from 12:00 until midnight is one order. At 00:00 it counts as sent to the head chef and the board is wiped (the first phone to look after midnight sees the eraser). From 00:00 until 12:00 anything new goes under a red "Sorry chef, forgot to order" with its time, on that same order. From 12:00 a new order starts. The head chef has "Email me this order", which opens an email with the whole order and the Sorry chef lines (also copied). "The one before" shows the previous order.
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
9. Anything prepared for you as a file (an event, a week of the rota, recipes) goes in with Settings → **Add from a file**, which adds it and changes nothing else. Settings → Backup → Import instead replaces the whole book.

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
js/motion.js        page fades, the photo morph, folding rows, rolling numbers, sliding pills
js/moments.js       timer, order-sent and new-day scenes, tick sparks, count-up
js/ink.js           each person's marker: handwriting and colour
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
