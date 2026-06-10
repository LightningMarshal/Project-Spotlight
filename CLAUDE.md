# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Uptrack — a locally hosted, browser-based work impact tracker for senior managers. Plain HTML/CSS/JS with **zero dependencies, no build step, no package manager, no tests, and no lint tooling**. All state lives in the browser's IndexedDB (database `uptrack`); there is no server-side anything.

## Running

- Primary: open `index.html` directly in a browser (`file://` origin). Firefox is the most reliable for `file://` IndexedDB persistence.
- Developer fallback: `python3 serve.py` serves the directory on localhost (use only when debugging browser-specific `file://` storage issues).
- There is nothing to install, build, or test from the command line. Verification is manual: open the app in a browser and exercise the affected view.

## Hard constraints

These are deliberate product guarantees — do not violate them:

- **No network calls at runtime.** `index.html` ships a CSP meta tag whose load-bearing directive is `connect-src 'none'`. Never add `fetch`, `XMLHttpRequest`, service workers, CDN references, external fonts/icons, or ES module imports.
- **No third-party dependencies.** No npm packages, ever. Charts are hand-rolled SVG (`js/charts.js`), sounds are synthesized via the Web Audio API (`js/rewards.js`).
- **All persistence goes through IndexedDB via `js/db.js`.** No `localStorage`, cookies, or `sessionStorage`. Storage write failures must surface as error toasts (`ui.toast(msg, 'error')`), never fail silently.
- **Archiving instead of deletion** is the default data-integrity posture.

## Architecture

### Module system

There are no ES modules. Every file is an IIFE that attaches its exports to the `window.Uptrack` namespace:

- `Uptrack.tax` (taxonomies.js) — constants: taxonomies, domains, impact levels, domain-specific field/enum definitions
- `Uptrack.db` (db.js) — IndexedDB layer
- `Uptrack.ui` (ui.js) — `el()` element builder, date helpers, modals, toasts, badges
- `Uptrack.filters` (filters.js) — central filter engine used by every view and the export pipeline
- `Uptrack.charts` (charts.js) — SVG chart primitives and aggregators
- `Uptrack.entry` (entry.js) — entry create/edit modal form
- `Uptrack.rewards` (rewards.js) — audio chime + confetti on save-as-complete
- `Uptrack.export` (export.js) — text/CSV/Obsidian/performance-review exports, full backup, backup-nag banner
- `Uptrack.palette` (palette.js) — Ctrl/Cmd+K command palette (views, actions, entry search)
- `Uptrack.views.<name>` (js/views/*.js) — one render function per view

**Script load order in `index.html` is the dependency graph.** Foundation scripts load before views, `app.js` loads last. A new file must be added as a `<script>` tag in the right position.

### Routing

`js/app.js` is the bootstrap and hash router. The `routes` table maps `#/...` hashes to `views.<name>.render(root)`. Each view's `render(root)` clears the root and rebuilds the DOM. Adding a view requires: a file in `js/views/`, a route entry in `app.js`, a `<script>` tag in `index.html`, and (usually) a nav link in the topbar. Note `stakeholder` is routable (`#/stakeholder`) but intentionally has no nav link.

On boot, `app.js` opens the DB and runs `db.probePersistence()` — a round-trip read/write probe. If either fails, the app refuses to start and renders a "Storage check failed" banner instead of risking silent data loss.

### Data model

Three object stores in `js/db.js` (DB_VERSION 1): `entries` (autoincrement id, indexed by date/status/domain/archived), `peopleLogs` (keyed `'YYYY-MM'`), `settings` (key/value). (A legacy `taxonomyNotes` store may exist in older databases; it is unused and ignored.)

`normalizeEntry()` in db.js is the **single source of truth for the entry schema**. Adding an entry field means updating, in lockstep: `normalizeEntry` (db.js), `newEntryTemplate` (entry.js), the form in entry.js, and any exports in export.js that should emit it.

Entries have one `domain` (Operations / Project / People Management / Client Facing) with domain-specific conditional fields, an `impact` level, and tags from all three taxonomies simultaneously (values / tenets / principles). "Other" enum selections store a free-text companion field (e.g. `interactionTypeOther`); charts bucket by the raw enum while display-facing exports prefer the custom label (`labelOrOther` in export.js).

Full backup is a versioned JSON format (`BACKUP_VERSION` in db.js, currently 2). Restore must stay backwards-compatible with older backup versions — v1 backups (no `settings` key) restore without clobbering existing settings.

### Theming

Theme packs (`arctic`, `futuristic`, `minimal`) × modes (`dark`, `light`, `system`) are applied as `data-theme-pack` / `data-theme-mode` attributes on `<html>`, with all styling in `css/styles.css` via CSS custom properties. Charts resolve colors from CSS variables at render time (`cssVar()` in charts.js) so they follow the active theme — never hard-code chart colors without a CSS-variable lookup plus fallback.

## Code conventions

- Build DOM with `ui.el(tag, attrs, children)` — do not write `innerHTML` with user data (the only `innerHTML` path is the `html` attr in `ui.el`, used sparingly with trusted strings).
- Conservative ES5-flavored style inside IIFEs: `'use strict'`, `function` declarations, `var`/`const`, no arrow functions, no classes, no async-arrow chains beyond what's already there. Match the surrounding file.
- Dates are local-time ISO `'YYYY-MM-DD'` strings compared lexicographically; use the helpers in `ui` (`parseIso`, `toIso`, `startOfWeek`, etc.). Weeks run Monday–Sunday.
- Export escaping is security-relevant and has had real bugs: `csvEscape` guards against spreadsheet formula injection, `yamlEscape` escapes backslash first then `"`, `\r`, `\n`, `\t`. Don't weaken either.

## Versioning and release convention

The version string lives in three places that must stay in sync: the `README.md` header, the `brand-tag` span in `index.html`, and the README `## Changelog` section (newest first, with a detailed entry per release). Commits follow a loose conventional style with the version in the subject, e.g. `fix(css): v2.14.1 — roster input invisible in dark mode (closes #2)`.
