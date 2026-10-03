/* Popup: thin wrapper around the shared stats view. All data stays local. */
(function () {
  'use strict';

  function validCourse(c) {
    return c && typeof c.courseId === 'string' && c.practices && c.lectures;
  }

  async function load() {
    const data = await new Promise((r) => chrome.storage.local.get(
      ['optimaMy', 'optimaGrades', 'optimaSettings'], r));
    return {
      courses: (((data.optimaMy || {}).courses) || []).filter(validCourse),
      gradesByCourse: ((data.optimaGrades || {}).byCourse) || {},
      settings: (data.optimaSettings || { courses: {} }),
    };
  }

  async function saveSettings(patch) {
    const data = await new Promise((r) => chrome.storage.local.get('optimaSettings', r));
    const s = (data && data.optimaSettings) || { courses: {} };
    Object.assign(s, patch);
    await new Promise((r) => chrome.storage.local.set({ optimaSettings: s }, r));
  }

  async function render() {
    const I = window.OptimaI18n;
    const V = window.OptimaStatsView;
    const { courses, gradesByCourse, settings } = await load();
    const lang = I.normalizeLang((settings && settings.lang) || I.detectLang(document));
    const scope = V.resolveScope(window.OptimaParsers, settings, courses, Date.now());
    const app = document.getElementById('app');
    app.innerHTML = '';
    app.appendChild(V.buildStatsView(document, {
      courses,
      gradesByCourse,
      settings,
      lang,
      scope,
      semesters: V.allSemesters(courses),
      onScope: async (sc) => {
        await saveSettings({ scope: sc });
        render();
      },
      onLang: async (l) => {
        await saveSettings({ lang: I.normalizeLang(l) });
        render();
      },
      onPref: async (courseId, pref) => {
        await setCoursePref(courseId, pref);
        render();
      },
      onReset: async () => {
        await new Promise((r) => chrome.storage.local.set(
          { optimaSettings: { courses: {}, lang: (settings && settings.lang) || 'en' } }, r));
        render();
      },
    }));
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes.optimaMy || changes.optimaSettings || changes.optimaGrades)) render();
  });

  render();
})();
