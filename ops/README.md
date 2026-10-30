# Komat Back Office

One place for the restaurant's daily admin: what is on the shelves, what the kitchen needs, what to order and from whom, the wine list for the floor, how busy the coming days are, and the business email.

It sits next to the tools Komat already uses and reads from them instead of replacing them:

- **Hype** (hype-software.com): deliveries and sales are entered there, so Hype is the record of stock. Its stock report updates the counts here, and its sales report fills in wine and drink sales.
- **reservation.tools**: its booking export and booking emails fill the covers calendar.
- **Komat Kitchen Book**: the stations' Out / Low order checks become order lines, its events count as covers, and its recipe products can be added to the stock list.
- **Gmail**: orders go out from the business address; supplier replies, invoices and booking emails show under Office.
- **The daily cash report** (Google Sheet, one tab per day with НАЧАЛО, РАЗХОДИ, ПРИХОДИ, ОСТАТЪК): read through Google Drive and shown under Office → Cash.

## Screens

| Screen | What you do there |
| --- | --- |
| **Today** | What is out (86'd) or low, which suppliers to order from today, what the kitchen asked for, deliveries due, covers booked, bar takings and supplier mail. |
| **Stock** | **Update from Hype** (stock report, CSV or Excel), stock counts location by location, − / + adjustments, items from the Kitchen Book. |
| **Orders** | Suggested orders per supplier, rounded to whole cases, sacks or trays, including everything the kitchen asked for. Send with Gmail, save a Gmail draft, open in the email app or copy the text. Check deliveries in. |
| **Bar** | **Wine list** for the floor: style, vintage, bottle and glass price, bottles and glasses left, gross profit after VAT. **Sales** per wine and drink from Hype's sales report. **Quick sell** buttons for drinks that don't go through Hype. |
| **Bookings** | **Calendar**: covers per day for 14 days from reservation.tools exports, hand entries and Kitchen Book events. **Guests**: the guest book (below). |
| **Office** | **Cash**: the daily cash report: cash left, cash out and in per day, where the cash went this month. **Invoices**: invoice emails from your suppliers. **Mail**: supplier replies, orders and booking emails. |
| **Setup** | Restaurant details, order email wording, copy-to address, VAT for margins, busy-week settings, backups. |

### How orders are worked out

- Every item has a **par level**: how much you want after a delivery. When **stock + already on order** drops to the **reorder point** (40% of par unless you set one), the item is suggested, topped up to par and rounded up to whole packs.
- When a Kitchen Book station marks a product **Out** or **Low**, it goes on that product's supplier order even if the count says otherwise, until an order with it has been sent.
- **Busy weeks:** when more covers are booked for the next 7 days than in a normal week, par levels are raised to match (×1.5 at most by default). Quiet weeks never lower an order below par.

### Wines and drinks

- A **wine** is counted in bottles and sold by the bottle and, if it has a glass size, by the glass: a 15 cl glass from a 75 cl bottle is 0.2 of a bottle. The wine list shows the open bottle too ("4 btl + 3 gl").
- A **drink sold per piece** (soft drinks, water, juice) is one bottle or can per sale.
- Hype's sales report is matched article by article to wines (bottle or glass) and drinks, and the choices are remembered. Food lines are marked as not tracked once. By default the import does not take stock off again, because Hype's stock report already did.

### The guest book

- Guests are recognised by **phone number**, however it was typed: 0888 123 456, +359 888 123 456 and 00359888123456 are the same guest (Setup sets the country code for numbers written without one).
- Each **visit** records the date, covers, what they had (dishes from the Kitchen Book menu, wines by bottle or glass, drinks, or anything typed in), the bill total and a note.
- A booking from a known number shows **"4th visit · last time 24 Oct: beef tartare, Rioja Reserva"** and the guest's notes (allergies, favourite table). **Today** lists the guests to know about tonight.
- **What they had** on a booking records that visit. **From bookings** builds guests and past visits from every booking that has a phone number.
- Guest details are personal data: the page keeps them readable only for people the page is shared with as Contributor or Editor, records whether the guest agreed, and deleting a guest deletes all their visits.

### How stock is kept

A count (a stock count, an update from Hype, or a figure typed on an item) sets an item's stock outright. Everything after that (− / + taps, quick sales, deliveries checked in) is a movement saved by the device that made it, so two phones changing stock at the same moment never overwrite each other. Stock shown = last count + movements since. Movements older than a month are folded into the count automatically.

## Two ways to run it

1. **On claude.ai (for the team).** The published page keeps everything in a shared database, live for everyone the page is shared with. Gmail works through each person's own claude.ai Gmail connector.
2. **As a plain web page** (GitHub Pages or any static host): open `ops/index.html` through a web server. Everything except Gmail and the cash report works, and data stays in that browser (Setup → Export backup to move it).

The cash report is read with each viewer's own Google Drive connection, so it shows for people who can open that Google Sheet. The app only reads it.

## The Kitchen Book link

A claude.ai page cannot read another page's database, so the Kitchen Book data is copied into this app's `kitchen` collection by Claude (on request or on a schedule): `kitchen/products` (products used in the recipes), `kitchen/req-<date>_<station>` (station order checks), `kitchen/ev-<id>` (events) and `kitchen/meta` (when it was copied).

## Data and privacy

No restaurant data is stored in this repository; it is public. The example kitchen (Setup → Load example data) is marked as such and uses `example.com` supplier addresses, so nothing can be emailed by accident.

## Development

No build step and no dependencies. Excel files are read with SheetJS, loaded from cdnjs only when an Excel file is picked.

```
ops/
  index.html        app shell
  styles.css        design tokens (light + dark) and components
  js/logic.js       business rules: stock status, movements, order suggestions, wines and drinks,
                    imports (Hype stock and sales, bookings), Kitchen Book data, order email text
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
