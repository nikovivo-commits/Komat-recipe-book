# Komat Back Office

One place for the restaurant's daily admin: what is on the shelves, what needs ordering, sending orders to suppliers by email, and how busy the coming week is.

## What it does

| Screen | What you do there |
| --- | --- |
| **Today** | See what is out (86'd) or low, which suppliers to order from today, deliveries due, covers booked, and recent supplier mail. |
| **Stock** | Tap − / + to adjust, or run a **stock count** location by location (Enter jumps to the next box). Add items, import from Hypersoft, export to CSV. |
| **Orders** | Suggested orders per supplier, rounded to whole packs (cases, sacks, trays). Edit lines, then **Send with Gmail**, save a Gmail draft, open in your email app or copy the text. When the delivery arrives, **Check in** to add what arrived to stock. |
| **Bookings** | Covers per day for the next 14 days. Add bookings by hand or import a CSV from the reservation system. |
| **Inbox** | Supplier replies, order confirmations, invoices and booking emails from your Gmail. |
| **Setup** | Restaurant details, order email wording, a copy-to address for every order, busy-week settings, backups. |

### How an order is worked out

- Every item has a **par level**: how much you want on the shelf after a delivery.
- When **on hand + already on order** drops to the **reorder point**, the item is suggested. The reorder point is 40% of par unless you set one.
- The suggestion tops the item up to par and rounds up to whole packs: 9 bottles on hand with par 24 in cases of 6 gives 3 cases.
- **Busy weeks:** set how many covers a normal week has. When more are booked for the next 7 days, par levels are raised to match, capped at ×1.5 by default. Quiet weeks never lower an order below par.
- Suppliers have order days, an order cut-off time, days until delivery and a minimum order value. The app tells you who to order from today and warns when an order is under the minimum.

## Two ways to run it

1. **On claude.ai (recommended for the team).** The published page keeps stock, orders and bookings in a shared database, so everyone the page is shared with sees the same numbers, live. Orders go out from your own Gmail through the claude.ai Gmail connector. Each person connects their own Gmail, and nobody sees anyone else's inbox.
2. **As a plain web page** (GitHub Pages, or any static file host): open `ops/index.html` through a web server. Everything works except Gmail. Data is saved in that browser only, so use Setup → Export backup to move it. Orders open in your email app instead.

## Connecting your existing tools

**Hypersoft (stock, prices).** In Hypersoft, export the article list or stock list (Artikelliste / Lagerbestand) to CSV. If it comes out as Excel, use *Save as → CSV*. Then go to Stock → Import. Columns are recognised by name in English, German or Finnish: `Artikel`/`Bezeichnung`, `Art.-Nr.`, `Warengruppe`, `Lagerort`, `Einheit`, `Bestand`/`Istbestand`, `Sollbestand`, `Mindestbestand`, `EK-Preis`, `VK-Preis`, `Lieferant`. You can change the column matching before importing. Re-importing updates items with the same name, and suppliers named in the file are created automatically.

**Reservation system.** Export bookings as CSV (date, time, name, number of guests) and import them under Bookings. Tick *Replace earlier imported bookings* when re-importing the same export, so bookings are not counted twice. Booking confirmation emails also show up in the Inbox. Under Setup → Email searches you can narrow that list to your booking tool's sender address.

**Business email.** On claude.ai, add Gmail under Settings → Connectors with the business account, then press *Connect Gmail* in the Inbox. Put your business address in Setup → *Send a copy of every order to* so every order also lands in the shared inbox.

## Data and privacy

- No restaurant data is stored in this repository. It is public, so keep it that way: back up through *Export backup*, not by committing files.
- The example kitchen (Setup → Load example data) is clearly marked and uses `example.com` supplier addresses, so nothing can be emailed by accident. *Remove examples* deletes all of it at once.

## Development

No build step and no dependencies: plain HTML, CSS and JavaScript.

```
ops/
  index.html        app shell
  styles.css        design tokens (light + dark) and components
  js/logic.js       pure business rules: stock status, order suggestions, CSV import, order email text
  js/store.js       storage: claude.ai shared database, or browser localStorage
  js/connect.js     Gmail connector and file downloads
  js/sample.js      the example kitchen
  js/app.js         screens and interactions
  tests/            unit tests for logic.js
  tools/build-page.js  builds the claude.ai page version
```

```sh
node --test ops/tests/*.test.js         # unit tests
python3 -m http.server -d ops 8000      # run locally at http://localhost:8000
node ops/tools/build-page.js ops/build  # page version for claude.ai
```
