/* In-page side panel: same shared stats view as the popup, rendered into a
 * native-looking block at the bottom of the dashboard sidebar.
 * Placement: #block-region-side-pre -> #block-region-side-post -> floating box.
 * Styles are isolated in Shadow DOM (CSP-safe constructed stylesheet).
 * All data stays in chrome.storage.local. */
(function () {
  'use strict';

  const HOST_ID = 'optima-progress-block';
  const CARD_SELECTOR = '.block_optima_indicators__course-card';

  function validCourse(c) {
    return c && typeof c.courseId === 'string' && c.practices && c.lectures;
  }

  function get(keys) {
    return new Promise((r) => chrome.storage.local.get(keys, r));
  }

  function set(obj) {
    return new Promise((r) => chrome.storage.local.set(obj, r));
  }

  async function savePref(courseId, pref) {
    const data = await get('optimaSettings');
    const s = (data && data.optimaSettings) || { courses: {} };
    s.courses = s.courses || {};
    s.courses[courseId] = {
      included: pref.included !== false,
      mode: pref.mode === '100' ? '100' : '12',
    };
    await set({ optimaSettings: s });
  }

  async function saveLang(lang) {
    const I = window.OptimaI18n;
    const data = await get('optimaSettings');
    const s = (data && data.optimaSettings) || { courses: {} };
    s.lang = I.normalizeLang(lang);
    await set({ optimaSettings: s });
  }

  async function resetPrefs() {
    const data = await get('optimaSettings');
    const s = (data && data.optimaSettings) || {};
    await set({ optimaSettings: { courses: {}, lang: s.lang || 'en' } });
  }

  async function applyCss(shadow) {
    try {
      const res = await fetch(chrome.runtime.getURL('src/stats.css'));
      if (!res.ok) throw new Error('css http ' + res.status);
      const text = await res.text();
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(text);
      shadow.adoptedStyleSheets = [sheet];
    } catch (e) {
      const st = document.createElement('style');
      st.textContent = '.op-root{font:13px system-ui,sans-serif;color:#16211a}'
        + '.op-course{border:1px solid #ddd;border-radius:8px;padding:8px;margin-bottom:8px}';
      shadow.appendChild(st);
    }
  }

  function ensureHost() {
    let host = document.getElementById(HOST_ID);
    if (host) return host;
    host = document.createElement('section');
    host.id = HOST_ID;
    const pre = document.querySelector('#block-region-side-pre');
    const post = document.querySelector('#block-region-side-post');
    const sidebar = pre || post;
    if (sidebar) {
      host.className = 'block card mb-3';
      host.setAttribute('role', 'complementary');
      sidebar.appendChild(host);
    } else {
      host.style.position = 'fixed';
      host.style.right = '12px';
      host.style.bottom = '12px';
      host.style.width = '420px';
      host.style.maxHeight = '70vh';
      host.style.overflowY = 'auto';
      host.style.zIndex = '1000';
      host.style.background = '#fff';
      host.style.border = '1px solid #ddd';
      host.style.borderRadius = '12px';
      host.style.padding = '10px';
      document.body.appendChild(host);
    }
    return host;
  }

  async function render(shadow, mount) {
    const P = window.OptimaParsers;
    const I = window.OptimaI18n;
    try {
      const courses = P.parseMyPage(document).filter(validCourse);
      const data = await get(['optimaGrades', 'optimaSettings']);
      const gradesByCourse = ((data.optimaGrades || {}).byCourse) || {};
      const settings = (data.optimaSettings || { courses: {} });
      const lang = I.normalizeLang(settings.lang || I.detectLang(document));

      // Persist a fresh snapshot so the popup works too; write only on change.
      try {
        const snap = JSON.stringify(courses);
        const prev = await get('optimaMy');
        if (JSON.stringify(((prev.optimaMy || {}).courses) || []) !== snap) {
          await set({ optimaMy: { updatedAt: Date.now(), courses } });
        }
      } catch (e) { /* storage write must never break the page */ }

      mount.innerHTML = '';
      mount.appendChild(window.OptimaStatsView.buildStatsView(document, {
        courses,
        gradesByCourse,
        settings,
        lang,
        onLang: async (l) => { await saveLang(l); },
        onPref: async (courseId, pref) => { await savePref(courseId, pref); },
        onReset: async () => { await resetPrefs(); },
      }));
    } catch (e) { /* never break the host page */ }
  }

  async function boot() {
    try {
      if (!window.OptimaParsers || !window.OptimaI18n || !window.OptimaStatsView) return;
      const host = ensureHost();
      if (!host.shadowRoot) host.attachShadow({ mode: 'open' });
      const shadow = host.shadowRoot;
      await applyCss(shadow);
      let mount = shadow.querySelector('[data-op-mount]');
      if (!mount) {
        mount = document.createElement('div');
        mount.setAttribute('data-op-mount', '1');
        shadow.appendChild(mount);
      }

      const draw = () => render(shadow, mount);
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && (changes.optimaMy || changes.optimaGrades || changes.optimaSettings)) draw();
      });

      if (document.querySelector(CARD_SELECTOR)) {
        draw();
      } else {
        // Indicators may load late: one-shot observer with a timeout.
        let done = false;
        const stop = () => { if (!done) { done = true; try { obs.disconnect(); } catch (e) {} draw(); } };
        const obs = new MutationObserver(() => {
          if (document.querySelector(CARD_SELECTOR)) stop();
        });
        try {
          obs.observe(document.documentElement, { childList: true, subtree: true });
        } catch (e) { stop(); return; }
        setTimeout(stop, 10000);
        draw(); // empty state meanwhile
      }
    } catch (e) { /* never break the host page */ }
  }

  boot();
})();
