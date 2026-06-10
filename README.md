# Uptrack

**v2.17.0**

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
| `Alt + N`         | Open the full entry form                |
| `Alt + T`         | Go to Today                             |
| `Alt + W`         | Go to Weekly                            |
| `Alt + M`         | Go to Monthly                           |
| `Alt + A`         | Go to Annual                            |
| `Alt + D`         | Go to Data Review                       |
| `Alt + F`         | Go to Follow-Ups                        |
| `Alt + S`         | Go to Settings                          |
| `?`               | Shortcut help overlay                   |
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
- **Full backup** — single JSON containing every entry, people log, and
  setting (roster, theme, reward toggles, `lastBackupAt`). See
  [Data storage](#data-storage) for details.

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

## Data storage

Uptrack stores 100% of its state in the browser's IndexedDB under the
database name `uptrack`. There is no `localStorage`, no cookies, no
`sessionStorage`, no network persistence, and no background sync. Three
object stores cover every piece of application state:

| Store           | keyPath                | Contents                                                                                                      |
| --------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------- |
| `entries`       | `id` (autoincrement)   | Daily impact entries — title, description, domain, impact, tags, and all per-domain fields (People Management, Client Facing, Project). Indexed by `date`, `status`, `domain`, `archived`. |
| `peopleLogs`    | `month` (`'YYYY-MM'`)  | Monthly people-management reflection text, keyed by calendar month.                                           |
| `settings`      | `key`                  | Roster (direct / indirect / leadership), theme pack, theme mode, sound theme, audio-chime toggle, confetti toggle, and `lastBackupAt`. |

The full backup covers **every** object store. Backup format version 2
(v2.12.0 and later) includes the `settings` store so roster and
preferences survive a machine migration. Version 1 backups (pre-v2.12.0)
still restore cleanly — they simply leave existing settings untouched
rather than clobbering them, so upgrading is non-destructive in both
directions.

Storage write failures (quota exceeded, partitioned origin cleared, tab
closed mid-save) surface as user-facing error toasts rather than
disappearing silently. Affected paths include entry save/delete,
follow-up dismiss/reopen, monthly reflection auto-save, archive toggle,
and the backup download itself.

## Changelog

### v2.17.0
- **Design polish.** First of a design-focused release series:
  - The capture heatmap now renders at its natural GitHub-style cell size
    instead of stretching to the full card width (which blew the labels
    up to headline size).
  - Domains and taxonomies get visually distinct hues (amber / blue /
    teal / plum for domains; gold / teal / slate for taxonomies) so
    stacked charts and chips are readable as categories. Amber stays
    reserved for brand and actions. The Minimal pack keeps its
    deliberate monochrome ramp; system-mode light now gets correct
    domain colors (previously undefined).
  - Fixed Futuristic light mode rendering dark glass panels: the pack's
    frosted topbar/card backgrounds and on-gradient button text were
    hard-coded dark and are now mode-aware tokens (`--glass`,
    `--glass-2`, `--on-accent`).
  - Drafts no longer appear twice on Today — the "Last 7 days" list
    excludes them since they have their own section directly above.
  - The mission tagline moved from Today (where it pushed content down
    on the most-used screen) to a quiet footer on Settings.

### v2.16.0
- **Taxonomy notes removed end-to-end.** The notes feature had been
  deliberately removed from the product; the v2.15.0 UI restored it by
  mistake. This release removes the Settings section, the db API
  (`setTaxonomyNote` / `getAllTaxonomyNotes`), and the `taxonomyNotes`
  key from full backups. `BACKUP_VERSION` stays 2 — older backups
  containing the key restore cleanly (it is simply ignored), and fresh
  databases no longer create the store.
- **CSV export covers every field.** `generalCsv` now emits the 15
  domain-specific columns (interaction type, meeting direction,
  individual, sentiment, development theme, the four follow-up fields,
  company, customer sentiment, escalation number/URL, project
  number/URL) plus `archived` — 28 columns total. "Other" enum
  selections emit the custom label. Note: the core column order is
  unchanged, but anything keyed by column *index* past column 10
  (`principles`) shifts; `createdAt`/`updatedAt` are now last.
- **Capture-streak heatmap on Today.** A GitHub-style grid of the
  trailing 13 weeks (Monday–Sunday columns) shows per-day capture
  intensity, with a consecutive-day streak readout. Counts key off the
  entry `date`, so backfilled work lights the day it happened; a
  not-yet-logged today doesn't break the streak.
- **Overdue follow-ups nav badge.** The Follow-Ups nav link shows a
  count of open follow-ups past their target date. It refreshes on
  every navigation, after dismiss/reopen in the Follow-Ups view, and
  after entry saves/deletes.
- **Duplicate entry.** Editing an entry now offers a Duplicate button
  that opens a fresh draft copy (dated today, follow-up not dismissed)
  prefilled with everything on screen — including unsaved edits — for
  recurring work like 1:1s.
- **People search.** The filter search box now also matches the
  Individual, Company Name, and Follow-Up Action fields, so "everything
  about Alice" is a one-box query.
- **Print stylesheet.** Printing any view now forces a light palette,
  hides navigation/filters/buttons, and keeps cards intact across page
  breaks. Known limitation: SVG charts bake theme colors at render
  time, so a dark-theme session prints charts with on-screen colors.
- **`Alt+N` replaces `Ctrl/Cmd+N` for "new full entry".** Browsers
  reserve Ctrl+N for "new window" and never deliver it to the page, so
  the old binding silently did nothing. Alt+N joins the existing
  Alt-key navigation family and is guarded against firing while a
  modal is open.
- **"Last 7 days" on Today no longer includes future-dated entries.**

### v2.15.0
- **Taxonomy notes UI.** The `taxonomyNotes` object store has had a full
  persistence API, backup/restore coverage, and a README mention since
  v1 — but no way to actually write a note. Settings now has a
  "Taxonomy notes" section with one textarea per taxonomy item (keyed
  `<taxonomy>:<item>`, e.g. `values:Security`). Notes save on blur, an
  emptied note deletes the record, and storage failures surface as
  error toasts.
- **Removed dead `ui.escapeHtml` helper.** Exported but never called —
  all DOM is built via `ui.el`, which uses `textContent` for user data.
- **Documented the unused `entries` indexes.** `by_date` / `by_status` /
  `by_domain` / `by_archived` are never queried (all reads are
  `getAll()` + in-memory filtering); a comment in `db.js` now records
  that they are kept only to avoid a pointless `DB_VERSION` bump.

### v2.14.2
- **Fix: CSV formula-injection guard could be bypassed.** `csvEscape`
  quoted the value first and tested for a formula prefix second, so a
  cell starting with `=`, `+`, `-`, `@`, or tab that *also* contained a
  comma, quote, or newline (e.g. `=HYPERLINK("…"),x`) was quoted but
  never neutralized — Excel would unquote it and execute the formula.
  The prefix is now neutralized on the raw value before quoting, and a
  lone `\r` now also triggers quoting.
- **Fix: People Management month header shifted a month in western
  timezones.** `new Date('YYYY-MM-01')` parses as UTC midnight, which
  is the last day of the *previous* month in any negative UTC offset.
  Now parsed with the local-time `parseIso` helper.
- **Fix: quick capture lost the typed title on storage failure.** The
  input was cleared unconditionally after the save attempt; it is now
  cleared only when the draft actually saved.
- **Fix: switching an entry's domain carried stale domain-specific
  fields.** Changing People Management → Project (etc.) silently kept
  the old interaction type, sentiment, individual, follow-up, and
  similar fields, which then leaked into Obsidian exports, the
  Follow-Ups view, and the visibility index. `normalizeEntry` now
  persists each domain-specific field only for the domain it belongs
  to, and the entry form drops an interaction type that isn't valid
  for the newly selected domain.
- **Fix: silent storage failures in Settings and the backup nag.**
  Roster add/remove, theme pack/mode, sound theme, and the audio /
  confetti toggles awaited `setSetting` with no error handling; the
  backup-nag button likewise had no catch around the backup itself.
  All now surface error toasts (roster changes also roll back the
  in-memory list so the UI matches storage).
- **Fix: modal Escape listeners accumulated.** The document-level
  keydown listener was only removed when Escape itself closed the
  modal; closing via the × button or backdrop leaked one listener per
  modal opened. `closeModal` now always detaches it.
- **Unsaved-changes guard on the entry form.** Dismissing the entry
  modal (Cancel, ×, backdrop click, Escape) with unsaved edits now
  asks for confirmation instead of silently discarding them, via a new
  `beforeClose` hook on `ui.openModal`.

### v2.14.1
- **Fix: Roster input invisible in dark mode (Issue #2).** The "Add a
  name…" input in the Settings roster section had no explicit
  `background` or `border` CSS — it inherited the browser-default
  white background, making near-white themed text (`var(--text)`)
  virtually invisible. Added `background: var(--bg)`, `border`,
  `border-radius`, `padding`, and focus ring to `.roster-add-row input`
  to match every other text input in the app.

### v2.14.0
- **Backup reminders on the Today view.** The backup-overdue nag banner
  (previously only shown on Settings) now appears on the Today / landing
  page when `lastBackupAt` is more than 14 days old or has never been
  set. `renderBackupNag` extracted from `settings.js` to `export.js`
  so both views share the same implementation.
- **Keyboard shortcuts.** `Alt+T/W/M/A/D/F/S` navigate directly to
  Today, Weekly, Monthly, Annual, Data Review, Follow-Ups, and Settings
  respectively. Press `?` to open a shortcut help overlay listing all
  available bindings. Existing shortcuts (`/` for quick capture focus,
  `Ctrl+N` / `Cmd+N` for new entry) are unchanged.
- **CSV injection hardening.** `csvEscape` now prefixes cells that
  start with `=`, `+`, `-`, `@`, or tab with a leading single quote
  inside double quotes, per OWASP guidance. Prevents spreadsheet
  formula injection when exported CSV files are opened in Excel or
  Google Sheets.

### v2.13.1
- **Fix: Obsidian export YAML frontmatter corrupted by backslashes,
  newlines, and control characters in user input.** `yamlEscape` only
  escaped the double-quote character, but the exporter builds
  double-quoted YAML scalars for user-editable fields (title,
  individual, interaction_type, development_theme, company,
  project_number, follow_up). Realistic input silently broke the
  frontmatter: a Windows path like `C:\Users\foo` in the Company field
  produced `company: "C:\Users\foo"`, which YAML parses as the start
  of a `\U` 8-digit Unicode escape, rejecting the whole block; a
  pasted multi-line title broke the scalar across lines; tab and CR
  produced similar corruption. `yamlEscape` now escapes `\`, `"`,
  `\r`, `\n`, and `\t` in that specific order (backslash first, to
  avoid double-escaping subsequent replacements), matching the
  standard double-quoted YAML escape set.

### v2.13.0
- **Data Review is now a widget-based dashboard.** The page is composed
  of eleven independent widgets that each respond to the shared filter
  bar and can be toggled on or off. Preferences persist to the
  `settings` object store under key `dataReviewWidgets`, so the layout
  a user tunes on one sitting is still theirs on the next launch.
  Widgets:
  1. **Summary statistics row** — total, completed, critical, high,
     client facing, high+critical percentage, open follow-ups.
  2. **Domain distribution over time** — stacked bars of entries per
     month broken out by domain, surfacing shifts in how a manager is
     spending their tracked time.
  3–5. **Company values / Culture tenets / Principles alignment** —
     proportional horizontal bars showing raw count *and* percentage of
     total entries per taxonomy item, so underrepresented items read
     as underrepresented instead of being scaled away against the
     largest bar.
  6. **Taxonomy gap indicator (redesigned)** — sorted ascending with
     zero-usage items flagged `NOT USED` in a dashed outline, ranking
     the most overlooked items at the top of the list.
  7. **Impact quality over time** — monthly percentage of entries at
     High or Critical impact, plotted against a fixed 0–100 y-axis.
  8. **Cross-dimensional: impact by domain** — grouped side-by-side
     bars showing the four impact levels within each of the four
     domains, surfacing where high-impact work is concentrated.
  9. **Visibility index** — hero card reporting the unique entries
     that demonstrate visibility beyond one's team (Client Facing
     domain, Skip Level interactions, or tagged with Lead The Way /
     Own The Outcome tenets), with a component breakdown.
  10. **Period comparison** — two independent date-range selectors
     produce a side-by-side diff of total, completed, critical, high,
     client facing, and high+critical percentage, with signed deltas
     and percentage-change indicators.
  11. **Individual manager view** — the preserved per-person view
     showing sentiment trajectory, development themes, interaction
     types, and follow-up actions for any individual (People
     Management or Client Facing) selected from the dropdown.
- **Proportional bar charts everywhere taxonomy frequency is shown.**
  Monthly, Annual, and Data Review taxonomy widgets now scale bars
  against the *total entries in scope* rather than the largest bar in
  the set, and each bar's right-hand label pairs the raw count with
  its percentage of total. A full-width track behind each bar makes
  underrepresentation visible at a glance.
- **Additional stat cards on Landing, Annual, and Stakeholder.** Every
  top-level stat row now includes a Client Facing count and a
  High + Critical percentage so the two health indicators the new
  widgets expose are visible on every entry point, not only on Data
  Review.
- **Theme-aware chart colors.** Chart primitives now resolve color
  tokens from CSS custom properties at render time, so the Arctic,
  Futuristic, and Minimal theme packs (both dark and light modes)
  all render charts in their own palettes instead of the hard-coded
  amber Arctic palette. Four new domain CSS variables
  (`--domain-operations`, `--domain-project`,
  `--domain-people-management`, `--domain-client-facing`) let each
  theme pack override the domain color ramp independently.
- **New chart primitives** in `js/charts.js`: `groupedBarChart` (used
  by the Impact by Domain widget), aggregators `domainByMonth`,
  `impactQualityByMonth`, `visibilityIndex`, and a redesigned
  `gapIndicator` that ranks ascending and flags `NOT USED` items.
  `stackedBarChart` was generalized so it accepts custom keys /
  colors and now drives both the Impact-by-domain view and the
  Domain-over-time view.

### v2.12.0
- **Full backup now covers every object store.** `db.exportAll()`
  previously omitted the `settings` store, which meant restoring on a
  new machine would silently lose the roster (breaking the Individual
  dropdown in People Management entries), theme pack / mode, sound
  theme, and reward toggles. Backups generated from v2.12.0 onward
  include a `settings` key and restore cleanly onto a fresh machine.
- **Backup format version bumped `1 → 2`.** v1 backups (pre-v2.12.0)
  still restore correctly — they leave existing settings untouched
  rather than clobbering them — so the format change is
  backwards-compatible in both directions.
- **Storage write errors now surface as error toasts** instead of
  failing silently. Affected paths: entry quick-create, save-draft,
  save-as-complete, delete; follow-up dismiss and reopen; monthly
  reflection auto-save; archive toggle; download full backup.
- **New `## Data storage` section** in this README enumerates the
  four IndexedDB object stores, their keyPaths, and which settings
  live where.
- **Note on the "localStorage → IndexedDB migration" addendum item:**
  investigated and found to be a non-issue. Uptrack has used
  IndexedDB for 100% of its state since v1.0.0; there has never been
  a `localStorage` code path to migrate.

### v2.11.0
- Interaction Type lists are now domain-specific:
  - **People Management**: One-on-One, Skip Level, Performance
    Coaching, Project Meeting, Other
  - **Client Facing**: Escalation, Prospective Customer, Customer
    Event, Day in the Life / SOC Tour, Networking, Executive Briefing,
    Speaking or Presentation, Quarterly Business Review, Other
- "Feedback" removed from both domains entirely
- Historical entries retain their stored interaction type value — only
  the dropdown vocabulary for new/edited entries is affected
- Fix: Follow-Ups page title now reads "Follow-Up Action Items"

### v2.10.1
- Minor capitalization errors fixed. Wording adjusted on several pages.

### v2.10.0
- Entry form now supports free-text labels when "Other" is selected:
  - **Individual** field (People Management & Client Facing) gains an
    "Other…" option that reveals a name field — use it for skip-level
    meetings, peers in other orgs, or customer contacts without
    polluting the roster
  - **Interaction Type** reveals a text input when "Other" is selected,
    stored in companion field `interactionTypeOther`
  - **Development Theme** reveals a text input when "Other" is
    selected, stored in companion field `developmentThemeOther`
- Charts and monthly aggregations continue to bucket all "Other"
  entries together — the custom label is per-entry metadata, not a new
  chart bucket
- Obsidian export YAML frontmatter and detail sections emit the custom
  label when present, falling back to the raw enum otherwise

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
