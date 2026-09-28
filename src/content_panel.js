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

  // Embedded copy of src/stats.css. test/css-sync.test.js enforces equality,
  // so this can never drift from the file. Last resort when neither
  // constructed stylesheets nor linked resources are available.
  const FULL_CSS = "/* Shared styles for the popup and the in-page panel (all classes op-*). */\n.op-root {\n  --op-bg: #f2f6f3;\n  --op-card: #ffffff;\n  --op-text: #16211a;\n  --op-muted: #5d6f63;\n  --op-accent: #1d9d57;\n  --op-accent-dark: #127245;\n  --op-accent-soft: #e4f4ea;\n  --op-border: #e2eae5;\n  --op-radius: 14px;\n  --op-shadow: 0 1px 2px rgba(20, 40, 28, 0.06), 0 4px 14px rgba(20, 40, 28, 0.06);\n  font-family: \"Segoe UI\", system-ui, -apple-system, sans-serif;\n  font-size: 13px;\n  line-height: 1.45;\n  color: var(--op-text);\n}\n\n.op-head { display: flex; gap: 8px; align-items: center; margin: 0 0 2px; }\n.op-title { font-size: 16px; font-weight: 700; letter-spacing: 0.1px; }\n\n.op-badge {\n  background: linear-gradient(135deg, var(--op-accent), var(--op-accent-dark));\n  color: #fff;\n  border-radius: 999px;\n  font-size: 10.5px;\n  font-weight: 600;\n  padding: 2px 9px;\n  letter-spacing: 0.4px;\n  text-transform: uppercase;\n}\n\n.op-lang { margin-left: auto; }\n\n.op-hint { color: var(--op-muted); margin: 0 0 10px; font-size: 12.5px; }\n\n.op-totals {\n  background: var(--op-card);\n  border: 1px solid var(--op-border);\n  border-left: 4px solid var(--op-accent);\n  border-radius: var(--op-radius);\n  box-shadow: var(--op-shadow);\n  padding: 10px 12px;\n  margin-bottom: 10px;\n}\n\n.op-actions { display: flex; gap: 8px; margin-bottom: 10px; }\n\n.op-actions button {\n  cursor: pointer;\n  border: 1px solid var(--op-accent);\n  background: linear-gradient(135deg, var(--op-accent), var(--op-accent-dark));\n  color: #fff;\n  font-weight: 600;\n  border-radius: 999px;\n  padding: 6px 14px;\n  transition: filter 0.15s ease, transform 0.1s ease;\n}\n\n.op-actions button:hover { filter: brightness(1.07); }\n.op-actions button:active { transform: scale(0.98); }\n\n.op-course {\n  background: var(--op-card);\n  border: 1px solid var(--op-border);\n  border-radius: var(--op-radius);\n  box-shadow: var(--op-shadow);\n  padding: 10px 12px;\n  margin-bottom: 8px;\n  transition: box-shadow 0.15s ease, opacity 0.15s ease;\n}\n\n.op-course:hover { box-shadow: 0 2px 4px rgba(20, 40, 28, 0.08), 0 8px 22px rgba(20, 40, 28, 0.1); }\n.op-course.off { opacity: 0.55; }\n.op-row { display: flex; gap: 8px; align-items: center; }\n.op-title2 { font-weight: 650; flex: 1; overflow-wrap: anywhere; }\n\n.op-course input[type=\"checkbox\"] {\n  width: 16px;\n  height: 16px;\n  accent-color: var(--op-accent);\n  cursor: pointer;\n  flex-shrink: 0;\n}\n\n.op-lang,\n.op-mode {\n  border: 1px solid var(--op-border);\n  border-radius: 999px;\n  padding: 4px 8px;\n  font-size: 12.5px;\n  color: var(--op-text);\n  background: var(--op-bg);\n  cursor: pointer;\n  flex-shrink: 0;\n}\n\n.op-mode { max-width: 132px; }\n\n.op-course select:focus-visible,\n.op-actions button:focus-visible,\n.op-course input[type=\"checkbox\"]:focus-visible,\n.op-lang:focus-visible {\n  outline: 2px solid var(--op-accent);\n  outline-offset: 1px;\n}\n\n.op-meta { color: var(--op-muted); font-size: 12.5px; margin-top: 6px; }\n\n.op-avg {\n  display: inline-block;\n  margin-top: 6px;\n  background: var(--op-accent-soft);\n  color: var(--op-accent-dark);\n  font-weight: 650;\n  border-radius: 999px;\n  padding: 3px 11px;\n}\n\n.op-foot { color: var(--op-muted); font-size: 11px; margin-top: 10px; text-align: center; }\n\n/* Compact mode for the narrow dashboard sidebar. */\n.op-compact { font-size: 12.5px; }\n.op-compact .op-head { flex-wrap: wrap; row-gap: 6px; }\n.op-compact .op-title { font-size: 14px; }\n.op-compact .op-totals,\n.op-compact .op-course { padding: 8px 10px; }\n.op-compact .op-row { flex-wrap: wrap; }\n.op-compact .op-title2 { flex: 1 1 100%; font-size: 12.5px; }\n.op-compact .op-mode { width: 100%; max-width: none; }\n.op-compact .op-meta { font-size: 12px; }\n.op-compact .op-avg { font-size: 12px; }\n";

  async function applyCss(shadow) {
    // Tier 1: constructed stylesheet from the live file (fast, CSP-safe).
    try {
      const res = await fetch(chrome.runtime.getURL('src/stats.css'));
      if (!res.ok) throw new Error('css http ' + res.status);
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(await res.text());
      shadow.adoptedStyleSheets = [sheet];
      return;
    } catch (e) { /* fall through */ }
    // Tier 2: linked extension resource (covered by web_accessible_resources).
    try {
      await new Promise((resolve, reject) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = chrome.runtime.getURL('src/stats.css');
        link.onload = () => resolve();
        link.onerror = () => reject(new Error('link css failed'));
        shadow.appendChild(link);
        setTimeout(() => reject(new Error('link css timeout')), 3000);
      });
      return;
    } catch (e) { /* fall through */ }
    // Tier 3: embedded copy, always available.
    const st = document.createElement('style');
    st.textContent = FULL_CSS;
    shadow.appendChild(st);
  }

  // Returns the element to attach the shadow tree to. In sidebar mode it is
  // an inner card-body div so Moodle's own card padding applies.
  function ensureMountParent() {
    const old = document.getElementById(HOST_ID);
    if (old) return old.querySelector('[data-op-body]') || old;
    const section = document.createElement('section');
    section.id = HOST_ID;
    const pre = document.querySelector('#block-region-side-pre');
    const post = document.querySelector('#block-region-side-post');
    const sidebar = pre || post;
    if (sidebar) {
      section.className = 'block card mb-3';
      section.setAttribute('role', 'complementary');
      const body = document.createElement('div');
      body.className = 'card-body p-3';
      body.setAttribute('data-op-body', '1');
      section.appendChild(body);
      sidebar.appendChild(section);
      return body;
    }
    section.style.position = 'fixed';
    section.style.right = '12px';
    section.style.bottom = '12px';
    section.style.width = '420px';
    section.style.maxHeight = '70vh';
    section.style.overflowY = 'auto';
    section.style.zIndex = '1000';
    section.style.background = '#fff';
    section.style.border = '1px solid #ddd';
    section.style.borderRadius = '12px';
    section.style.padding = '10px';
    document.body.appendChild(section);
    return section;
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
        compact: true,
        onLang: async (l) => { await saveLang(l); },
        onPref: async (courseId, pref) => { await savePref(courseId, pref); },
        onReset: async () => { await resetPrefs(); },
      }));
    } catch (e) { /* never break the host page */ }
  }

  async function boot() {
    try {
      if (!window.OptimaParsers || !window.OptimaI18n || !window.OptimaStatsView) return;
      const parent = ensureMountParent();
      const host = parent;
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
