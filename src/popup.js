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

  async function render() {
    const I = window.OptimaI18n;
    const { courses, gradesByCourse, settings } = await load();
    const lang = I.normalizeLang((settings && settings.lang) || I.detectLang(document));
    const app = document.getElementById('app');
    app.innerHTML = '';
    app.appendChild(window.OptimaStatsView.buildStatsView(document, {
      courses,
      gradesByCourse,
      settings,
      lang,
      onLang: async (l) => {
        const data = await new Promise((r) => chrome.storage.local.get('optimaSettings', r));
        const s = (data && data.optimaSettings) || { courses: {} };
        s.lang = I.normalizeLang(l);
        await new Promise((r) => chrome.storage.local.set({ optimaSettings: s }, r));
        render();
      },
      onPref: async (courseId, pref) => {
        await setCoursePref(courseId, pref);
        render();
      },
      onReset: async () => {
        const data = await new Promise((r) => chrome.storage.local.get('optimaSettings', r));
        const s = (data && data.optimaSettings) || {};
        await new Promise((r) => chrome.storage.local.set(
          { optimaSettings: { courses: {}, lang: (s && s.lang) || 'en' } }, r));
        render();
      },
    }));
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes.optimaMy || changes.optimaSettings || changes.optimaGrades)) render();
  });

  render();
})();
