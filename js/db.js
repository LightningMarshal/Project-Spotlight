/* IndexedDB persistence layer for Uptrack.
 *
 * Object stores:
 *   entries        — daily impact entries, keyPath: id (autoIncrement)
 *   peopleLogs     — monthly people management logs, keyPath: month ('YYYY-MM')
 *   taxonomyNotes  — reference notes per taxonomy item, keyPath: key ('tax:item')
 *   settings       — misc single-value settings, keyPath: key
 */
(function () {
  'use strict';

  const DB_NAME = 'uptrack';
  const DB_VERSION = 1;

  let _dbPromise = null;

  function open() {
    if (_dbPromise) return _dbPromise;
    _dbPromise = new Promise(function (resolve, reject) {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = function () { reject(req.error); };
      req.onblocked = function () { reject(new Error('IndexedDB open blocked by another tab.')); };
      req.onupgradeneeded = function (e) {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('entries')) {
          const s = db.createObjectStore('entries', { keyPath: 'id', autoIncrement: true });
          /* These indexes are currently unused — every read path does
           * getAll() plus in-memory filtering, which is fine at
           * personal-tracker scale. They are kept because dropping them
           * would force a DB_VERSION bump for zero user-visible benefit. */
          s.createIndex('by_date', 'date');
          s.createIndex('by_status', 'status');
          s.createIndex('by_domain', 'domain');
          s.createIndex('by_archived', 'archived');
        }
        if (!db.objectStoreNames.contains('peopleLogs')) {
          db.createObjectStore('peopleLogs', { keyPath: 'month' });
        }
        if (!db.objectStoreNames.contains('taxonomyNotes')) {
          db.createObjectStore('taxonomyNotes', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };
      req.onsuccess = function () {
        const db = req.result;
        db.onversionchange = function () { db.close(); _dbPromise = null; };
        resolve(db);
      };
    });
    return _dbPromise;
  }

  function tx(stores, mode) {
    return open().then(function (db) { return db.transaction(stores, mode || 'readonly'); });
  }

  function wrap(request) {
    return new Promise(function (resolve, reject) {
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error); };
    });
  }

  /* ---------- entries ---------- */

  function normalizeEntry(e) {
    const now = new Date().toISOString();
    const domain = e.domain || '';
    /* Domain-specific fields only persist for the domain they belong to.
     * Switching an entry's domain in the form must not carry stale values
     * (e.g. a People Management sentiment on a Project entry) into exports,
     * aggregations, or the visibility index. The form only exposes these
     * fields once a domain is selected, so clearing on mismatch never
     * discards anything the user could currently see or edit. */
    const isPeople  = domain === 'People Management';
    const isClient  = domain === 'Client Facing';
    const isProject = domain === 'Project';
    return {
      id: e.id,
      title: (e.title || '').trim(),
      description: e.description || '',
      status: e.status === 'complete' ? 'complete' : 'draft',
      domain: domain,
      impact: e.impact || '',
      date: e.date || todayIso(),
      tags: {
        values: Array.isArray(e.tags && e.tags.values) ? e.tags.values.slice() : [],
        tenets: Array.isArray(e.tags && e.tags.tenets) ? e.tags.tenets.slice() : [],
        principles: Array.isArray(e.tags && e.tags.principles) ? e.tags.principles.slice() : []
      },
      /* Domain-specific fields — People Management + Client Facing */
      interactionType: (isPeople || isClient) ? (e.interactionType || '') : '',
      interactionTypeOther: (isPeople || isClient) ? (e.interactionTypeOther || '') : '',
      individual: (isPeople || isClient) ? (e.individual || '') : '',
      followUpAction: (isPeople || isClient) ? (e.followUpAction || '') : '',
      followUpDescription: (isPeople || isClient) ? (e.followUpDescription || '') : '',
      followUpTargetDate: (isPeople || isClient) ? (e.followUpTargetDate || '') : '',
      followUpDismissed: (isPeople || isClient) ? !!e.followUpDismissed : false,
      /* Domain-specific fields — People Management only */
      meetingDirection: isPeople ? (e.meetingDirection || '') : '',
      sentiment: isPeople ? (e.sentiment || '') : '',
      developmentTheme: isPeople ? (e.developmentTheme || '') : '',
      developmentThemeOther: isPeople ? (e.developmentThemeOther || '') : '',
      /* Domain-specific fields — Client Facing only */
      companyName: isClient ? (e.companyName || '') : '',
      customerSentiment: isClient ? (e.customerSentiment || '') : '',
      escalationNumber: isClient ? (e.escalationNumber || '') : '',
      escalationUrl: isClient ? (e.escalationUrl || '') : '',
      /* Domain-specific fields — Project only */
      projectNumber: isProject ? (e.projectNumber || '') : '',
      projectUrl: isProject ? (e.projectUrl || '') : '',
      archived: !!e.archived,
      createdAt: e.createdAt || now,
      updatedAt: now
    };
  }

  function todayIso() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return yyyy + '-' + mm + '-' + dd;
  }

  async function addEntry(entry) {
    const rec = normalizeEntry(entry);
    delete rec.id;
    const t = await tx(['entries'], 'readwrite');
    const id = await wrap(t.objectStore('entries').add(rec));
    return Object.assign({}, rec, { id: id });
  }

  async function updateEntry(entry) {
    const rec = normalizeEntry(entry);
    if (!rec.id) throw new Error('updateEntry requires id');
    const t = await tx(['entries'], 'readwrite');
    await wrap(t.objectStore('entries').put(rec));
    return rec;
  }

  async function saveEntry(entry) {
    return entry.id ? updateEntry(entry) : addEntry(entry);
  }

  async function getEntry(id) {
    const t = await tx(['entries']);
    return wrap(t.objectStore('entries').get(Number(id)));
  }

  async function deleteEntry(id) {
    const t = await tx(['entries'], 'readwrite');
    await wrap(t.objectStore('entries').delete(Number(id)));
  }

  async function getAllEntries(opts) {
    opts = opts || {};
    const t = await tx(['entries']);
    const all = (await wrap(t.objectStore('entries').getAll())) || [];
    const list = opts.includeArchived ? all : all.filter(function (e) { return !e.archived; });
    list.sort(function (a, b) {
      if (a.date === b.date) return (b.id || 0) - (a.id || 0);
      return a.date < b.date ? 1 : -1;
    });
    return list;
  }

  async function getDrafts() {
    const all = await getAllEntries();
    return all.filter(function (e) { return e.status === 'draft'; });
  }

  async function archiveEntry(id, archived) {
    const e = await getEntry(id);
    if (!e) return;
    e.archived = !!archived;
    return updateEntry(e);
  }

  /* ---------- people management logs ---------- */

  async function savePeopleLog(log) {
    const now = new Date().toISOString();
    const rec = {
      month: log.month,
      metrics: log.metrics || {},
      reflection: log.reflection || '',
      createdAt: log.createdAt || now,
      updatedAt: now
    };
    const t = await tx(['peopleLogs'], 'readwrite');
    await wrap(t.objectStore('peopleLogs').put(rec));
    return rec;
  }

  async function getPeopleLog(month) {
    const t = await tx(['peopleLogs']);
    return wrap(t.objectStore('peopleLogs').get(month));
  }

  async function getAllPeopleLogs() {
    const t = await tx(['peopleLogs']);
    const all = (await wrap(t.objectStore('peopleLogs').getAll())) || [];
    all.sort(function (a, b) { return a.month < b.month ? 1 : -1; });
    return all;
  }

  async function deletePeopleLog(month) {
    const t = await tx(['peopleLogs'], 'readwrite');
    await wrap(t.objectStore('peopleLogs').delete(month));
  }

  /* ---------- taxonomy notes ---------- */

  async function setTaxonomyNote(key, note) {
    const t = await tx(['taxonomyNotes'], 'readwrite');
    if (!note) {
      await wrap(t.objectStore('taxonomyNotes').delete(key));
    } else {
      await wrap(t.objectStore('taxonomyNotes').put({ key: key, note: note }));
    }
  }

  async function getAllTaxonomyNotes() {
    const t = await tx(['taxonomyNotes']);
    const all = (await wrap(t.objectStore('taxonomyNotes').getAll())) || [];
    const out = {};
    for (const n of all) out[n.key] = n.note;
    return out;
  }

  /* ---------- generic settings ---------- */

  async function getSetting(key) {
    const t = await tx(['settings']);
    const rec = await wrap(t.objectStore('settings').get(key));
    return rec ? rec.value : undefined;
  }

  async function setSetting(key, value) {
    const t = await tx(['settings'], 'readwrite');
    await wrap(t.objectStore('settings').put({ key: key, value: value }));
  }

  /* Dump every settings row as { key: value, ... }. Used by backup
   * export so roster, theme prefs, reward toggles, and lastBackupAt
   * are all carried across machines. */
  async function getAllSettings() {
    const t = await tx(['settings']);
    const all = (await wrap(t.objectStore('settings').getAll())) || [];
    const out = {};
    for (const rec of all) {
      if (rec && rec.key && rec.key !== '__probe__') out[rec.key] = rec.value;
    }
    return out;
  }

  /* ---------- persistence probe ----------
   * Round-trips a probe record to verify IndexedDB reads and writes actually
   * persist — used at boot time to catch file:// storage quirks (particularly
   * on Chromium, where file:// origins are partitioned per-directory and may
   * be cleared unexpectedly).
   */
  async function probePersistence() {
    const probeKey = '__probe__';
    const probeValue = 'probe-' + Date.now();
    const t = await tx(['settings'], 'readwrite');
    const store = t.objectStore('settings');
    await wrap(store.put({ key: probeKey, value: probeValue }));
    const roundTrip = await wrap(store.get(probeKey));
    if (!roundTrip || roundTrip.value !== probeValue) {
      throw new Error('IndexedDB round-trip failed: wrote "' + probeValue + '", read back "' + (roundTrip && roundTrip.value) + '"');
    }
    await wrap(store.delete(probeKey));
    return true;
  }

  /* ---------- backup / restore ---------- */

  /* Backup format versions:
   *   1 — entries, peopleLogs, taxonomyNotes only (legacy)
   *   2 — adds settings (roster, theme prefs, reward toggles,
   *       lastBackupAt) so every object store is covered
   */
  const BACKUP_VERSION = 2;

  async function exportAll() {
    const [entries, logs, notes, settings] = await Promise.all([
      getAllEntries({ includeArchived: true }),
      getAllPeopleLogs(),
      getAllTaxonomyNotes(),
      getAllSettings()
    ]);
    return {
      application: 'Uptrack',
      version: BACKUP_VERSION,
      generatedAt: new Date().toISOString(),
      entries: entries,
      peopleLogs: logs,
      taxonomyNotes: notes,
      settings: settings
    };
  }

  /* Replaces every object store with the contents of the backup.
   * Handles v1 (no settings key) and v2+ (settings present) payloads.
   * A v1 restore leaves existing settings intact — it does not clobber
   * them, since the backup pre-dates the settings-inclusive format. */
  async function restoreAll(payload) {
    if (!payload || payload.application !== 'Uptrack') {
      throw new Error('Unrecognized backup file.');
    }
    const hasSettings = payload.settings && typeof payload.settings === 'object';
    const storeList = ['entries', 'peopleLogs', 'taxonomyNotes'];
    if (hasSettings) storeList.push('settings');
    const t = await tx(storeList, 'readwrite');
    const es = t.objectStore('entries');
    const ls = t.objectStore('peopleLogs');
    const ns = t.objectStore('taxonomyNotes');
    await wrap(es.clear());
    await wrap(ls.clear());
    await wrap(ns.clear());
    for (const e of payload.entries || []) {
      const rec = normalizeEntry(e);
      if (e.id) rec.id = e.id;
      await wrap(es.put(rec));
    }
    for (const l of payload.peopleLogs || []) { await wrap(ls.put(l)); }
    for (const k of Object.keys(payload.taxonomyNotes || {})) {
      await wrap(ns.put({ key: k, note: payload.taxonomyNotes[k] }));
    }
    if (hasSettings) {
      const ss = t.objectStore('settings');
      await wrap(ss.clear());
      for (const k of Object.keys(payload.settings)) {
        if (k === '__probe__') continue;
        await wrap(ss.put({ key: k, value: payload.settings[k] }));
      }
    }
  }

  window.Uptrack = window.Uptrack || {};
  window.Uptrack.db = {
    open, todayIso,
    addEntry, updateEntry, saveEntry, getEntry, deleteEntry,
    getAllEntries, getDrafts, archiveEntry,
    savePeopleLog, getPeopleLog, getAllPeopleLogs, deletePeopleLog,
    setTaxonomyNote, getAllTaxonomyNotes,
    getSetting, setSetting, getAllSettings, probePersistence,
    exportAll, restoreAll
  };
})();
