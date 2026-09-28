/* UI strings: English, Ukrainian, Russian. Course titles and activity names
 * are site data and are never translated. Extend all three languages together:
 * test/i18n.test.js fails CI on missing keys. */
(function () {
  'use strict';

  const STR = {
    en: {
      title: 'Optima Progress',
      hint: 'Tick courses to include them. School - mean, college - total + ECTS.',
      noData: 'No data yet. Open the /my/ page to collect progress.',
      reset: 'Reset settings',
      footer: 'Everything is computed locally in your browser. The extension sends nothing anywhere.',
      totals: '<b>Selected total:</b> lectures done {lecDone} / {lecTotal} (left {lecLeft}); practices done {prDone} / {prTotal} (left {prLeft}, pending {prPending}).',
      empty: 'Empty for now. Open {url} - data is collected automatically.',
      modeSchool: 'School 12',
      modeCollege: 'College 100',
      ariaInclude: 'Include: {title}',
      ariaScale: 'Grading scale: {title}',
      ariaLang: 'Interface language',
      meta: 'Lectures: {done}/{total} · Practices: done {graded}/{ptotal} (pending {submitted}, todo {todo})',
      avgMean: 'Mean (practices): ',
      avgTotal: 'Total (practices): ',
      g5_5: 'Excellent',
      g5_4: 'Good',
      g5_3: 'Satisfactory',
      g5_2: 'Fail',
    },
    uk: {
      title: 'Optima Progress',
      hint: 'Позначте предмети галочками. Школа - середнє, профіль - сума + ECTS.',
      noData: 'Немає даних. Відкрийте сторінку /my/, щоб зібрати прогрес.',
      reset: 'Скинути налаштування',
      footer: 'Усе рахується локально у вашому браузері. Розширення нічого нікуди не надсилає.',
      totals: '<b>Сума по обраних:</b> лекції пройдено {lecDone} / {lecTotal} (залишилось {lecLeft}); практики здано {prDone} / {prTotal} (залишилось {prLeft}, на перевірці {prPending}).',
      empty: 'Поки порожньо. Відкрийте {url} - дані зберуться автоматично.',
      modeSchool: 'Школа 12',
      modeCollege: 'Інститут 100',
      ariaInclude: 'Враховувати: {title}',
      ariaScale: 'Тип оцінювання: {title}',
      ariaLang: 'Мова інтерфейсу',
      meta: 'Лекції: {done}/{total} · Практики: здано {graded}/{ptotal} (перевірка {submitted}, todo {todo})',
      avgMean: 'Середнє (практики): ',
      avgTotal: 'Сума (практики): ',
      g5_5: 'Відмінно',
      g5_4: 'Добре',
      g5_3: 'Задовільно',
      g5_2: 'Незадовільно',
    },
    ru: {
      title: 'Optima Progress',
      hint: 'Отметьте предметы галочками. Школа - среднее, профиль - сумма + ECTS.',
      noData: 'Нет данных. Откройте страницу /my/, чтобы собрать прогресс.',
      reset: 'Сбросить настройки',
      footer: 'Все считается локально в вашем браузере. Расширение ничего никуда не отправляет.',
      totals: '<b>Сумма по выбранным:</b> лекции пройдено {lecDone} / {lecTotal} (осталось {lecLeft}); практики сдано {prDone} / {prTotal} (осталось {prLeft}, на проверке {prPending}).',
      empty: 'Пока пусто. Откройте {url} - данные соберутся автоматически.',
      modeSchool: 'Школа 12',
      modeCollege: 'Институт 100',
      ariaInclude: 'Учитывать: {title}',
      ariaScale: 'Тип оценивания: {title}',
      ariaLang: 'Язык интерфейса',
      meta: 'Лекции: {done}/{total} · Практики: сдано {graded}/{ptotal} (проверка {submitted}, todo {todo})',
      avgMean: 'Среднее (практики): ',
      avgTotal: 'Сумма (практики): ',
      g5_5: 'Отлично',
      g5_4: 'Хорошо',
      g5_3: 'Удовлетворительно',
      g5_2: 'Неудовлетворительно',
    },
  };

  function normalizeLang(l) {
    return l === 'uk' || l === 'ru' ? l : 'en';
  }

  function fmt(tpl, vars) {
    return String(tpl).replace(/\{(\w+)\}/g, (_, k) =>
      (vars && vars[k] !== undefined && vars[k] !== null ? vars[k] : '{' + k + '}'));
  }

  function detectLang(doc) {
    const candidates = [];
    try {
      const pageLang = doc && doc.documentElement && doc.documentElement.getAttribute('lang');
      if (pageLang) candidates.push(pageLang);
    } catch (e) { /* ignore */ }
    if (typeof navigator !== 'undefined' && navigator.language) candidates.push(navigator.language);
    for (const c of candidates) {
      const s = String(c).toLowerCase();
      if (s.indexOf('uk') === 0) return 'uk';
      if (s.indexOf('ru') === 0) return 'ru';
      if (s.indexOf('en') === 0) return 'en';
    }
    return 'en';
  }

  window.OptimaI18n = { STR, normalizeLang, fmt, detectLang };
})();
