/* App bootstrap and hash router. */
(function () {
  'use strict';

  const views = window.Uptrack.views;

  const routes = {
    'landing':     { hash: '#/',            title: 'Today',       render: views.landing.render },
    'weekly':      { hash: '#/weekly',      title: 'Weekly',      render: views.weekly.render },
    'monthly':     { hash: '#/monthly',     title: 'Monthly',     render: views.monthly.render },
    'annual':      { hash: '#/annual',      title: 'Annual',      render: views.annual.render },
    'stakeholder': { hash: '#/stakeholder', title: 'Stakeholder', render: views.stakeholder.render },
    'datareview':  { hash: '#/datareview',  title: 'Data Review', render: views.datareview.render },
    'followups':   { hash: '#/followups',   title: 'Follow-Ups', render: views.followups.render },
    'settings':    { hash: '#/settings',    title: 'Settings',    render: views.settings.render }
  };

  function currentRouteName() {
    const h = window.location.hash || '#/';
    for (const k of Object.keys(routes)) {
      if (routes[k].hash === h) return k;
    }
    return 'landing';
  }

  async function router() {
    const name = currentRouteName();
    const root = document.getElementById('view');
    /* Active nav state */
    document.querySelectorAll('.nav a').forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('data-route') === name);
    });
    document.title = 'Uptrack — ' + routes[name].title;
    try {
      await routes[name].render(root);
      window.scrollTo(0, 0);
    } catch (err) {
      console.error('Render error:', err);
      window.Uptrack.ui.clear(root);
      root.appendChild(window.Uptrack.ui.el('div', { class: 'empty' }, 'Something went wrong: ' + err.message));
    }
  }

  function renderStorageFailureBanner(message, detail) {
    const ui = window.Uptrack.ui;
    const root = document.getElementById('view');
    ui.clear(root);
    const bannerStyle = {
      borderLeft: '3px solid var(--impact-critical)',
      textAlign: 'left',
      padding: '28px 32px',
      maxWidth: '780px',
      margin: '40px auto'
    };
    root.appendChild(ui.el('div', { class: 'empty', style: bannerStyle }, [
      ui.el('div', { style: { color: 'var(--impact-critical)', fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '10px', fontWeight: '600' } }, 'Storage check failed'),
      ui.el('div', { style: { color: 'var(--text)', fontSize: '15px', marginBottom: '12px' } }, message),
      detail ? ui.el('div', { class: 'mono', style: { color: 'var(--text-faint)', fontSize: '12px', marginBottom: '14px' } }, detail) : null,
      ui.el('div', { style: { color: 'var(--text-dim)', fontSize: '13px', lineHeight: '1.7' } },
        'Uptrack has refused to start to protect your data. IndexedDB on file:// origins is unreliable in some browsers — Firefox is the most stable, followed by current Edge/Chrome. See the "Enterprise deployment" section of README.md for browser guidance and fallback options.')
    ]));
  }

  async function boot() {
    try {
      await window.Uptrack.db.open();
    } catch (err) {
      renderStorageFailureBanner('IndexedDB is unavailable in this browser context.', err && err.message);
      return;
    }

    try {
      await window.Uptrack.db.probePersistence();
    } catch (err) {
      renderStorageFailureBanner('IndexedDB failed a round-trip read/write probe. Your browser may not persist data reliably on file:// origins.', err && err.message);
      return;
    }

    /* Restore saved theme pack and mode.
     * Defaults: pack=arctic, mode=dark. Migration: if the legacy 'theme'
     * setting exists ('dark'|'light'), translate it to the new mode and
     * delete the old key so subsequent reads use the new scheme. */
    try {
      var db = window.Uptrack.db;
      var pack = await db.getSetting('themePack');
      var mode = await db.getSetting('themeMode');
      var legacyTheme = await db.getSetting('theme');

      if (!mode && legacyTheme) {
        mode = legacyTheme; // 'dark' or 'light'
        await db.setSetting('themeMode', mode);
      }
      if (!pack) pack = 'arctic';
      if (!mode) mode = 'dark';

      document.documentElement.setAttribute('data-theme-pack', pack);
      document.documentElement.setAttribute('data-theme-mode', mode);
    } catch (e) { /* non-fatal */ }

    window.addEventListener('hashchange', router);

    /* Global keyboard shortcut: '/' focuses quick capture on landing */
    document.addEventListener('keydown', function (e) {
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        if (currentRouteName() !== 'landing') {
          window.location.hash = '#/';
        } else {
          e.preventDefault();
          const qc = document.querySelector('.quick-capture input[type="text"]');
          if (qc) qc.focus();
        }
      }
      if (e.key === 'n' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        window.Uptrack.entry.open(null, { onChange: router });
      }
    });

    router();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
