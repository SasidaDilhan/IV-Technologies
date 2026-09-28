import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

/**
 * Assemble the folder that goes to the client.
 *
 * The file list comes from git rather than a hand-written pattern: anything
 * tracked is source, anything ignored is generated or machine-specific. That
 * keeps node_modules (512 MB, and its database engine is built for THIS
 * machine) and the build output out of the package automatically.
 *
 * The database is taken from handover/dev.db - run `npm run db:handover`
 * first to build it.
 *
 *   npm run package              first install for a new client
 *   npm run package -- --no-db   an UPDATE for a client who already has data
 *
 * Always use --no-db for updates. Without it the package carries a database,
 * and copying it over a working installation would replace that client's
 * customers and bills with an empty one.
 */

const OUT_NAME = "IV-Technology-Billing";
const UPDATE_NAME = "IV-Technology-Billing-UPDATE";

const START_HERE = `IV TECHNOLOGY BILLING SYSTEM
============================

Setting up on this computer (do this once)
------------------------------------------

1. Install Node.js if it is not already installed.
   Download the "LTS" version from  https://nodejs.org
   Accept all the defaults.

2. Double-click:

       INSTALL.bat

   It will take a few minutes. Leave it alone until it says
   "Setup finished".

3. Double-click:

       START.bat

   The billing system opens in your browser.


Using it every day
------------------

Double-click  START.bat

Leave the black window open while you are billing.
Closing that window stops the system.

To have it start by itself when the computer turns on:
  - Press the Windows key + R
  - Type:  shell:startup
  - Press Enter, then put a SHORTCUT to START.bat in that folder.


First things to set up
----------------------

1. Open "Settings" and check the business details, logo and
   terms are correct.

2. Open "Items" and add what you sell, with prices. Turn on
   "Track serial numbers" for cameras, DVRs and hard disks.

3. Open "Stock intake" and scan in the serial numbers you
   have in stock.

You are then ready to bill.


Your data
---------

Everything lives in one file:  prisma\\dev.db

A backup is taken automatically a minute after anything is
saved, and every time you start the system, into the
"backups" folder. You do not need to do anything.

IMPORTANT: keep a second copy off this computer. Open
Settings -> Backups, enter a folder on another drive, a USB
stick or Google Drive, and press "Save folder". Every backup
is then saved in both places.

To put a backup back: close the system, double-click
RESTORE.bat, press Enter for the newest backup, type YES.

Full instructions are in README.md.
`;

const HOW_TO_UPDATE = `UPDATING IV TECHNOLOGY BILLING
=============================

This folder contains program files only. It has no customer
data in it, so it cannot overwrite anything you have entered.

To apply it:

1. Close the billing system (close the black window).

2. Copy everything in this folder over the client's existing
   installation folder, replacing files when asked.

3. Double-click:  UPDATE.bat

   It backs up first, updates the database structure, and
   rebuilds. Customers, quotations, invoices and stock are
   all kept.

4. Start the system again with  START.bat

If anything goes wrong, close the system and double-click
RESTORE.bat - it puts back the backup taken in step 3.


Backups
-------

Backups are now automatic: one is taken a minute after anything
is saved (items, estimates, invoices, payments, stock), as well
as every time the system starts.

In Settings -> Backups, choose a second folder (another drive, a
USB stick or Google Drive) so every backup is also saved there.

To put a backup back: close the system, double-click RESTORE.bat,
press Enter for the newest backup, and type YES.
`;

function main() {
  const includeDb = !process.argv.includes("--no-db");
  const root = process.cwd();
  // Name the folder for what it is - nobody should have to remember which
  // copy is safe to drop onto a live installation.
  const outRoot = path.resolve("handover", includeDb ? OUT_NAME : UPDATE_NAME);

  // Start clean so a re-run never leaves stale files behind.
  fs.rmSync(outRoot, { recursive: true, force: true });
  fs.mkdirSync(outRoot, { recursive: true });

  const files = execSync("git ls-files", { encoding: "utf8" })
    .split("\n")
    .map((f) => f.trim())
    .filter(Boolean);

  let bytes = 0;
  for (const rel of files) {
    const from = path.join(root, rel);
    if (!fs.existsSync(from)) continue;
    const to = path.join(outRoot, rel);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
    bytes += fs.statSync(from).size;
  }

  fs.writeFileSync(
    path.join(outRoot, includeDb ? "START-HERE.txt" : "HOW-TO-UPDATE.txt"),
    includeDb ? START_HERE : HOW_TO_UPDATE,
    "utf8",
  );

  let dbNote = "no database - safe to copy over a working installation";
  if (includeDb) {
    const src = path.resolve("handover", "dev.db");
    if (!fs.existsSync(src)) {
      throw new Error(
        "handover/dev.db is missing. Run `npm run db:handover` first, " +
          "or pass --no-db.",
      );
    }
    const dest = path.join(outRoot, "prisma", "dev.db");
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    bytes += fs.statSync(src).size;
    dbNote = `prisma/dev.db (${Math.round(fs.statSync(src).size / 1024)} KB)`;
  }

  console.log(`Package built:\n  ${outRoot}\n`);
  console.log(`  ${files.length} source files`);
  console.log(`  ${dbNote}`);
  console.log(`  ${includeDb ? "START-HERE.txt" : "HOW-TO-UPDATE.txt"} for the client`);
  console.log(`  ${(bytes / 1_000_000).toFixed(1)} MB total\n`);
  console.log("Excluded automatically (git-ignored):");
  console.log("  node_modules  - rebuilt by install-pos.bat on their machine");
  console.log("  .next         - rebuilt by install-pos.bat");
  console.log("  backups       - theirs start fresh");
}

try {
  main();
} catch (e) {
  console.error("FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
}
