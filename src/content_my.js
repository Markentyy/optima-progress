/* Content script for /my/. Saves only course progress (no personal data). */
(function () {
  'use strict';
  try {
    if (!window.OptimaParsers) return;
    const courses = window.OptimaParsers.parseMyPage(document);
    chrome.storage.local.set({ optimaMy: { updatedAt: Date.now(), courses } });
  } catch (e) {
    // never break the host page
  }
})();
