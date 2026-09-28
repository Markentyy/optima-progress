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

  // NOTE: the patterns below match the site's Ukrainian UI ("Лекція", "Оцінка:"...).
  // They are data matchers, not repo language: do not translate them.
  function classifyActivity(name) {
    const n = String(name || '').trim();
    if (/^лекц/i.test(n)) return 'lecture'; // "Лекція..."
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

  // Cards of one course are merged by courseId, otherwise totals would double.
  // Scores are stored once per course (not per section) to save memory.
  function parseMyPage(doc) {
    const byId = {};
    const order = [];
    const cards = doc.querySelectorAll('.block_optima_indicators__course-card');
    cards.forEach((card) => {
      const headLink = card.querySelector('.block_optima_indicators__course-header a[href*="course/view.php"]');
      if (!headLink) return;
      const courseId = courseIdFromUrl(headLink.getAttribute('href'));
      const title = (headLink.textContent || '').trim();
      if (!courseId || !title) return;
      if (!byId[courseId]) {
        byId[courseId] = {
          courseId, title,
          sections: [],
          lectures: { done: 0, total: 0 },
          practices: { graded: 0, submitted: 0, todo: 0, total: 0, scores: [] },
        };
        order.push(courseId);
      }
      const course = byId[courseId];

      card.querySelectorAll('.block_optima_indicators__scale').forEach((scale) => {
        const labelEl = scale.querySelector('.block_optima_indicators__section');
        const label = labelEl ? labelEl.textContent.trim() : '';
        const lectures = { done: 0, total: 0 };
        const practices = { graded: 0, submitted: 0, todo: 0, total: 0 };

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
            course.lectures.total += 1;
            if (status === 'completed') {
              lectures.done += 1;
              course.lectures.done += 1;
            }
          } else if (kind === 'practice') {
            practices.total += 1;
            course.practices.total += 1;
            if (score !== null) {
              practices.graded += 1;
              course.practices.graded += 1;
              course.practices.scores.push({ name, score, url });
            } else if (status === 'submitted') {
              practices.submitted += 1;
              course.practices.submitted += 1;
            } else {
              practices.todo += 1;
              course.practices.todo += 1;
            }
          }
        });
        course.sections.push({ label, lectures, practices });
      });
    });
    return order.map((id) => byId[id]);
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

  // National 5-point grade + ECTS table:
  // A 90-100 → 5; B 82-89, C 74-81 → 4; D 64-73, E 60-63 → 3; FX 35-59, F 0-34 → 2.
  // Display labels live in OptimaI18n (g5_*), not here.
  function nationalFor100(total100) {
    const letter = ectsLetter(total100);
    if (!letter) return null;
    if (letter === 'A') return { ects: 'A', grade5: 5 };
    if (letter === 'B' || letter === 'C') return { ects: letter, grade5: 4 };
    if (letter === 'D' || letter === 'E') return { ects: letter, grade5: 3 };
    return { ects: letter, grade5: 2 };
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
