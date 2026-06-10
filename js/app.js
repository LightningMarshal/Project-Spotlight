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
      var active = a.getAttribute('data-route') === name;
      a.classList.toggle('active', active);
      if (active) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    document.title = 'Uptrack — ' + routes[name].title;
    updateFollowupsBadge();
    try {
      await routes[name].render(root);
      window.scrollTo(0, 0);
    } catch (err) {
      console.error('Render error:', err);
      window.Uptrack.ui.clear(root);
      root.appendChild(window.Uptrack.ui.el('div', { class: 'empty' }, 'Something went wrong: ' + err.message));
    }
  }

  /* Overdue-follow-ups count on the Follow-Ups nav link. Runs on every
   * navigation; views and the entry form also call it (via
   * Uptrack.app.refreshNavBadge) after mutations that can change the
   * count without a hashchange. Purely cosmetic — storage errors are
   * swallowed rather than toasted. */
  async function updateFollowupsBadge() {
    try {
      const db = window.Uptrack.db;
      const entries = await db.getAllEntries();
      const todayIso = db.todayIso();
      const count = entries.filter(function (e) {
        return e.followUpAction && !e.followUpDismissed &&
          e.followUpTargetDate && e.followUpTargetDate < todayIso;
      }).length;
      const link = document.querySelector('.nav a[data-route="followups"]');
      if (!link) return;
      let badge = link.querySelector('.nav-badge');
      if (!count) {
        if (badge) badge.parentNode.removeChild(badge);
        return;
      }
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'nav-badge';
        link.appendChild(badge);
      }
      badge.textContent = count;
    } catch (err) { /* cosmetic — never block or toast */ }
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

    /* Global keyboard shortcuts */
    var NAV_KEYS = {
      t: '#/',
      w: '#/weekly',
      m: '#/monthly',
      a: '#/annual',
      d: '#/datareview',
      f: '#/followups',
      s: '#/settings'
    };

    document.addEventListener('keydown', function (e) {
      var tag = document.activeElement.tagName;
      var inInput = (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT');
      var modalOpen = document.getElementById('modal-root').hasChildNodes();

      /* Alt+letter — view navigation and new entry (works even in inputs).
       * Alt+N replaces the old Ctrl/Cmd+N binding: browsers reserve Ctrl+N
       * for "new window" and never deliver it to the page. */
      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        if (e.key.toLowerCase() === 'n') {
          /* Never open over an existing modal — openModal clears the modal
           * root, which would destroy an in-progress entry form and bypass
           * its unsaved-changes guard. */
          if (modalOpen) return;
          e.preventDefault();
          window.Uptrack.entry.open(null, { onChange: router });
          return;
        }
        var target = NAV_KEYS[e.key.toLowerCase()];
        if (target) {
          e.preventDefault();
          window.location.hash = target;
          return;
        }
      }

      if (inInput || modalOpen) return;

      /* / — focus quick capture or navigate to Today */
      if (e.key === '/') {
        if (currentRouteName() !== 'landing') {
          window.location.hash = '#/';
        } else {
          e.preventDefault();
          var qc = document.querySelector('.quick-capture input[type="text"]');
          if (qc) qc.focus();
        }
        return;
      }

      /* ? — shortcut help overlay */
      if (e.key === '?') {
        e.preventDefault();
        showShortcutHelp();
      }
    });

    router();
  }

  function showShortcutHelp() {
    var ui = window.Uptrack.ui;
    var shortcuts = [
      ['/', 'Focus quick capture / go to Today'],
      ['Alt+N', 'New full entry'],
      ['Alt+T', 'Today'],
      ['Alt+W', 'Weekly'],
      ['Alt+M', 'Monthly'],
      ['Alt+A', 'Annual'],
      ['Alt+D', 'Data Review'],
      ['Alt+F', 'Follow-Ups'],
      ['Alt+S', 'Settings'],
      ['?', 'This help']
    ];
    var rows = shortcuts.map(function (s) {
      return ui.el('div', { style: { display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' } }, [
        ui.el('kbd', { style: { fontFamily: 'var(--mono)', fontSize: '13px', fontWeight: '600', color: 'var(--accent)' } }, s[0]),
        ui.el('span', { class: 'text-dim', style: { fontSize: '13px' } }, s[1])
      ]);
    });
    var body = ui.el('div', { style: { maxWidth: '360px' } }, rows);
    ui.openModal('Keyboard shortcuts', body);
  }

  window.Uptrack = window.Uptrack || {};
  window.Uptrack.app = { refreshNavBadge: updateFollowupsBadge };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
