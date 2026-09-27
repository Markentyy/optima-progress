/* Shared parsers + calculators. No personal data is read or stored.
 * Only course structure (ids/titles from public curriculum links),
 * activity names, statuses and numeric grades are processed.
 */
(function () {
  'use strict';

  function toNumber(raw) {
    if (raw === null || raw === undefined) return null;
    const s = String(raw).trim().replace(',', '.').replace(/[^\d.\-]/g, '');
    if (!s || s === '-' || s === '--') return null;
    const v = Number(s);
    return Number.isFinite(v) ? v : null;
  }

  function courseIdFromUrl(url) {
    try {
      const u = new URL(url, 'https://b.optima-osvita.org');
      return u.searchParams.get('id');
    } catch (e) {
      return null;
    }
  }

  function classifyActivity(name) {
    const n = String(name || '').trim();
    if (/^лекц/i.test(n)) return 'lecture';
    if (/практичн|лабораторн|^тест|завдання|практикум|зал[іi]к|проєкт|проект|есе/i.test(n)) return 'practice';
    return 'other';
  }

  function cellStatus(className) {
    const c = String(className || '');
    if (c.includes('--completed')) return 'completed';
    if (c.includes('--submitted')) return 'submitted';
    if (c.includes('--future')) return 'future';
    return 'unknown';
  }

  function parseMyPage(doc) {
    const courses = [];
    const cards = doc.querySelectorAll('.block_optima_indicators__course-card');
    cards.forEach((card) => {
      const headLink = card.querySelector('.block_optima_indicators__course-header a[href*="course/view.php"]');
      if (!headLink) return;
      const courseId = courseIdFromUrl(headLink.getAttribute('href'));
      const title = (headLink.textContent || '').trim();
      if (!courseId || !title) return;

      const sections = [];
      card.querySelectorAll('.block_optima_indicators__scale').forEach((scale) => {
        const labelEl = scale.querySelector('.block_optima_indicators__section');
        const label = labelEl ? labelEl.textContent.trim() : '';
        const lectures = { done: 0, total: 0 };
        const practices = { graded: 0, submitted: 0, todo: 0, total: 0, scores: [] };

        scale.querySelectorAll('a[data-region="optima-indicators-cell"]').forEach((cell) => {
          const name = cell.getAttribute('data-name') || '';
          const kind = classifyActivity(name);
          const status = cellStatus(cell.className);
          const url = cell.getAttribute('href') || '';
          const valueEl = cell.querySelector('.block_optima_indicators__value');
          let score = valueEl ? toNumber(valueEl.textContent) : null;
          if (score === null) {
            const m = String(cell.getAttribute('aria-label') || '').match(/Оцінка:\s*([\d.,]+)/);
            if (m) score = toNumber(m[1]);
          }

          if (kind === 'lecture') {
            lectures.total += 1;
            if (status === 'completed') lectures.done += 1;
          } else if (kind === 'practice') {
            practices.total += 1;
            if (score !== null) {
              practices.graded += 1;
              practices.scores.push({ name, score, url });
            } else if (status === 'submitted') {
              practices.submitted += 1;
            } else {
              practices.todo += 1;
            }
          }
        });
        sections.push({ label, lectures, practices });
      });

      const totalLectures = sections.reduce((a, s) => ({ done: a.done + s.lectures.done, total: a.total + s.lectures.total }), { done: 0, total: 0 });
      const totalPractices = sections.reduce(
        (a, s) => ({
          graded: a.graded + s.practices.graded,
          submitted: a.submitted + s.practices.submitted,
          todo: a.todo + s.practices.todo,
          total: a.total + s.practices.total,
          scores: a.scores.concat(s.practices.scores),
        }),
        { graded: 0, submitted: 0, todo: 0, total: 0, scores: [] }
      );
      courses.push({ courseId, title, sections, lectures: totalLectures, practices: totalPractices });
    });
    return courses;
  }

  function parseGradeReport(doc) {
    const rows = [];
    doc.querySelectorAll('table.user-grade tr').forEach((tr) => {
      const nameEl = tr.querySelector('.rowtitle a');
      const gradeEl = tr.querySelector('td.column-grade');
      if (!nameEl || !gradeEl) return;
      const name = (nameEl.textContent || '').trim();
      const raw = (gradeEl.textContent || '').trim();
      if (!name || !raw || raw === '-' || raw === '--') return;
      if (/%/.test(raw)) return; // theory percentage, skip
      const score = toNumber(raw);
      if (score === null) return;
      rows.push({ name, score });
    });
    return rows;
  }

  function mean(scores) {
    if (!scores.length) return null;
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  function sumScores(scores) {
    if (!scores.length) return null;
    return scores.reduce((a, b) => a + b, 0);
  }

  function ectsLetter(total100) {
    if (total100 === null || !Number.isFinite(total100)) return null;
    if (total100 >= 90) return 'A';
    if (total100 >= 82) return 'B';
    if (total100 >= 74) return 'C';
    if (total100 >= 64) return 'D';
    if (total100 >= 60) return 'E';
    if (total100 >= 35) return 'FX';
    return 'F';
  }

  // Национальная 5-балльная + ECTS по таблице:
  // A 90-100 → 5 (відмінно); B 82-89, C 74-81 → 4 (добре);
  // D 64-73, E 60-63 → 3 (задовільно); FX 35-59, F 0-34 → 2 (незадовільно).
  function nationalFor100(total100) {
    const letter = ectsLetter(total100);
    if (!letter) return null;
    if (letter === 'A') return { ects: 'A', grade5: 5, label: 'відмінно' };
    if (letter === 'B' || letter === 'C') return { ects: letter, grade5: 4, label: 'добре' };
    if (letter === 'D' || letter === 'E') return { ects: letter, grade5: 3, label: 'задовільно' };
    return { ects: letter, grade5: 2, label: 'незадовільно' };
  }

  window.OptimaParsers = {
    toNumber,
    courseIdFromUrl,
    classifyActivity,
    cellStatus,
    parseMyPage,
    parseGradeReport,
    mean,
    sumScores,
    ectsLetter,
    nationalFor100,
  };
})();
