# IV Technology Billing

Quotations, invoices and serial-number tracking for IV Technology's CCTV
installation business.

Next.js 14 (App Router) + Prisma + SQLite. The whole system is one folder and
one database file — no server, no internet connection needed to bill.

---

## Setting it up on a new computer

Copy the whole project folder onto the machine, then run
**`scripts/install-pos.bat`** once. It installs dependencies, prepares the
database, builds the system, and takes a first backup. Node.js 20 or newer must
be installed first (https://nodejs.org).

## Running it day to day

Double-click **`scripts/start-pos.bat`**. It takes a backup, starts the system,
and opens the browser at the till screen.

Leave the black window open while billing. Closing it stops the system.

To make it start when the shop computer boots: press `Win+R`, type
`shell:startup`, and put a shortcut to `start-pos.bat` in the folder that opens.

The system runs at **http://localhost:3000**.

---

## How the screens fit together

| Screen | What it is for |
| --- | --- |
| **Billing** (`/`) | The till. Scan or search, build a quotation, save or print it. |
| **History** (`/quotations`) | Every quotation, and the search that answers "who has this camera?" |
| **Invoices** (`/invoices`) | Confirmed jobs, what is owed, and payments received. |
| **Customers** (`/customers`) | Everyone billed, and everything they have ever bought. |
| **Items** (`/items`) | The catalog: models, prices, and which ones carry serial numbers. |
| **Stock intake** (`/stock`) | Log serial numbers as units arrive. |
| **Settings** (`/settings`) | Business details, logo, document numbering, terms template. |

### The billing flow

1. **Quotation** — pick the customer by phone, add models and quantities, print
   the estimate. A quotation prices a *model*; it does not reserve stock, so two
   quotations can offer the same cameras.
2. **Customer confirms** — open the quotation and press **Convert to invoice**.
   Choose the exact serial numbers going out, record the advance, and the
   invoice is raised. Those units are now marked sold.
3. **Payments** — log each payment on the invoice as it comes in. The balance
   updates itself and the invoice shows *unpaid*, *part paid* or *paid*.

### Document numbering

Quotations and invoices count separately, each with its own prefix, set in
**Settings**. Quotations continue the existing paper series (`001253`, `001254`,
…); invoices run `INV-000001` onwards. The system refuses to reuse a reference
that has already been issued.

---

## Backups

**The entire system's data is one file: `prisma/dev.db`.** Copying that file is
the whole backup.

`start-pos.bat` backs up automatically on every start. To run one by hand:

```
npm run db:backup
```

Backups land in `backups/`, named by date and time, and the last 30 are kept.

Send them somewhere off the machine — a dated folder on Google Drive or a USB
stick. A backup sitting on the same disk as the original protects against
mistakes, not against the disk dying:

```
npm run db:backup -- --dir "D:/Google Drive/IV Technology backups"
npm run db:backup -- --keep 60
```

The backup uses SQLite's own snapshot command, not a file copy, so it is safe
to run while someone is billing. Every backup is opened and read back before it
is reported as successful.

### Restoring

1. Stop the system (close the black window).
2. Rename the current `prisma/dev.db` to `dev.db.broken` — do not delete it.
3. Copy the backup you want into `prisma/` and rename it `dev.db`.
4. Start the system again and check the last few invoices look right.

---

## Shipping updates to a client

The system runs on the shop's own machine, so an update means getting new
program files onto that machine and rebuilding. Two ways, both safe:

### Git (recommended once set up)

One-time, on your machine:

```
git remote add origin git@github.com:YOUR-ACCOUNT/iv-technology-billing.git
git push -u origin master
```

Use a **private** repository — the code carries the client's terms, logo and
business details.

One-time, on each shop machine: clone the repo instead of copying a folder,
then run `scripts\install-pos.bat`. For read-only access without putting your
GitHub password on their computer, add a **deploy key** (GitHub → repo →
Settings → Deploy keys) generated on that machine.

From then on, shipping a change is:

1. Commit and push here
2. They double-click `scripts\update-pos.bat`

The script pulls, migrates, rebuilds. It refuses to pull if someone has edited
the program files locally, rather than overwriting their changes.

### Copying a folder (no GitHub needed)

```
npm run package -- --no-db
```

Builds `handover/IV-Technology-Billing-UPDATE`. Send it, they copy it over
their folder and run `scripts\update-pos.bat`.

**Always use `--no-db` for an update.** Without it the package carries a
database, and copying that over a working installation would replace their
customers and bills with an empty one.

### What an update cannot break

`prisma/dev.db`, `.env` and `backups/` are git-ignored, so they are in neither
a pull nor an update package. `prisma migrate deploy` only applies migrations
that have not run yet and never resets. And `update-pos.bat` takes a backup
before touching anything, refusing to continue if that backup fails.

Each client keeps their own database, so their settings, logo, numbering and
history are untouched by an update.

---

## For whoever maintains this

```
npm run dev          Development server with hot reload
npm run build        Production build
npm run start        Run the production build
npm run db:studio    Browse and edit the database directly
npm run db:seed      Reset the database to the seeded starting point (DESTRUCTIVE)
npm run db:backup    Take a verified snapshot
```

Building while a dev server is running would overwrite the files it is serving.
Build somewhere else instead:

```
NEXT_DIST_DIR=.next-build npm run build
```

### Things worth knowing before changing anything

- **Money is stored as whole cents**, never as a decimal. SQLite has no true
  decimal type and floats lose money. Use the helpers in `src/lib/money.ts`.
- **Discounts** are a `(type, value)` pair: cents for a fixed amount, basis
  points for a percentage (`1000` = 10.00%).
- **Balance due and paid/unpaid are calculated, never stored.** They are derived
  from the payment rows, so they cannot fall out of step with them.
- **A quotation snapshots its own prices and terms.** Changing a catalogue price
  or the terms template never alters a document already issued.
- Statuses are plain text, not database enums — SQLite does not support them.

The transactional logic lives in `src/lib/` (`quotations.ts`, `invoices.ts`,
`settings-save.ts`) rather than in the server actions, so it can be exercised
directly without a running server.

---

## Before handing over to the client

- [ ] Fill in **Settings** with the real business details and logo
- [ ] Replace the placeholder serial numbers (`SN-CAM-0001`…) with the real
      numbers off the boxes, via **Stock intake**
- [ ] Check the quotation and invoice numbering starts where their paper left off
- [ ] Print one estimate and one invoice and compare against their old ones
- [ ] Set up the backup folder somewhere off the machine
- [ ] Put `start-pos.bat` in the Startup folder and reboot to confirm
- [ ] Do one full dry run with the client watching: real customer, real items,
      real serials, generate the PDF, confirm, log the advance
