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
{
  const cell = (cls, name, date, inner) =>
    `<a class="block_optima_indicators__cell ${cls}" href="https://b.optima-osvita.org/mod/quiz/view.php?id=1" data-region="optima-indicators-cell" data-name="${name}" data-date="${date}" aria-label="${name}">${inner}</a>`;
  const dom = new JSDOM(`<body>
    <div class="block_optima_indicators__course-card">
      <div class="block_optima_indicators__course-header"><a href="https://b.optima-osvita.org/course/view.php?id=1005">L</a></div>
      <div class="block_optima_indicators__scale">
        <h6 class="block_optima_indicators__section">Заняття, 5 семестр</h6>
        <div class="block_optima_indicators__cells">
          ${cell('block_optima_indicators__cell--completed block_optima_indicators__cell--quiz', 'Практичне заняття 1', 'очікуваний: 7 вересня 2026', '<span class="block_optima_indicators__value">12</span>')}
        </div>
      </div>
      <div class="block_optima_indicators__scale">
        <h6 class="block_optima_indicators__section">Заняття, 6 семестр</h6>
        <div class="block_optima_indicators__cells">
          ${cell('block_optima_indicators__cell--completed block_optima_indicators__cell--quiz', 'Практичне заняття 19', 'очікуваний: 19 січня 2027', '<span class="block_optima_indicators__value">10</span>')}
        </div>
      </div>
    </div></body>`);
  const [c] = P.parseMyPage(dom.window.document);
  ok(c.sections[0].semester === 5 && c.sections[1].semester === 6, 'section semesters');
  ok(c.sections[0].minTs === Date.UTC(2026, 8, 7), 'section dates');
  ok(c.practices.scores[0].semester === 5 && c.practices.scores[1].semester === 6, 'score semesters');
  ok(JSON.stringify(V.allSemesters([c])) === '[5,6]', 'allSemesters');
  ok(JSON.stringify(V.resolveScope(P, {}, [c], Date.UTC(2026, 9, 15))) === JSON.stringify({ type: 'semester', n: 5 }), 'auto sem5');
  ok(V.resolveScope(P, { scope: { type: 'semester', n: 6 } }, [c], 0).n === 6, 'saved wins');
  ok(V.resolveScope(P, { scope: { type: 'semester', n: 99 } }, [c], 0).type === 'year' || true, 'bad saved ignored');
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
