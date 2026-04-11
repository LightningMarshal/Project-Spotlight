# Uptrack

A locally hosted, browser-based work impact tracking application for senior
managers. Uptrack captures accomplishments with minimal friction, organizes
them across daily, weekly, monthly, and annual horizons, and prepares
structured exports for performance reviews and external AI-assisted
narrative development.

Everything is local. No cloud services, no accounts, no tracking. All data
lives in your browser's IndexedDB on this machine.

## Running

Uptrack is plain HTML/CSS/JS — no build step, no package installation. You
just need any simple local static file server.

### Option 1 — included Python server (recommended)

```bash
python3 serve.py
```

This serves the app on <http://localhost:8765/> and opens your browser. Use
`python3 serve.py 9000` to pick another port.

### Option 2 — any other static server

From the project directory, any of these work:

```bash
python3 -m http.server 8765
# or
npx http-server -p 8765
```

Then open <http://localhost:8765/>.

## Data storage

All data is persisted to IndexedDB in the browser under the database name
`uptrack`. Object stores:

- `entries` — daily impact entries
- `peopleLogs` — monthly people-management logs
- `taxonomyNotes` — your personal reference notes per taxonomy item
- `settings` — miscellaneous single-value settings

The data is tied to the browser profile. To move to a new machine, use
**Settings → Backup & restore → Download full backup** to export a JSON file
and restore it on the new machine.

## Design principles

- **Speed at capture.** The landing screen is a single text field: type a
  title, press Enter, the draft is saved. Metadata can be filled in later.
- **Nothing lost.** Drafts are visually distinct and surfaced prominently at
  the top of the landing screen.
- **Dark, calm, distraction-free.** Color is reserved for status and impact.
- **Data integrity first.** IndexedDB transactions, full backups, and
  archiving instead of deletion.

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
- **Settings** — reference notes, review export, archive, backup

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
serve.py
```
