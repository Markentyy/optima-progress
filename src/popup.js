/* Popup: checkboxes per course, manual per-course mode 12/100, totals across checked.
 * School (12): average = sum / n. Profile (100): SUM of practice scores + ECTS + national grade.
 * No global average (meaningless). All data stays in chrome.storage.local. */
(function () {
  'use strict';
  const P = window.OptimaParsers;

  function normalizeMode(m) {
    return m === '100' ? '100' : '12';
  }

  async function load() {
    const data = await new Promise((r) => chrome.storage.local.get(
      ['optimaMy', 'optimaSettings'], r));
    return {
      courses: ((data.optimaMy || {}).courses) || [],
      settings: (data.optimaSettings || { courses: {} }),
    };
  }

  // School: arithmetic mean. Profile: SUM of received practice scores.
  function courseResult(course, mode) {
    const scores = course.practices.scores.map((s) => s.score);
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
      '<b>Сума по обраних:</b> лекції пройдено ' + lecDone + ' / ' + lecTotal +
      ' (залишилось ' + (lecTotal - lecDone) + '); практики здано ' + prDone + ' / ' + prTotal +
      ' (залишилось ' + (prTotal - prDone) + ', на перевірці ' + prPending + ').<br>' +
      'Загальної середньої оцінки немає: вона не має сенсу між предметами.';
  }

  async function render() {
    const { courses, settings } = await load();
    renderTotals(courses, settings);
    const list = document.getElementById('list');
    list.innerHTML = '';
    if (!courses.length) {
      list.textContent = 'Поки порожньо. Відкрийте https://b.optima-osvita.org/my/ - дані зберуться автоматично.';
      return;
    }
    for (const c of courses) {
      const rawPref = (settings.courses || {})[c.courseId] || { included: true, mode: '12' };
      const pref = { included: rawPref.included !== false, mode: normalizeMode(rawPref.mode) };
      const result = courseResult(c, pref.mode);

      const box = document.createElement('div');
      box.className = 'course' + (pref.included === false ? ' off' : '');
      box.innerHTML =
        '<div class="row"><input type="checkbox">' +
        '<span class="title"></span>' +
        '<select><option value="12">Школа 12</option><option value="100">Інститут 100</option></select></div>' +
        '<div class="meta"></div><div class="avg"></div>';
      const check = box.querySelector('input');
      check.checked = pref.included !== false;
      check.title = 'Показувати предмет і враховувати в сумі';
      check.addEventListener('change', async () => {
        await setCoursePref(c.courseId, { included: check.checked, mode: sel.value });
        render();
      });
      box.querySelector('.title').textContent = c.title;
      const sel = box.querySelector('select');
      sel.value = pref.mode;
      sel.title = 'Тип оцінювання предмета';
      sel.addEventListener('change', async () => {
        await setCoursePref(c.courseId, { included: check.checked, mode: sel.value });
        render();
      });
      box.querySelector('.meta').textContent =
        'Лекції: ' + c.lectures.done + '/' + c.lectures.total +
        ' · Практики: здано ' + c.practices.graded + '/' + c.practices.total +
        ' (перевірка ' + c.practices.submitted + ', todo ' + c.practices.todo + ')';
      box.querySelector('.avg').textContent =
        (pref.mode === '100' ? 'Сума (практики): ' : 'Середнє (практики): ') + result;
      list.appendChild(box);
    }
  }

  document.getElementById('reset').addEventListener('click', async () => {
    await new Promise((r) => chrome.storage.local.set({ optimaSettings: { courses: {} } }, r));
    render();
  });

  document.addEventListener('DOMContentLoaded', render);
  render();
})();
