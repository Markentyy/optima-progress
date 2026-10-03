/* Semester/year scope tests: labels, dates, detection, filtering. */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

global.window = {};
for (const f of ['parsers.js', 'i18n.js', 'statsview.js']) {
  eval(fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8'));
}
const P = global.window.OptimaParsers;
const I = global.window.OptimaI18n;
const V = global.window.OptimaStatsView;
const assert = require('assert');
let n = 0;
const ok = (cond, msg) => { n++; assert.ok(cond, msg); };

// ---------- semesterFromLabel ----------
ok(P.semesterFromLabel('Заняття, 5 семестр') === 5, 'sem 5');
ok(P.semesterFromLabel('Заняття, 6 семестр') === 6, 'sem 6');
ok(P.semesterFromLabel('Семестр 5') === 5, 'reversed sem');
ok(P.semesterFromLabel('Анонси') === null, 'no sem');
ok(P.semesterFromLabel('') === null, 'empty no sem');
ok(P.semesterFromLabel(null) === null, 'null no sem');

// ---------- parseExpectedDate: all months + nominative + junk ----------
const months = [
  ['7 січня 2027', Date.UTC(2027, 0, 7)], ['2 лютого 2027', Date.UTC(2027, 1, 2)],
  ['3 березня 2027', Date.UTC(2027, 2, 3)], ['4 квітня 2027', Date.UTC(2027, 3, 4)],
  ['5 травня 2027', Date.UTC(2027, 4, 5)], ['6 червня 2027', Date.UTC(2027, 5, 6)],
  ['7 липня 2027', Date.UTC(2027, 6, 7)], ['8 серпня 2027', Date.UTC(2027, 7, 8)],
  ['7 вересня 2026', Date.UTC(2026, 8, 7)], ['9 жовтня 2026', Date.UTC(2026, 9, 9)],
  ['10 листопада 2026', Date.UTC(2026, 10, 10)], ['11 грудня 2026', Date.UTC(2026, 11, 11)],
  ['1 січень 2027', Date.UTC(2027, 0, 1)], ['1 вересень 2026', Date.UTC(2026, 8, 1)],
];
for (const [raw, ts] of months) {
  ok(P.parseExpectedDate('очікуваний: ' + raw) === ts, 'date ' + raw);
}
ok(P.parseExpectedDate('') === null, 'date empty');
ok(P.parseExpectedDate(null) === null, 'date null');
ok(P.parseExpectedDate('очікуваний: скоро') === null, 'date junk');
ok(P.parseExpectedDate('7 foo 2026') === null, 'date bad month');

// ---------- detectCurrentSemester ----------
const semCourses = [{
  courseId: '1', title: 'C',
  sections: [
    { label: 'a', semester: 5, minTs: Date.UTC(2026, 8, 1), maxTs: Date.UTC(2026, 11, 1) },
    { label: 'b', semester: 6, minTs: Date.UTC(2027, 0, 10), maxTs: Date.UTC(2027, 3, 20) },
  ],
}];
ok(P.detectCurrentSemester(semCourses, Date.UTC(2026, 9, 15)) === 5, 'inside sem5');
ok(P.detectCurrentSemester(semCourses, Date.UTC(2027, 1, 1)) === 6, 'inside sem6');
ok(P.detectCurrentSemester(semCourses, Date.UTC(2026, 5, 1)) === 5, 'before all -> nearest');
ok(P.detectCurrentSemester(semCourses, Date.UTC(2028, 5, 1)) === 6, 'after all -> nearest');
ok(P.detectCurrentSemester([{ courseId: '1', sections: [{ semester: null }] }], Date.now()) === null, 'no dates');
ok(P.detectCurrentSemester([], Date.now()) === null, 'no courses');

// ---------- parseMyPage carries semester + dates ----------
// REAL page shape: ONE scale block holds several h6+cells sections in a row.
{
  const cell = (cls, name, date, inner) =>
    `<a class="block_optima_indicators__cell ${cls}" href="https://b.optima-osvita.org/mod/quiz/view.php?id=1" data-region="optima-indicators-cell" data-name="${name}" data-date="${date}" aria-label="${name}">${inner}</a>`;
  const dom = new JSDOM(`<body>
    <div class="block_optima_indicators__course-card">
      <div class="block_optima_indicators__course-header"><a href="https://b.optima-osvita.org/course/view.php?id=1005">L</a></div>
      <div class="block_optima_indicators__scale">
        <h6 class="block_optima_indicators__section">Заняття, 5 семестр</h6>
        <div class="block_optima_indicators__cells">
          ${cell('block_optima_indicators__cell--completed block_optima_indicators__cell--lesson', 'Лекція 1', 'очікуваний: 2 вересня 2026', '<i></i>')}
          ${cell('block_optima_indicators__cell--completed block_optima_indicators__cell--quiz', 'Практичне заняття 1', 'очікуваний: 7 вересня 2026', '<span class="block_optima_indicators__value">12</span>')}
        </div>
        <h6 class="block_optima_indicators__section">Заняття, 6 семестр</h6>
        <div class="block_optima_indicators__cells">
          ${cell('block_optima_indicators__cell--future block_optima_indicators__cell--lesson', 'Лекція 11', 'очікуваний: 12 січня 2027', '<i></i>')}
          ${cell('block_optima_indicators__cell--completed block_optima_indicators__cell--quiz', 'Практичне заняття 19', 'очікуваний: 19 січня 2027', '<span class="block_optima_indicators__value">10</span>')}
        </div>
        <div class="block_optima_indicators__info"><span>hover info, ignored</span></div>
      </div>
    </div></body>`);
  const [c] = P.parseMyPage(dom.window.document);
  ok(c.sections.length === 2, 'two sections from one scale, got ' + c.sections.length);
  ok(c.sections[0].semester === 5 && c.sections[1].semester === 6, 'section semesters');
  ok(c.sections[0].lectures.done === 1 && c.sections[0].lectures.total === 1, 'sem5 lecture split');
  ok(c.sections[1].lectures.done === 0 && c.sections[1].lectures.total === 1, 'sem6 lecture split');
  ok(JSON.stringify(c.practices.scores.map((s) => s.score)) === '[12,10]', 'scores kept');
  ok(c.practices.scores[0].semester === 5 && c.practices.scores[1].semester === 6, 'score semesters');
  ok(c.sections[0].minTs === Date.UTC(2026, 8, 2), 'sem5 dates');
  ok(c.sections[1].maxTs === Date.UTC(2027, 0, 19), 'sem6 dates');
  const d5 = V.scopeData(c, { type: 'semester', n: 5 });
  ok(d5.lectures.done === 1 && d5.lectures.total === 1, 'sem5 view counts');
  ok(JSON.stringify(d5.scores) === '[12]', 'sem5 view scores');
  const d6 = V.scopeData(c, { type: 'semester', n: 6 });
  ok(d6.lectures.done === 0 && d6.lectures.total === 1, 'sem6 view counts');
  ok(JSON.stringify(d6.scores) === '[10]', 'sem6 view scores');
  ok(JSON.stringify(V.allSemesters([c])) === '[5,6]', 'allSemesters');
  ok(JSON.stringify(V.resolveScope(P, {}, [c], Date.UTC(2026, 9, 15))) === JSON.stringify({ type: 'semester', n: 5 }), 'auto sem5');
  ok(V.resolveScope(P, { scope: { type: 'semester', n: 6 } }, [c], 0).n === 6, 'saved wins');
}

// ---------- foreign-language course: lesson-type cells named "Практичне" ----------
// Green checks are lectures whatever they are called; numbers are practices.
{
  const check = (name, date) =>
    `<a class="block_optima_indicators__cell block_optima_indicators__cell--completed block_optima_indicators__cell--lesson" href="https://b.optima-osvita.org/mod/lesson/view.php?id=1" data-region="optima-indicators-cell" data-name="${name}" data-date="${date}" aria-label="${name}. Виконано."><i></i></a>`;
  const futureLesson = (name, date) =>
    `<a class="block_optima_indicators__cell block_optima_indicators__cell--future block_optima_indicators__cell--lesson" href="https://b.optima-osvita.org/mod/lesson/view.php?id=1" data-region="optima-indicators-cell" data-name="${name}" data-date="${date}" aria-label="${name}. Ще не виконано."><i></i></a>`;
  const gradedQuiz = (name, date, score) =>
    `<a class="block_optima_indicators__cell block_optima_indicators__cell--completed block_optima_indicators__cell--quiz" href="https://b.optima-osvita.org/mod/quiz/view.php?id=1" data-region="optima-indicators-cell" data-name="${name}" data-date="${date}" aria-label="${name}. Виконано. Оцінка: ${score}."><span class="block_optima_indicators__value">${score}</span></a>`;
  const futureQuiz = (name, date) =>
    `<a class="block_optima_indicators__cell block_optima_indicators__cell--future block_optima_indicators__cell--quiz" href="https://b.optima-osvita.org/mod/quiz/view.php?id=1" data-region="optima-indicators-cell" data-name="${name}" data-date="${date}" aria-label="${name}. Ще не виконано."><span class="block_optima_indicators__value">--</span></a>`;
  let sem5cells = '';
  for (let i = 1; i <= 5; i++) sem5cells += check('Практичне заняття ' + i + '. Digital Era', 'очікуваний: 7 вересня 2026');
  sem5cells += gradedQuiz('Тест 1. Ethics', 'очікуваний: 5 жовтня 2026', 20);
  for (let i = 6; i <= 12; i++) sem5cells += futureLesson('Практичне заняття ' + i + '. Topic', 'очікуваний: 12 жовтня 2026');
  for (let i = 2; i <= 4; i++) sem5cells += futureQuiz('Тест ' + i + '. Topic', 'очікуваний: 19 жовтня 2026');
  let sem6cells = '';
  for (let i = 13; i <= 15; i++) sem6cells += futureLesson('Практичне заняття ' + i + '. Topic', 'очікуваний: 11 січня 2027');
  const dom = new JSDOM(`<body>
    <div class="block_optima_indicators__course-card">
      <div class="block_optima_indicators__course-header"><a href="https://b.optima-osvita.org/course/view.php?id=826">English</a></div>
      <div class="block_optima_indicators__scale">
        <h6 class="block_optima_indicators__section">Заняття, 5 семестр</h6>
        <div class="block_optima_indicators__cells">${sem5cells}</div>
        <h6 class="block_optima_indicators__section">Заняття, 6 семестр</h6>
        <div class="block_optima_indicators__cells">${sem6cells}</div>
      </div>
    </div></body>`);
  const [c] = P.parseMyPage(dom.window.document);
  ok(c.lectures.done === 5 && c.lectures.total === 15, 'checks are lectures, got ' + c.lectures.done + '/' + c.lectures.total);
  ok(c.practices.graded === 1 && c.practices.todo === 3 && c.practices.total === 4, 'one graded, three todo');
  ok(JSON.stringify(c.practices.scores.map((s) => s.score)) === '[20]', 'only the number counts');
  const d5 = V.scopeData(c, { type: 'semester', n: 5 });
  ok(d5.lectures.done === 5 && d5.lectures.total === 12, 'sem5 lectures');
  ok(JSON.stringify(d5.scores) === '[20]', 'sem5 scores');
  const d6 = V.scopeData(c, { type: 'semester', n: 6 });
  ok(d6.lectures.done === 0 && d6.lectures.total === 3, 'sem6 lectures');
  ok(JSON.stringify(d6.scores) === '[]', 'sem6 no scores');
}
// ---------- view filtering per scope ----------
function scopedCourse() {
  return {
    courseId: '1', title: 'C',
    lectures: { done: 3, total: 5 },
    practices: {
      graded: 2, submitted: 0, todo: 1, total: 3,
      scores: [
        { name: 'P1', score: 12, url: '', semester: 5 },
        { name: 'P2', score: 10, url: '', semester: 6 },
      ],
    },
    sections: [
      { label: 's5', semester: 5, lectures: { done: 2, total: 3 }, practices: { graded: 1, submitted: 0, todo: 0, total: 1 } },
      { label: 's6', semester: 6, lectures: { done: 1, total: 2 }, practices: { graded: 1, submitted: 0, todo: 1, total: 2 } },
    ],
  };
}
{
  const d5 = V.scopeData(scopedCourse(), { type: 'semester', n: 5 });
  ok(d5.lectures.done === 2 && d5.lectures.total === 3, 'sem5 lectures');
  ok(JSON.stringify(d5.scores) === '[12]', 'sem5 scores');
  const dy = V.scopeData(scopedCourse(), { type: 'year' });
  ok(dy.lectures.total === 5 && JSON.stringify(dy.scores) === '[12,10]', 'year all');
  ok(JSON.stringify(V.scoresFor(scopedCourse(), {}, { type: 'semester', n: 5 })) === '[12]', 'scoresFor sem');
  // journal fallback: year only
  const bare = { courseId: '9', practices: { scores: [] } };
  ok(JSON.stringify(V.scoresFor(bare, { 9: [{ score: 7 }] }, { type: 'year' })) === '[7]', 'journal year');
  ok(JSON.stringify(V.scoresFor(bare, { 9: [{ score: 7 }] }, { type: 'semester', n: 5 })) === '[]', 'journal skipped in sem');
}
// scope switcher renders in all languages, no undefined
function twoCourses() {
  const a = scopedCourse();
  a.courseId = '1';
  a.title = 'Both sems';
  const b = scopedCourse();
  b.courseId = '2';
  b.title = 'Sixth only';
  b.sections = b.sections.filter((s) => s.semester === 6);
  b.lectures = { done: 1, total: 2 };
  b.practices = { graded: 1, submitted: 0, todo: 1, total: 2, scores: [{ name: 'P2', score: 10, url: '', semester: 6 }] };
  return [a, b];
}
for (const l of ['en', 'uk', 'ru']) {
  const dom = new JSDOM('<body></body>');
  const node = V.buildStatsView(dom.window.document, {
    courses: twoCourses(), gradesByCourse: {}, settings: { courses: {} },
    lang: l, scope: { type: 'semester', n: 5 }, semesters: [5, 6],
    onScope: () => {}, onLang: () => {}, onPref: () => {}, onReset: () => {},
  });
  const html = node.outerHTML;
  ok(html.indexOf('undefined') === -1, l + ' no undefined');
  ok(node.querySelectorAll('button.op-scope-btn').length === 3, l + ' three scope buttons');
  ok(node.querySelectorAll('div.op-course').length === 1, l + ' only sem5 course listed');
  ok(html.indexOf('Both sems') !== -1 && html.indexOf('Sixth only') === -1, l + ' sem6 course hidden');
  ok(html.indexOf('2/3') !== -1, l + ' sem5 lecture counts in meta');
  ok(html.indexOf('12.00 / 12') !== -1, l + ' sem5 mean of [12]');
}
// year scope lists everything
{
  const dom = new JSDOM('<body></body>');
  const node = V.buildStatsView(dom.window.document, {
    courses: twoCourses(), gradesByCourse: {}, settings: { courses: {} },
    lang: 'en', scope: { type: 'year' }, semesters: [5, 6],
    onScope: () => {}, onLang: () => {}, onPref: () => {}, onReset: () => {},
  });
  ok(node.querySelectorAll('div.op-course').length === 2, 'year lists all');
}
// spanning course shows correct numbers in BOTH semesters
function renderScope(courses, scope, semesters) {
  const dom = new JSDOM('<body></body>');
  return V.buildStatsView(dom.window.document, {
    courses, gradesByCourse: {}, settings: { courses: {} },
    lang: 'en', scope, semesters,
    onScope: () => {}, onLang: () => {}, onPref: () => {}, onReset: () => {},
  });
}
{
  const sem6 = renderScope(twoCourses(), { type: 'semester', n: 6 }, [5, 6]);
  ok(sem6.querySelectorAll('div.op-course').length === 2, 'sem6 lists both spanning courses');
  ok(sem6.outerHTML.indexOf('1/2') !== -1, 'sem6 lecture counts');
  ok(sem6.outerHTML.indexOf('10.00 / 12') !== -1, 'sem6 mean of [10]');
}
// unlabeled sections: year only, hidden from semester scopes
{
  const unlabeled = [{
    courseId: '3', title: 'No sems',
    lectures: { done: 1, total: 1 },
    practices: { graded: 1, submitted: 0, todo: 0, total: 1, scores: [{ name: 'P', score: 8, url: '', semester: null }] },
    sections: [{ label: 'Анонси', semester: null, lectures: { done: 1, total: 1 }, practices: { graded: 1, submitted: 0, todo: 0, total: 1 } }],
  }];
  const sem = renderScope(unlabeled, { type: 'semester', n: 5 }, [5]);
  ok(sem.querySelectorAll('div.op-course').length === 0, 'unlabeled hidden in sem scope');
  const year = renderScope(unlabeled, { type: 'year' }, [5]);
  ok(year.querySelectorAll('div.op-course').length === 1, 'unlabeled visible in year');
}
// semester with no courses at all
{
  const dom = new JSDOM('<body></body>');
  const node = V.buildStatsView(dom.window.document, {
    courses: twoCourses(), gradesByCourse: {}, settings: { courses: {} },
    lang: 'uk', scope: { type: 'semester', n: 7 }, semesters: [5, 6, 7],
    onScope: () => {}, onLang: () => {}, onPref: () => {}, onReset: () => {},
  });
  ok(node.querySelectorAll('div.op-course').length === 0, 'empty semester lists none');
  ok(node.outerHTML.indexOf('у цьому семестрі') !== -1, 'empty semester message');
}

console.log('ALL ' + n + ' ASSERTIONS PASSED');
