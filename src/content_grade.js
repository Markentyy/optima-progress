/* Content script for the per-course grade report. Saves practice scores only. */
(function () {
  'use strict';
  try {
    if (!window.OptimaParsers) return;
    const id = new URL(location.href).searchParams.get('id');
    if (!id) return;
    const scores = window.OptimaParsers.parseGradeReport(document);
    chrome.storage.local.get('optimaGrades', (data) => {
      const all = (data && data.optimaGrades) || { updatedAt: 0, byCourse: {} };
      all.updatedAt = Date.now();
      all.byCourse = all.byCourse || {};
      all.byCourse[id] = scores;
      chrome.storage.local.set({ optimaGrades: all });
    });
  } catch (e) {
    // never break the host page
  }
})();
