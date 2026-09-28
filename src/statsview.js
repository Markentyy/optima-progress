/* Shared stats view for the popup and the in-page panel.
 * buildStatsView(doc, opts) returns a DOM node. All strings come from OptimaI18n.
 * opts: { courses, gradesByCourse, lang, settings,
 *         onLang(lang), onPref(courseId, pref), onReset() } */
(function () {
  'use strict';

  function normalizeMode(m) {
    return m === '100' ? '100' : '12';
  }

  // Grade-report scores back up /my/ scores only when the latter are missing.
  function scoresFor(course, gradesByCourse) {
    const mine = course.practices.scores.map((s) => s.score);
    if (mine.length) return mine;
    const rows = (gradesByCourse && gradesByCourse[course.courseId]) || [];
    return rows.map((r) => r.score).filter((v) => Number.isFinite(v));
  }

  function courseResult(P, t, scores, mode) {
    if (!scores.length) return '-';
    if (mode === '100') {
      const total = P.sumScores(scores);
      const nat = P.nationalFor100(total);
      const label = t('g5_' + nat.grade5);
      return total + ' / 100 · ECTS ' + nat.ects + ' · ' + nat.grade5 + ' (' + label + ')';
    }
    return P.mean(scores).toFixed(2) + ' / 12';
  }

  function totalsHtml(t, courses, prefs) {
    let lecDone = 0, lecTotal = 0, prDone = 0, prPending = 0, prTotal = 0;
    courses.forEach((c) => {
      const pref = (prefs.courses || {})[c.courseId] || { included: true };
      if (pref.included === false) return;
      lecDone += c.lectures.done; lecTotal += c.lectures.total;
      prDone += c.practices.graded; prPending += c.practices.submitted;
      prTotal += c.practices.total;
    });
    return t('totals', {
      lecDone, lecTotal, lecLeft: lecTotal - lecDone,
      prDone, prTotal, prLeft: prTotal - prDone, prPending,
    });
  }

  function el(doc, tag, cls, text) {
    const n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function buildStatsView(doc, opts) {
    const P = window.OptimaParsers;
    const I = window.OptimaI18n;
    const lang = I.normalizeLang(opts.lang);
    const t = (key, vars) => I.fmt(I.STR[lang][key], vars);
    const courses = opts.courses || [];
    const prefs = opts.settings || { courses: {} };

    const root = el(doc, 'div', 'op-root');

    const head = el(doc, 'div', 'op-head');
    head.appendChild(el(doc, 'span', 'op-title', t('title')));
    head.appendChild(el(doc, 'span', 'op-badge', 'local'));
    const langSel = doc.createElement('select');
    langSel.className = 'op-lang';
    langSel.setAttribute('aria-label', t('ariaLang'));
    [['en', 'EN'], ['uk', 'UK'], ['ru', 'RU']].forEach(([v, label]) => {
      const o = doc.createElement('option');
      o.value = v;
      o.textContent = label;
      langSel.appendChild(o);
    });
    langSel.value = lang;
    langSel.addEventListener('change', () => opts.onLang(langSel.value));
    head.appendChild(langSel);
    root.appendChild(head);

    root.appendChild(el(doc, 'p', 'op-hint', t('hint')));

    const totals = el(doc, 'section', 'op-totals');
    totals.innerHTML = courses.length ? totalsHtml(t, courses, prefs) : t('noData');
    root.appendChild(totals);

    const actions = el(doc, 'div', 'op-actions');
    const resetBtn = el(doc, 'button', 'op-reset', t('reset'));
    resetBtn.type = 'button';
    resetBtn.addEventListener('click', () => opts.onReset());
    actions.appendChild(resetBtn);
    root.appendChild(actions);

    const list = el(doc, 'div', 'op-list');
    if (!courses.length) {
      list.textContent = t('empty', { url: 'https://b.optima-osvita.org/my/' });
    }
    for (const c of courses) {
      const rawPref = (prefs.courses || {})[c.courseId] || { included: true, mode: '12' };
      const pref = { included: rawPref.included !== false, mode: normalizeMode(rawPref.mode) };
      const result = courseResult(P, t, scoresFor(c, opts.gradesByCourse), pref.mode);

      const box = el(doc, 'div', 'op-course' + (pref.included === false ? ' off' : ''));
      const row = el(doc, 'div', 'op-row');
      const check = doc.createElement('input');
      check.type = 'checkbox';
      check.className = 'op-check';
      check.checked = pref.included !== false;
      check.setAttribute('aria-label', t('ariaInclude', { title: c.title }));
      const titleEl = el(doc, 'span', 'op-title2', c.title);
      const sel = doc.createElement('select');
      sel.className = 'op-mode';
      sel.setAttribute('aria-label', t('ariaScale', { title: c.title }));
      [[ '12', t('modeSchool') ], [ '100', t('modeCollege') ]].forEach(([v, label]) => {
        const o = doc.createElement('option');
        o.value = v;
        o.textContent = label;
        sel.appendChild(o);
      });
      sel.value = pref.mode;
      check.addEventListener('change', () => opts.onPref(c.courseId, { included: check.checked, mode: sel.value }));
      sel.addEventListener('change', () => opts.onPref(c.courseId, { included: check.checked, mode: sel.value }));
      row.appendChild(check);
      row.appendChild(titleEl);
      row.appendChild(sel);
      box.appendChild(row);
      box.appendChild(el(doc, 'div', 'op-meta', t('meta', {
        done: c.lectures.done, total: c.lectures.total,
        graded: c.practices.graded, ptotal: c.practices.total,
        submitted: c.practices.submitted, todo: c.practices.todo,
      })));
      box.appendChild(el(doc, 'div', 'op-avg',
        (pref.mode === '100' ? t('avgTotal') : t('avgMean')) + result));
      list.appendChild(box);
    }
    root.appendChild(list);
    root.appendChild(el(doc, 'footer', 'op-foot', t('footer')));
    return root;
  }

  window.OptimaStatsView = { buildStatsView, normalizeMode, scoresFor };
})();
