# Hype exports and what reaches Firestore

For whoever builds the floor app's reader. All rows below are **made up**.

There are two layers: the files Hype's back office exports, and the Firestore documents that
`tools/hype-sync` writes from them. **The floor app reads only the Firestore documents**, and their
shape is fixed and tested. The Hype files have not been inspected yet (see the note in section 2).

## 1. Firestore documents (fixed)

### `hypesales/{YYYY-MM-DD}`

One document per day (the day in Sofia time). Rewritten whole, and only when its rows changed.

```json
{
  "day": "2026-11-22",
  "at": 1795367460000,
  "rows": [
    { "t": 1795343460000, "bill": "1040", "item": "Супа на деня",            "qty": 2,  "price": 9.5, "total": 19,  "op": "Примерен Оператор", "cust": "Примерен Гост" },
    { "t": 1795367110000, "bill": "1042", "item": "Вино Примерно бяло 0.75", "qty": 1,  "price": 48,  "total": 48,  "op": "Примерен Оператор", "cust": "" },
    { "t": 1795367160000, "bill": "1042", "item": "Минерална вода 0.75",     "qty": -1, "price": 6,   "total": -6,  "op": "Друг Оператор",     "cust": "" }
  ]
}
```

| field | type | meaning |
|---|---|---|
| `day` | string | `YYYY-MM-DD`, same as the document id |
| `at` | number | when the sync that wrote this ran, ms since 1970 |
| `rows[].t` | number | time of the sale, ms since 1970 (Hype's local time read as Europe/Sofia) |
| `rows[].bill` | string | bill number, as text exactly as Hype prints it |
| `rows[].item` | string | article name exactly as Hype gives it (only outer spaces trimmed) |
| `rows[].qty` | number | quantity; may be a fraction, and negative for a void or return |
| `rows[].price` | number | unit price; if the export has no price column, `total / qty` |
| `rows[].total` | number | line total; if the export has no total column, `price * qty` |
| `rows[].op` | string | operator; `""` if none |
| `rows[].cust` | string | customer; `""` if not set |

Notes for the reader:

- Rows are sorted by `t`, then `bill`, then `item`. There is **no row id** and no table number: the same
  item sold twice on one bill at the same second is two identical rows. Treat the document as the whole
  truth for the day and recompute from it, rather than adding up differences between versions.
- The same article can appear on several rows; match articles to wines by `item` text.
- A day's document appears with the first sync of that day, possibly with `rows: []`.
- Just after midnight (until 02:00 by default) the previous day's document is refreshed too.
- One document holds at most about 900 KB (several thousand rows); beyond that the sync reports an error
  in `hypesync/status` instead of writing.

### `hypestock/current`

Only if the stock export is switched on (`stock.enabled`). Rewritten whole, only when changed.

```json
{
  "at": 1795367460000,
  "rows": [
    { "item": "Вино Примерно бяло 0.75", "qty": 11,   "unit": "бр" },
    { "item": "Джин Примерен 0.7",       "qty": 0.35, "unit": "л" }
  ]
}
```

`item` as Hype names it, `qty` a number (may be a fraction or negative), `unit` as Hype writes it or `""`.
Sorted by `item`.

### `hypesync/status`

Written after **every** run, every 10 minutes by default.

```json
{ "at": 1795367460000, "ok": true, "rows": 3, "err": null }
```

| field | meaning |
|---|---|
| `at` | when the run happened, ms since 1970. Older than about 25 minutes means the feed is stale (laptop off, no internet) |
| `ok` | `true` if everything was downloaded and read |
| `rows` | number of rows in today's sales; `0` when the run failed |
| `err` | `null` when ok; `"login"` when the Hype login has expired (someone must sign in again on the laptop); otherwise a short English message |

When `ok` is `false` the sales and stock documents keep their last good content.

## 2. Hype's export files (NOT YET CONFIRMED)

> Nobody has looked at the real files for this document yet. What is known from the back office: the
> "Detailed sales data" report has CSV and XLS export buttons and gives one line per item sold with time,
> item, quantity, prices, operator, bill number and customer, and no table number. The header names,
> date format, separator and encoding below are **placeholders** that show what has to be filled in after
> the first `node hype-sync.mjs capture` (see `tools/hype-sync/README.md`, step 7). The reader in
> `tools/hype-sync/lib/parse.mjs` does not depend on them: column names, time format and decimal sign
> come from `config.json`; separator (`;` `,` tab) and encoding (UTF-8, UTF-16, Windows-1251) are detected.

Placeholder for "Detailed sales data" (CSV):

```csv
Time;Bill number;Item;Quantity;Price;Total;Operator;Customer
22.11.2026 12:31:00;1040;Супа на деня;2;9,50;19,00;Примерен Оператор;Примерен Гост
22.11.2026 19:05:10;1042;Вино Примерно бяло 0.75;1;48,00;48,00;Примерен Оператор;
22.11.2026 19:06:00;1042;Минерална вода 0.75;-1;6,00;-6,00;Друг Оператор;
```

Placeholder for the stock report (CSV), if Hype has one listing current quantities per article:

```csv
Item;Quantity;Unit
Вино Примерно бяло 0.75;11;бр
Джин Примерен 0.7;0,35;л
```

To fill in once the real files are seen:

| | sales | stock |
|---|---|---|
| exact header line | ? | ? |
| lines before the header (title, period) / after the data (totals) | ? | ? |
| date and time format | ? | n/a |
| decimal separator | ? | ? |
| field separator, quoting | ? | ? |
| encoding | ? | ? |
| request the export button makes (address, method, date parameters) | ? | ? |
| how the session is kept (cookie name only, never its value) | ? | ? |
