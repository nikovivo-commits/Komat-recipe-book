# Komat Kitchen Book

The Komat kitchen's recipe book and day-to-day tool: recipes and dishes, each station's mise en place, ordering, the staff rota and events. It is written for phones on the pass first, and works just as well on a tablet or laptop.

## What's in it

- **Recipes**: search in Bulgarian or Latin letters (`gyozi` finds Гьози), or by ingredient. Filter by folder, dish/recipe and "on the menu now". Dishes are broken into their parts, each with its own yield.
  - Scale by yield, ×½ to ×4, a custom factor, or from what you have ("I have 750 g celeriac"). Grams switch to kilos at 1000.
  - Tap ingredients and steps to cross them off. Times in a method ("20 минути") become tap-to-start **timers**. They keep running across pages and ring when done. Temperatures are highlighted.
  - **Cook mode**: one big step at a time, swipe or tap Next. The screen stays on.
  - Allergens (EU 14) are found automatically from the ingredient names, then confirmed by the head chef.
  - Bulgarian / English switch for recipe text.
  - Editor: paste a whole ingredient list at once, reorder parts, add photos and plating videos. In the Claude version you can also scan a paper recipe sheet.
- **Today**: pick your station (Hot, Cold, Pass & pastry). Tap a mise en place row once for **DO**, twice for **ready**, and **!** flags it urgent for the whole kitchen. You get a to-do list with comments, notes left for tomorrow's shift, repeating tasks (like ordering bread on Sun/Tue/Thu), event prep, and a daily brief with urgent items, coming events, who's on and the whiteboard. Every "Done" has an Undo.
- **Orders**: each station marks Low / Out; the Orders tab combines them into one copyable list next to the whiteboard photo.
- **Schedule**: your own week at a glance plus the full rota, using the same shift codes as the spreadsheet. The head chef sets shifts with a few taps.
- **Events**: calendar, countdowns, the food (linked recipes open already scaled to the guest count) and a prep list that lands on each station's Today on the right day.

## Two ways to run it

### 1. Stand-alone site (this repo)

Open `index.html` through any static web server, for example GitHub Pages, or locally:

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

It starts with the book's 52 recipes, the stations' mise en place lists and the rota codes from `data/`. Everything you change is **saved in that browser only**. Settings → Backup exports and imports a file. Settings → Start over restores the original book. "Add to home screen" on a phone gives it an app icon.

### 2. Shared, inside Claude (for the team)

The same code runs as a Claude artifact with a live shared database: every cook sees ticks, tasks and orders as they happen. Build the single-file page with:

```sh
node tools/build.mjs   # writes dist/komat-kitchen-book.html
```

Publish it as an artifact with these capabilities: `db` (rules below), `assets`, `user` (scope `profile`) and `sample`. The artifact version holds no recipes in the page; they live in its database.

| Path | Who can write |
| --- | --- |
| everything (`prep`, `checks`, `orders`, `boards`, `bugs`) | anyone with Contributor access |
| `recipes`, `settings`, `schedules`, `events` | Editors and the owner (the head chef) |

## Data

The collections and fields are the same as the first version of the book (`recipes`, `settings/{branding,checklists,staff,shiftcodes}`, `checks`, `prep`, `orders`, `boards`, `schedules`, `events`, `bugs`), plus `settings/kitchen` for the order deadline, repeating tasks and products to check daily. So this version can run on top of the existing live data.

The repo is public, so `data/` only holds recipes, mise en place lists and shift codes. Staff names, rotas, events, problem reports and the team photos stay in the private shared database and are not committed.

## Code

Plain HTML, CSS and JavaScript with no dependencies or build step for the site.

```
index.html          site entry
css/app.css         all styles (light and dark)
js/core.js          DOM helper, dates (the kitchen day runs to 4 am), quantities, toasts, icons
js/allergens.js     allergen detection (English + Bulgarian)
js/store.js         storage: Claude database or this browser, one API
js/data.js          live data, recipes model, stations, tasks, orders, rota, events
js/timers.js        timers found in method text
js/app.js           boot, routing, header, tab bar
js/recipes.js       list, recipe pages, scaling, cook mode
js/editor.js        recipe editor, recipe-sheet scanning, list sync
js/today.js         Today, stock check, list editor
js/orders.js        Orders
js/schedule.js      Schedule
js/events.js        Events
js/admin.js         settings, kitchen rules, branding, problem reports
data/*.js           starting data for the site
tools/build.mjs     builds the single-file artifact page
```
