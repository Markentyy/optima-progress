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

  // Semester number from a section label ("Заняття, 5 семестр" -> 5).
  // A course spanning both semesters simply has sections in each one and
  // shows up in both semester scopes. Sections without a number (e.g.
  // "Анонси") stay visible in year scope only.
  function semesterFromLabel(label) {
    const s = String(label || '');
    const direct = s.match(/(\d+)\s*семестр/i);
    if (direct) return Number(direct[1]);
    const reversed = s.match(/семестр\s*(\d+)/i);
    return reversed ? Number(reversed[1]) : null;
  }

  // Expected date from a cell ("очікуваний: 7 вересня 2026" -> UTC ms).
  // Month names are Ukrainian (genitive preferred, nominative accepted).
  const UA_MONTHS = {
    'січня': 0, 'січень': 0, 'лютого': 1, 'лютий': 1, 'березня': 2, 'березень': 2,
    'квітня': 3, 'квітень': 3, 'травня': 4, 'травень': 4, 'червня': 5, 'червень': 5,
    'липня': 6, 'липень': 6, 'серпня': 7, 'серпень': 7, 'вересня': 8, 'вересень': 8,
    'жовтня': 9, 'жовтень': 9, 'листопада': 10, 'листопад': 10, 'грудня': 11, 'грудень': 11,
  };

  function parseExpectedDate(raw) {
    const m = String(raw || '').match(/(\d{1,2})\s+([а-яіїєґ]+)\s+(\d{4})/i);
    if (!m) return null;
    const mo = UA_MONTHS[m[2].toLowerCase()];
    if (mo === undefined) return null;
    const day = Number(m[1]);
    if (day < 1 || day > 31) return null;
    return Date.UTC(Number(m[3]), mo, day);
  }

  // Current semester across courses: the one whose date range holds `nowMs`,
  // else the nearest one. Null when no dates exist at all.
  function detectCurrentSemester(courses, nowMs) {
    const now = nowMs !== undefined ? nowMs : Date.now();
    const ranges = {};
    (courses || []).forEach((c) => {
      ((c && c.sections) || []).forEach((s) => {
        if (!s || !s.semester || s.minTs === null || s.minTs === undefined) return;
        const r = ranges[s.semester] || (ranges[s.semester] = { min: s.minTs, max: s.maxTs });
        if (s.minTs < r.min) r.min = s.minTs;
        if (s.maxTs > r.max) r.max = s.maxTs;
      });
    });
    const sems = Object.keys(ranges).map(Number);
    if (!sems.length) return null;
    for (const n of sems) {
      if (now >= ranges[n].min && now <= ranges[n].max) return n;
    }
    let best = sems[0];
    let bestDist = Math.min(Math.abs(now - ranges[best].min), Math.abs(now - ranges[best].max));
    for (const n of sems) {
      const d = Math.min(Math.abs(now - ranges[n].min), Math.abs(now - ranges[n].max));
      if (d < bestDist) { bestDist = d; best = n; }
    }
    return best;
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

      // One scale block may hold several semester sections in a row
      // (h6 + cells, h6 + cells). Walk children in order so every cell
      // lands in its own section instead of the first h6 of the block.
      card.querySelectorAll('.block_optima_indicators__scale').forEach((scale) => {
        let current = null;
        let parsed = 0;
        const ensureSection = (label) => {
          current = {
            label, semester: semesterFromLabel(label), minTs: null, maxTs: null,
            lectures: { done: 0, total: 0 },
            practices: { graded: 0, submitted: 0, todo: 0, total: 0 },
          };
          course.sections.push(current);
          return current;
        };
        const parseCell = (cell) => {
          const sec = current || ensureSection('');
          const name = cell.getAttribute('data-name') || '';
          const kind = classifyActivity(name);
          const status = cellStatus(cell.className);
          const url = cell.getAttribute('href') || '';
          const ts = parseExpectedDate(cell.getAttribute('data-date'));
          if (ts !== null && (sec.minTs === null || ts < sec.minTs)) sec.minTs = ts;
          if (ts !== null && (sec.maxTs === null || ts > sec.maxTs)) sec.maxTs = ts;
          const valueEl = cell.querySelector('.block_optima_indicators__value');
          let score = valueEl ? toNumber(valueEl.textContent) : null;
          if (score === null) {
            const m = String(cell.getAttribute('aria-label') || '').match(/Оцінка:\s*([\d.,]+)/);
            if (m) score = toNumber(m[1]);
          }
          parsed += 1;

          if (kind === 'lecture') {
            sec.lectures.total += 1;
            course.lectures.total += 1;
            if (status === 'completed') {
              sec.lectures.done += 1;
              course.lectures.done += 1;
            }
          } else if (kind === 'practice') {
            sec.practices.total += 1;
            course.practices.total += 1;
            if (score !== null) {
              sec.practices.graded += 1;
              course.practices.graded += 1;
              course.practices.scores.push({ name, score, url, semester: sec.semester });
            } else if (status === 'submitted') {
              sec.practices.submitted += 1;
              course.practices.submitted += 1;
            } else {
              sec.practices.todo += 1;
              course.practices.todo += 1;
            }
          }
        };
        Array.from(scale.children).forEach((child) => {
          if (!child.matches) return;
          if (child.matches('h6.block_optima_indicators__section')) {
            ensureSection((child.textContent || '').trim());
          } else if (child.matches('.block_optima_indicators__cells')) {
            child.querySelectorAll('a[data-region="optima-indicators-cell"]').forEach(parseCell);
          } else if (child.matches('a[data-region="optima-indicators-cell"]')) {
            parseCell(child);
          }
          // info blocks and anything else are ignored
        });
        // Safety net for exotic nesting: no recognizable structure, but cells exist.
        if (parsed === 0 && scale.querySelector('a[data-region="optima-indicators-cell"]')) {
          const labelEl = scale.querySelector('.block_optima_indicators__section');
          ensureSection(labelEl ? labelEl.textContent.trim() : '');
          scale.querySelectorAll('a[data-region="optima-indicators-cell"]').forEach(parseCell);
        }
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
    semesterFromLabel,
    parseExpectedDate,
    detectCurrentSemester,
    parseMyPage,
    parseGradeReport,
    mean,
    sumScores,
    ectsLetter,
    nationalFor100,
  };
})();
