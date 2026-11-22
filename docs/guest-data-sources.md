# Guest data sources for the floor app's Guests tab

Status: **partly verified, 22 Nov 2026.** This covers what the two vendors publish
(feature pages, integration pages, terms). The logged-in look at Komat's own accounts
through Claude in Chrome has **not** happened yet, because no Mac was connected to the
session. Everything that still needs that look is marked **To check in the account**
and collected in the checklist at the end.

No secrets, keys or guest data are in this file. It describes fields, not values.

## Summary

| | reservation.tools | Hype |
|---|---|---|
| Vendor | Reservation Ltd, Bulgaria | PRO SOFT AD, Bulgaria |
| Public API or developer docs | None published | None published; terms mention integrations "including through APIs", chosen by the vendor |
| Webhooks | Receives them from one POS (Barsy); none offered outward publicly | None published |
| Scheduled exports or report emails | None published | None published |
| Manual downloads | XLSX and PDF of any report, guest list or reservation window; customer database export | Not described publicly |
| Terms on scripts and bots | Forbidden on the site | Forbidden in the software, explicitly including scripts |

Neither vendor publishes a self-service way to pull data automatically, and both forbid
scripted access. So the route to a refresh every few minutes goes through a request to
each vendor, not through a scraper.

## reservation.tools

**1. API, key, webhook, integrations.**
No API documentation, API key page or developer page is published. The integrations it
advertises are all built by the vendor:

- POS: Barsy (Barsy pushes webhooks to reservation.tools; set up in the admin panel with
  the POS domain, user, password and provider ID), Rkeeper (orders matched to bookings by
  table code), and the vendor's own POS, Ordering.Tools.
- Booking channels: Reserve with Google, Facebook and Instagram, and marketplaces brought
  in by reading their confirmation emails from a connected Gmail inbox.
- Payments: Stripe and myPOS. Phone: a "Who's Calling" Android integration.

Hype is not on the list. **To check in the account:** whether the admin panel has an
integrations section with anything not advertised (API key, webhook URL, Hype).

**2. Scheduled exports or report emails.**
Nothing published. Staff get push notifications (web and mobile) per booking event,
configurable per user; guests get email and SMS. The pricing page lists "Notifications to
Staff" without saying whether email is a channel. **To check in the account:** whether
staff notifications can go by email, and whether any report can be emailed on a schedule.

**3. Manual downloads.**
"XLSX & PDF Exports" downloads any report, guest list or reservation window with the
on-screen filters (date range, channel, status, waiter, section) applied. XLSX has typed
columns and a totals row. "Export Customer Database" is included in every plan. The
public pages do not list the columns. Fields the system stores, by its own description:
booking date and time, party size, table and area, status (confirmed, seated, finished,
no-show, cancelled), source channel, comments and staff notes, and per guest: name,
phone, email, visit count, tags, notes, allergies and preferences, marketing consent.
**To check in the account:** the exact columns of the reservation export and the customer
export, and whether the booking has an ID column.

**4. Linking to a Hype bill.** See the section below.

**5. Terms on automated access.**
The terms of use forbid using "any robot, spider, other automated device, or manual
process to monitor or copy any content from the Site". The site sits behind Cloudflare
bot protection. The vendor claims no rights over content the venue uploads, and the
privacy policy describes the guest data as the venue's.

## Hype

**1. API, key, webhook, integrations.**
No API documentation is published. The Ecosystem page lists only the vendor's own
add-ons: website ordering, own delivery, call centre, QR menu, order-and-pay at the
table, payment terminals. No reservation system is listed. The software terms (updated
August 2026) say the software "may support integrations with third-party services,
including through APIs", that the company decides which exist, and that one is switched
on only at the venue's request. So an integration is something to ask for, not something
to configure alone. **To check in the account:** whether the back office has an
integrations or API section.

**2. Scheduled exports or report emails.**
Nothing published. Hype includes a mobile statistics app with real-time revenue, and it
backs the venue's database up to the vendor's servers every hour. **To check in the
account:** whether a daily closing report or sales report can be emailed automatically.

**3. Manual downloads.**
Not described publicly. The product shows bills per table with items, quantities, prices
and totals, the waiter, and opening time, so the data exists. Hype also has a customer
(CRM) function for its delivery and call-centre side. **To check in the account:** which
reports exist (bills, items sold, by table, by waiter), their export formats, their
columns (date and time opened and closed, table, items, quantities, prices, bill total,
waiter, covers), and whether a bill has a field for a guest or booking.

**4. Linking to a booking.** See the section below.

**5. Terms on automated access.**
The software terms say the user "must not use deep links, robots, bots, spiders,
automated devices, programs, scripts, algorithms, methods, or equivalent manual
processes to access, obtain, copy, or monitor any part of the Software", and forbid
reverse engineering. The website terms separately forbid automated agents, "including
AI-based agents", on the marketing site without written consent. A scheduled job logging
in to Hype would break these terms unless Hype agrees in writing.

## Linking a booking to a bill

There is no shared booking reference between the two systems today. The workable link is
**table plus time**:

- reservation.tools records the table and the seated and finished times of each booking.
- Hype records the table and the opening and closing times of each bill.
- Match a bill to the booking on the same table whose seated window overlaps the bill's
  open window. For walk-ins there is no booking, so the bill stays unlinked.

This is the same method reservation.tools already uses for Rkeeper ("table codes to match
orders with reservations"). It needs the table numbers to be identical in both systems,
and it gets unreliable when guests are moved without the booking being moved, or when
tables are combined. **To check in the account:** that table names match, and that staff
mark bookings as seated.

A cleaner link exists only if the vendors connect the systems: reservation.tools then
ties the bill to the booking itself and builds lifetime spend per guest, as it does for
its supported POS systems.

## Recommendation

Cheapest route, in order:

1. **Ask both vendors (free, two emails).** Both are Bulgarian and both already do this
   kind of integration.
   - reservation.tools: is there an API or outgoing webhook for bookings and guests, and
     can they connect to Hype the way they connect to Barsy and Rkeeper?
   - Hype: can they switch on an API or integration for Komat's bills (their terms
     provide for exactly this), or a scheduled report by email?

   If either says yes, the sync runs in the existing 10-minute GitHub Actions job: a
   second script beside `tools/notify/send.mjs` reads the API with a key held in GitHub
   secrets and writes to the Firebase database. No new cost, refresh every 10 minutes.
   An outgoing webhook is even simpler: it can post straight to a write-only path in the
   Firebase database, with no server.

2. **If only email is available: a dedicated mailbox.** If reservation.tools can email
   staff per booking, or Hype can email a daily report, send those to one mailbox and let
   the 10-minute job read it. Bookings would be near-live, bills daily. Free.

3. **If neither: a daily manual upload.** Once a day someone downloads the reservation
   XLSX from reservation.tools and the bills report from Hype and drops both into an
   import screen in the floor app, which matches them by table and time. About two
   minutes a day, free, and within both vendors' terms.

Not recommended: a script that logs in to either site with a staff account. Both sets of
terms forbid it, reservation.tools is behind bot protection, and Hype may suspend access.

For the Guests tab itself, bookings and guest contact details matter most and bills are
enrichment, so step 3 for reservation.tools alone already gives a useful tab.

## Checklist for the logged-in look (Claude in Chrome, read only)

reservation.tools admin:
- [ ] Settings: any integrations, API, webhook or POS section, and what it offers
- [ ] Staff notification settings: is email a channel, and which fields are in the message
- [ ] Reports: any scheduling or email option
- [ ] Reservation export and customer export: column names, booking ID present or not
- [ ] Table names as configured on the floor plan

Hype back office:
- [ ] Settings: any integrations, API or export section
- [ ] Reports list, export formats and column names for bills and items sold
- [ ] Any automatic email of the daily closing or sales report
- [ ] Whether a bill carries a guest, customer or booking field
- [ ] Table names as configured

## Sources

Public pages read on 22 Nov 2026: reservation.tools home, features (including the pages
for XLSX and PDF exports, Barsy and Rkeeper integrations, guest spending analytics,
customer database, notifications, waiter sections), pricing, how-to index, terms of use,
privacy policy; hype-software.com home, ecosystem, pricing, FAQ, migration, software
terms, software privacy policy, website terms.
