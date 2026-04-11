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
    return {
      id: e.id,
      title: (e.title || '').trim(),
      description: e.description || '',
      status: e.status === 'complete' ? 'complete' : 'draft',
      domain: e.domain || '',
      impact: e.impact || '',
      date: e.date || todayIso(),
      tags: {
        values: Array.isArray(e.tags && e.tags.values) ? e.tags.values.slice() : [],
        tenets: Array.isArray(e.tags && e.tags.tenets) ? e.tags.tenets.slice() : [],
        principles: Array.isArray(e.tags && e.tags.principles) ? e.tags.principles.slice() : []
      },
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

  /* ---------- backup / restore ---------- */

  async function exportAll() {
    const [entries, logs, notes] = await Promise.all([
      getAllEntries({ includeArchived: true }),
      getAllPeopleLogs(),
      getAllTaxonomyNotes()
    ]);
    return {
      application: 'Uptrack',
      version: 1,
      generatedAt: new Date().toISOString(),
      entries: entries,
      peopleLogs: logs,
      taxonomyNotes: notes
    };
  }

  async function restoreAll(payload) {
    if (!payload || payload.application !== 'Uptrack') {
      throw new Error('Unrecognized backup file.');
    }
    const t = await tx(['entries', 'peopleLogs', 'taxonomyNotes'], 'readwrite');
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
  }

  window.Uptrack = window.Uptrack || {};
  window.Uptrack.db = {
    open, todayIso,
    addEntry, updateEntry, saveEntry, getEntry, deleteEntry,
    getAllEntries, getDrafts, archiveEntry,
    savePeopleLog, getPeopleLog, getAllPeopleLogs, deletePeopleLog,
    setTaxonomyNote, getAllTaxonomyNotes,
    exportAll, restoreAll
  };
})();
