/* Popup: checkboxes per course, manual per-course mode 12/100, totals across checked.
 * School (12): average = sum / n. College (100): SUM of practice scores + ECTS + national grade.
 * Scores come from /my/; the per-course grade report is a fallback when /my/ has none.
 * No global average (meaningless). All data stays in chrome.storage.local. */
(function () {
  'use strict';
  const P = window.OptimaParsers;

  function normalizeMode(m) {
    return m === '100' ? '100' : '12';
  }

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

  // Grade-report scores are used only when /my/ has none: no double counting.
  function scoresFor(course, gradesByCourse) {
    const mine = course.practices.scores.map((s) => s.score);
    if (mine.length) return mine;
    const rows = gradesByCourse[course.courseId] || [];
    return rows.map((r) => r.score).filter((v) => Number.isFinite(v));
  }

  // School: arithmetic mean. College: SUM of received practice scores.
  function courseResult(scores, mode) {
    if (!scores.length) return '-';
    if (mode === '100') {
      const total = P.sumScores(scores);
      const nat = P.nationalFor100(total);
      return total + ' / 100 · ECTS ' + nat.ects + ' · ' + nat.grade5 + ' (' + nat.label + ')';
    }
    return P.mean(scores).toFixed(2) + ' / 12';
  }

  function renderTotals(courses, prefs) {
    const el = document.getElementById('totals');
    let lecDone = 0, lecTotal = 0, prDone = 0, prPending = 0, prTotal = 0;
    courses.forEach((c) => {
      const pref = (prefs.courses || {})[c.courseId] || { included: true };
      if (pref.included === false) return;
      lecDone += c.lectures.done; lecTotal += c.lectures.total;
      prDone += c.practices.graded; prPending += c.practices.submitted;
      prTotal += c.practices.total;
    });
    el.innerHTML =
      '<b>Selected total:</b> lectures done ' + lecDone + ' / ' + lecTotal +
      ' (left ' + (lecTotal - lecDone) + '); practices done ' + prDone + ' / ' + prTotal +
      ' (left ' + (prTotal - prDone) + ', pending ' + prPending + ').';
  }

  async function render() {
    const { courses, gradesByCourse, settings } = await load();
    renderTotals(courses, settings);
    const list = document.getElementById('list');
    list.innerHTML = '';
    if (!courses.length) {
      list.textContent = 'Empty for now. Open https://b.optima-osvita.org/my/ - data is collected automatically.';
      return;
    }
    for (const c of courses) {
      const rawPref = (settings.courses || {})[c.courseId] || { included: true, mode: '12' };
      const pref = { included: rawPref.included !== false, mode: normalizeMode(rawPref.mode) };
      const result = courseResult(scoresFor(c, gradesByCourse), pref.mode);

      const box = document.createElement('div');
      box.className = 'course' + (pref.included === false ? ' off' : '');
      box.innerHTML =
        '<div class="row"><input type="checkbox">' +
        '<span class="title"></span>' +
        '<select><option value="12">School 12</option><option value="100">College 100</option></select></div>' +
        '<div class="meta"></div><div class="avg"></div>';
      box.querySelector('.title').textContent = c.title;
      const check = box.querySelector('input');
      check.checked = pref.included !== false;
      check.setAttribute('aria-label', 'Include: ' + c.title);
      const sel = box.querySelector('select');
      sel.value = pref.mode;
      sel.setAttribute('aria-label', 'Grading scale: ' + c.title);
      check.addEventListener('change', async () => {
        await setCoursePref(c.courseId, { included: check.checked, mode: sel.value });
        render();
      });
      sel.addEventListener('change', async () => {
        await setCoursePref(c.courseId, { included: check.checked, mode: sel.value });
        render();
      });
      box.querySelector('.meta').textContent =
        'Lectures: ' + c.lectures.done + '/' + c.lectures.total +
        ' · Practices: done ' + c.practices.graded + '/' + c.practices.total +
        ' (pending ' + c.practices.submitted + ', todo ' + c.practices.todo + ')';
      box.querySelector('.avg').textContent =
        (pref.mode === '100' ? 'Total (practices): ' : 'Mean (practices): ') + result;
      list.appendChild(box);
    }
  }

  document.getElementById('reset').addEventListener('click', async () => {
    await new Promise((r) => chrome.storage.local.set({ optimaSettings: { courses: {} } }, r));
    render();
  });

  render();
})();
