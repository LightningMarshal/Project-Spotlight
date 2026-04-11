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

  async function boot() {
    try {
      await window.Uptrack.db.open();
    } catch (err) {
      const root = document.getElementById('view');
      root.appendChild(window.Uptrack.ui.el('div', { class: 'empty' },
        'IndexedDB is unavailable in this browser context: ' + err.message));
      return;
    }

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
