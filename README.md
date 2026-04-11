# Uptrack

A locally hosted, browser-based work impact tracking application for senior
managers. Uptrack captures accomplishments with minimal friction, organizes
them across daily, weekly, monthly, and annual horizons, and prepares
structured exports for performance reviews and external AI-assisted
narrative development.

Everything is local. No cloud services, no accounts, no tracking, no
telemetry. All data lives in your browser's IndexedDB on this machine.

## Running

Uptrack is plain HTML/CSS/JS — no build step, no package installation, no
server process.

### Primary: open `index.html` directly

Double-click `index.html` — or drag it onto a browser window — and Uptrack
runs from the `file://` origin. That's it. Nothing listening on a port,
nothing installed, nothing to uninstall.

**Browser guidance:**

| Browser                       | Status                                                                    |
| ----------------------------- | ------------------------------------------------------------------------- |
| **Firefox** (any recent)      | Recommended. Shares a single `file://` origin, IndexedDB persists cleanly.|
| **Edge / Chrome** (89+)       | Works, but test persistence first — see the sanity check below.           |

On first run Uptrack performs an automatic IndexedDB round-trip probe. If
your browser cannot persist data reliably on `file://`, Uptrack will refuse
to start and show a "Storage check failed" banner rather than silently lose
your work.

### Developer fallback: `serve.py`

If you hit a browser-specific `file://` persistence problem and need a
localhost origin to fall back to, a tiny Python static server is included:

```bash
python3 serve.py
```

**Do not run this on a managed or shared workstation.** It exists purely for
local development and recovery. See "Enterprise deployment" below.

## Enterprise deployment

Uptrack is designed so that IT and security teams have as little to object
to as possible. When you run it the `file://` way:

- **No listening sockets.** Nothing is bound to any port. EDR tools will not
  see a Python (or any other) process opening a server.
- **No installers.** The app is six directories of static text files. No
  registry entries, no service accounts, no auto-start.
- **No network traffic.** Uptrack never makes an outbound request at runtime.
  This is enforced at two layers:
  - The JavaScript has no `fetch`, `XMLHttpRequest`, service workers, or
    module imports that would touch the network.
  - `index.html` ships with a `Content-Security-Policy` meta tag whose
    load-bearing directive is `connect-src 'none'` — the browser itself will
    refuse any network call the app might attempt.
- **No third-party dependencies.** Zero npm packages, zero CDN references,
  zero external fonts or icons.

### Data classification

The data Uptrack stores is HR-adjacent: performance management actions,
retention events, advocacy for direct reports, people-management logs. Many
organizations classify this content as restricted even when it lives on a
personal machine. Before using Uptrack for real work, confirm with your HR
and Security teams that a local-only, unencrypted-at-rest browser database
is compatible with your employer's data-handling policy. If your laptop has
full-disk encryption (BitLocker / FileVault) and is single-user, most
policies are satisfied; shared / VDI / jump hosts generally are not.

### Backup cadence

Because `file://` IndexedDB can be cleared by browser cleanup, profile
resets, or browser updates, **the full-backup export is your durability
plan, not a nice-to-have**.

- Minimum: take a full backup every **14 days**. Uptrack will show a loud
  amber "Backup overdue" card on the Settings view once you cross that
  threshold.
- Recommended: take a backup weekly, or before any major Edge/Chrome version
  bump.

**Settings → Backup & restore → Download full backup** produces a single
timestamped JSON file. Store it wherever your other personal archive lives
(encrypted external drive, approved OneDrive/GDrive area, etc.).

## Data storage

All data is persisted to IndexedDB in the browser under the database name
`uptrack`. Object stores:

- `entries` — daily impact entries
- `peopleLogs` — monthly people-management logs
- `taxonomyNotes` — your personal reference notes per taxonomy item
- `settings` — single-value settings (e.g. `lastBackupAt`)

The data is tied to the browser profile and the directory you launched
`index.html` from (on Chromium-based browsers, file:// storage is
partitioned per-directory). To move to a new machine, download a full
backup and restore it on the other side.

**Important:** `file://` IndexedDB is not guaranteed to survive browser
cleanup or major version upgrades. Treat the backup export as your source
of truth.

## Design principles

- **Speed at capture.** The landing screen is a single text field: type a
  title, press Enter, the draft is saved. Metadata can be filled in later.
- **Nothing lost.** Drafts are visually distinct and surfaced prominently at
  the top of the landing screen.
- **Dark, calm, distraction-free.** Color is reserved for status and impact.
- **Data integrity first.** IndexedDB transactions, boot-time persistence
  probe, 14-day backup nag, full backups, and archiving instead of deletion.

## Keyboard shortcuts

| Key               | Action                                  |
| ----------------- | --------------------------------------- |
| `/`               | Focus the quick-capture field           |
| `Ctrl/Cmd + N`    | Open the full entry form                |
| `Esc`             | Close modal                             |

## Taxonomies

Every entry can be tagged from all three taxonomies simultaneously:

- **Company Values** — Security, People, Innovation, Transparency
- **Culture Tenets** — Stronger Together, Own The Outcome, Lead The Way
- **Principles** — Seek to Understand, Foster Pack Unity, Communicate with
  Candor, Protect and Delight, Be Accountable, Security First, Innovate to
  Advance, Listen Learn Teach, Speed and Quality

## Views

- **Today** — quick capture, active drafts, last 7 days
- **Weekly** — Friday-review summary, grouped by domain → impact
- **Monthly** — people-management log plus charts and entries
- **Annual** — full year charts, monthly rollup, people-log totals
- **Stakeholder** — audience-focused filter + export workflow
- **Settings** — backup nag, reference notes, review export, archive, backup

## Exports

- **General** — plain text grouped by domain → impact → date, plus CSV
- **Performance review** — grouped by company value → culture tenet
- **Full backup** — single JSON containing every entry, log, and note

## Project layout

```
index.html
css/styles.css
js/taxonomies.js    js/db.js          js/ui.js
js/filters.js       js/entry.js       js/charts.js      js/export.js
js/app.js
js/views/landing.js    js/views/weekly.js    js/views/monthly.js
js/views/annual.js     js/views/stakeholder.js   js/views/settings.js
serve.py  (developer fallback only — see "Enterprise deployment" above)
```
