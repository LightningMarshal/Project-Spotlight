# Uptrack

**v2.9.0**

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

- `entries` — daily impact entries (with domain-specific fields for People
  Management, Client Facing, and Project domains)
- `peopleLogs` — monthly people-management reflections
- `taxonomyNotes` — reference notes per taxonomy item
- `settings` — roster, theme preference, reward toggles, `lastBackupAt`

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

## Domains

Each entry belongs to one of four domains, with domain-specific fields:

- **Operations** — no additional fields
- **Project** — project number, project URL
- **People Management** — interaction type, meeting direction, individual
  (from roster), sentiment, development theme, follow-up action with
  description and target date
- **Client Facing** — interaction type, company name, individual, customer
  sentiment, conditional escalation number/URL (when dissatisfied)

## Views

- **Today** — quick capture, active drafts, last 7 days
- **Weekly** — Friday-review summary, grouped by domain → impact
- **Monthly** — auto-aggregated people management summary with charts,
  monthly reflection, and entries
- **Annual** — full year charts, monthly rollup, people-log totals
- **Data Review** — consolidated visualizations (8 chart cards) and
  Individual Manager View with sentiment trajectory, development themes,
  interaction types, and follow-up actions per person
- **Follow-Ups** — dedicated tracker for open follow-up actions sorted by
  target date, with dismiss/reopen controls and dismissed toggle
- **Settings** — roster management (direct/indirect/leadership), theme
  toggle, audio/confetti toggles, performance review export, archive,
  backup & restore
- **Stakeholder** — audience-focused filter + export workflow (accessible
  via `#/stakeholder`)

## Exports

- **General** — plain text grouped by domain → impact → date, plus CSV
- **Obsidian** — markdown with YAML frontmatter, structured headings, and
  hash tags (`#domain/*`, `#impact/*`, `#value/*`, `#tenet/*`, `#principle/*`)
- **Performance review** — grouped by company value → culture tenet
- **Full backup** — single JSON containing every entry, log, and note

## Project layout

```
index.html
css/styles.css
js/taxonomies.js    js/db.js          js/ui.js
js/filters.js       js/entry.js       js/charts.js      js/export.js
js/rewards.js       js/app.js
js/views/landing.js    js/views/weekly.js    js/views/monthly.js
js/views/annual.js     js/views/stakeholder.js   js/views/datareview.js
js/views/followups.js  js/views/settings.js
serve.py  (developer fallback only — see "Enterprise deployment" above)
```

## Changelog

### v2.9.0
- Three togglable visual theme packs, each with full dark/light/system
  modes:
  - **Arctic Wolf** (default) — enhanced amber-on-navy with gradient
    brand text, radial background, glow-on-press primary buttons,
    layered card shadows
  - **Futuristic** — cyan/magenta neon on near-black with grid
    backdrop, glowing borders, glassy surfaces, backdrop blur on
    topbar, JetBrains Mono headings
  - **Minimal** — restrained typography with hairline borders, no
    shadows, wider whitespace, generous content width reduction,
    underline-only active nav
- System-preference light/dark mode: new "Follow system" option uses
  `prefers-color-scheme` media query per theme pack
- Settings: theme pack dropdown + mode dropdown replace the old dark
  mode toggle
- Legacy `theme` setting automatically migrates to new `themeMode`

### v2.8.0
- Confetti upgrade: multicolor cannon burst with 180 particles, varied
  shapes (rectangles, circles, streamers, stars), wobble, drag, and
  fade-out
- Synthesized sound library with 6 reward chime themes: Ascending Chime
  (default), Bright Bell, Fanfare, Soft Ding, Level Up, Success Chord.
  All synthesized via Web Audio API — no external files, no copyright
  concerns, no CSP impact
- Settings: sound theme dropdown with preview button, confetti preview
  button

### v2.7.0
- Obsidian-compatible markdown export with YAML frontmatter and hash tags
- Export button added to Weekly, Monthly, Annual, and Stakeholder views

### v2.6.0
- Follow-Up Action Tracker tab with overdue/upcoming/no-date grouping
- Dismiss/reopen controls and toggle for dismissed items

### v2.5.0
- Data Review tab with 8 consolidated visualization chart cards
- Individual Manager View: sentiment trajectory, development themes,
  interaction types, follow-up actions, and recent entries per person

### v2.4.0
- Monthly view auto-aggregates People Management entries instead of
  manual metric input; added monthly reflection textarea

### v2.3.0
- Client Facing domain with interaction type, company name, individual,
  customer sentiment, conditional escalation number/URL
- Domain-specific conditional fields in entry form (People Management,
  Client Facing, Project)

### v2.2.0
- Settings overhaul: roster management (direct/indirect/leadership),
  dark/light mode toggle, audio chime and confetti toggles
- Removed taxonomy notes from Settings

### v2.1.0
- Arctic Wolf tagline on Today page
- Audio chime (Web Audio API) and confetti burst on save-as-complete

### v2.0.0
- Arctic Wolf brand identity: deep navy backgrounds, amber-orange accent,
  geometric sans-serif headings, light/dark mode via CSS custom properties
- Chart colors updated to amber spectrum

### v1.1.1
- Fix: search input no longer loses focus when typing (content-container
  pattern applied to all views)

### v1.1.0
- IndexedDB sanity check on boot with failure banner
- 14-day backup nag in Settings
- Content-Security-Policy meta tag with `connect-src 'none'`
- README with enterprise deployment guidance
- `serve.py` demoted to developer fallback

### v1.0.0
- Initial release: quick capture, drafts, daily/weekly/monthly/annual
  views, stakeholder export, performance review export, full backup/restore
