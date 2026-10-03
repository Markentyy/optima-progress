/* Shared stats view for the popup and the in-page panel.
 * buildStatsView(doc, opts) returns a DOM node. All strings come from OptimaI18n.
 * opts: { courses, gradesByCourse, lang, settings, compact,
 *         onLang(lang), onPref(courseId, pref), onReset() } */
(function () {
  'use strict';

  function normalizeMode(m) {
    return m === '100' ? '100' : '12';
  }

  // Grade-report scores back up /my/ scores only when the latter are missing.
  // Journal rows carry no semester, so the fallback applies to year scope only.
  function scoresFor(course, gradesByCourse, scope) {
    const all = ((course && course.practices && course.practices.scores) || []);
    const mine = (scope && scope.type === 'semester'
      ? all.filter((s) => s.semester === scope.n)
      : all).map((s) => s.score);
    if (mine.length) return mine;
    if (scope && scope.type === 'semester') return [];
    const rows = (gradesByCourse && gradesByCourse[course.courseId]) || [];
    return rows.map((r) => r.score).filter((v) => Number.isFinite(v));
  }

  // Lectures/practices filtered to a scope; year scope uses stored aggregates.
  function scopeData(course, scope) {
    if (!scope || scope.type !== 'semester') {
      return {
        lectures: course.lectures,
        practices: course.practices,
        scores: course.practices.scores.map((s) => s.score),
      };
    }
    const lectures = { done: 0, total: 0 };
    const practices = { graded: 0, submitted: 0, todo: 0, total: 0 };
    const scores = [];
    ((course && course.sections) || []).forEach((s) => {
      if (!s || s.semester !== scope.n) return;
      lectures.done += s.lectures.done; lectures.total += s.lectures.total;
      practices.graded += s.practices.graded;
      practices.submitted += s.practices.submitted;
      practices.todo += s.practices.todo;
      practices.total += s.practices.total;
    });
    ((course && course.practices && course.practices.scores) || []).forEach((sc) => {
      if (!scope || scope.type !== 'semester' || sc.semester === scope.n) scores.push(sc.score);
    });
    return { lectures, practices, scores };
  }

  // Sorted union of semester numbers across courses.
  function allSemesters(courses) {
    const set = {};
    (courses || []).forEach((c) => {
      ((c && c.sections) || []).forEach((s) => {
        if (s && s.semester) set[s.semester] = true;
      });
    });
    return Object.keys(set).map(Number).sort((a, b) => a - b);
  }

  // Explicit user choice wins; else auto-detected current semester; else year.
  function resolveScope(P, settings, courses, nowMs) {
    const sems = allSemesters(courses);
    const saved = settings && settings.scope;
    if (saved && saved.type === 'semester' && sems.indexOf(saved.n) !== -1) {
      return { type: 'semester', n: saved.n };
    }
    if (saved && saved.type === 'year') return { type: 'year' };
    const auto = P.detectCurrentSemester(courses, nowMs);
    if (auto !== null && sems.indexOf(auto) !== -1) return { type: 'semester', n: auto };
    return { type: 'year' };
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

  function totalsHtml(t, view, prefs) {
    let lecDone = 0, lecTotal = 0, prDone = 0, prPending = 0, prTotal = 0;
    view.forEach(({ c, d }) => {
      const pref = (prefs.courses || {})[c.courseId] || { included: true };
      if (pref.included === false) return;
      lecDone += d.lectures.done; lecTotal += d.lectures.total;
      prDone += d.practices.graded; prPending += d.practices.submitted;
      prTotal += d.practices.total;
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

    const root = el(doc, 'div', 'op-root' + (opts.compact ? ' op-compact' : ''));

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

    const scope = opts.scope || { type: 'year' };
    const semesters = opts.semesters || [];
    // Semester scope lists only that semester's courses; year lists all.
    const visible = (scope.type === 'semester')
      ? courses.filter((c) => ((c.sections || []).some((s) => s && s.semester === scope.n)))
      : courses;
    if (semesters.length) {
      const bar = el(doc, 'div', 'op-scope');
      bar.setAttribute('role', 'group');
      bar.setAttribute('aria-label', t('ariaScope'));
      const addBtn = (label, active, value) => {
        const b = el(doc, 'button', 'op-scope-btn' + (active ? ' on' : ''), label);
        b.type = 'button';
        b.setAttribute('aria-pressed', active ? 'true' : 'false');
        b.addEventListener('click', () => opts.onScope(value));
        bar.appendChild(b);
      };
      semesters.forEach((n) => {
        addBtn(t('scopeSemester', { n }), scope.type === 'semester' && scope.n === n, { type: 'semester', n });
      });
      addBtn(t('scopeYear'), scope.type !== 'semester', { type: 'year' });
      root.appendChild(bar);
    }

    const view = visible.map((c) => ({ c, d: scopeData(c, scope) }));
    const totals = el(doc, 'section', 'op-totals');
    totals.innerHTML = visible.length ? totalsHtml(t, view, prefs) : t('noData');
    root.appendChild(totals);

    const actions = el(doc, 'div', 'op-actions');
    const resetBtn = el(doc, 'button', 'op-reset', t('reset'));
    resetBtn.type = 'button';
    resetBtn.addEventListener('click', () => opts.onReset());
    actions.appendChild(resetBtn);
    root.appendChild(actions);

    const list = el(doc, 'div', 'op-list');
    if (!visible.length) {
      list.textContent = courses.length ? t('emptyScope') : t('empty', { url: 'https://b.optima-osvita.org/my/' });
    }
    for (const { c, d } of view) {
      const rawPref = (prefs.courses || {})[c.courseId] || { included: true, mode: '12' };
      const pref = { included: rawPref.included !== false, mode: normalizeMode(rawPref.mode) };
      const result = courseResult(P, t, scoresFor(c, opts.gradesByCourse, scope), pref.mode);

      const box = el(doc, 'div', 'op-course' + (pref.included === false ? ' off' : ''));
      const row = el(doc, 'div', 'op-row');
      const check = doc.createElement('input');
      check.type = 'checkbox';
      check.className = 'op-check';
      check.checked = pref.included !== false;
      check.setAttribute('aria-label', t('ariaInclude', { title: c.title }));
      const titleEl = el(doc, 'span', 'op-title2', c.title);
      titleEl.title = c.title;
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
        done: d.lectures.done, total: d.lectures.total,
        graded: d.practices.graded, ptotal: d.practices.total,
        submitted: d.practices.submitted, todo: d.practices.todo,
      })));
      box.appendChild(el(doc, 'div', 'op-avg',
        (pref.mode === '100' ? t('avgTotal') : t('avgMean')) + result));
      list.appendChild(box);
    }
    root.appendChild(list);
    root.appendChild(el(doc, 'footer', 'op-foot', t('footer')));
    return root;
  }

  window.OptimaStatsView = { buildStatsView, normalizeMode, scoresFor, scopeData, allSemesters, resolveScope };
})();
