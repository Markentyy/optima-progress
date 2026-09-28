/* Parser/calculator regression tests. Synthetic DOM mirrors the real Moodle markup.
 * Run: npm test (needs devDependencies installed). */
const fs = require('fs');
const { JSDOM } = require('jsdom');

global.window = {};
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'parsers.js'), 'utf8');
eval(src);
const P = global.window.OptimaParsers;
const assert = require('assert');
let n = 0;
const ok = (cond, msg) => { n++; assert.ok(cond, msg); };

// ---------- pure helpers ----------
ok(P.toNumber('12') === 12, 'num 12');
ok(P.toNumber('80 %') === 80, 'num percent');
ok(P.toNumber('13,5') === 13.5, 'num comma');
ok(P.toNumber('0') === 0, 'num zero is 0 not null');
ok(P.toNumber('-') === null, 'dash null');
ok(P.toNumber('--') === null, 'ddash null');
ok(P.toNumber('') === null, 'empty null');
ok(P.toNumber('abc') === null, 'junk null');
ok(P.toNumber(null) === null, 'null null');

ok(P.classifyActivity('Лекція 1. Поняття') === 'lecture', 'lecture');
ok(P.classifyActivity('лекція 2') === 'lecture', 'lecture lower');
ok(P.classifyActivity('Практичне заняття 1') === 'practice', 'practical');
ok(P.classifyActivity('Лабораторне заняття 1') === 'practice', 'lab');
ok(P.classifyActivity('Тест 1. Тема') === 'practice', 'test');
ok(P.classifyActivity('Завдання 1. Есе') === 'practice', 'assign');
ok(P.classifyActivity("Комп'ютерний практикум 1") === 'practice', 'praktikum');
ok(P.classifyActivity('Залік із дисципліни') === 'practice', 'zalik');
ok(P.classifyActivity('Форум курсу') === 'other', 'forum other');
ok(P.classifyActivity('08.09.2026 Поведінка лідера') === 'other', 'chat other');
ok(P.classifyActivity('') === 'other', 'empty other');

ok(P.courseIdFromUrl('/course/view.php?id=1005') === '1005', 'rel id');
ok(P.courseIdFromUrl('https://b.optima-osvita.org/course/view.php?id=987') === '987', 'abs id');

const bounds = [[90,'A'],[89,'B'],[82,'B'],[81,'C'],[74,'C'],[73,'D'],[64,'D'],[63,'E'],[60,'E'],[59,'FX'],[35,'FX'],[34,'F'],[0,'F'],[120,'A']];
for (const [v, l] of bounds) ok(P.ectsLetter(v) === l, 'ects ' + v + '=' + l);
ok(P.nationalFor100(100).grade5 === 5 && P.nationalFor100(100).label === 'Excellent', 'nat A');
ok(P.nationalFor100(85).grade5 === 4, 'nat B');
ok(P.nationalFor100(70).grade5 === 3, 'nat D');
ok(P.nationalFor100(25).grade5 === 2, 'nat F');
ok(P.mean([]) === null && P.sumScores([]) === null, 'empty nulls');

// ---------- synthetic /my/ ----------
const cell = (cls, name, aria, inner) =>
  `<a class="block_optima_indicators__cell block_optima_indicators__cell--linked ${cls}" href="https://b.optima-osvita.org/mod/quiz/view.php?id=1" data-region="optima-indicators-cell" data-name="${name}" aria-label="${aria}">${inner}</a>`;
const checkIcon = '<i class="block_optima_indicators__icon icon-optima2-indicators-check"></i>';
const clipIcon = '<i class="block_optima_indicators__icon icon-optima2-indicators-clipboard"></i>';
const clockIcon = '<i class="block_optima_indicators__icon icon-optima2-indicators-clock"></i>';

const html = `
<div class="block_optima_indicators__course-card">
  <div class="block_optima_indicators__course-header"><a href="https://b.optima-osvita.org/course/view.php?id=1005">Лідерство 3 курс</a></div>
  <div class="block_optima_indicators__scale">
    <h6 class="block_optima_indicators__section">Заняття, 5 семестр</h6>
    <div class="block_optima_indicators__cells">
      ${cell('block_optima_indicators__cell--completed block_optima_indicators__cell--lesson', 'Лекція 1. Поняття', 'Лекція 1. Поняття. Виконано.', checkIcon)}
      ${cell('block_optima_indicators__cell--completed block_optima_indicators__cell--quiz', 'Практичне заняття 1', 'Практичне заняття 1. Виконано. Оцінка: 12.', '<span class="block_optima_indicators__value">12</span>')}
      ${cell('block_optima_indicators__cell--completed block_optima_indicators__cell--quiz', 'Практичне заняття 2', 'Практичне заняття 2. Виконано. Оцінка: 13.', '<span class="block_optima_indicators__value">13</span>')}
      ${cell('block_optima_indicators__cell--completed block_optima_indicators__cell--quiz', 'Тест 1. Тема', 'Тест 1. Тема. Виконано. Оцінка: 11.', '')}
      ${cell('block_optima_indicators__cell--completed block_optima_indicators__cell--quiz', 'Практичне заняття 3', 'Практичне заняття 3. Виконано. Оцінка: 0.', '<span class="block_optima_indicators__value">0</span>')}
      ${cell('block_optima_indicators__cell--submitted block_optima_indicators__cell--assign', 'Практичне заняття 4', 'Практичне заняття 4. Здано, очікує оцінювання.', clockIcon)}
      ${cell('block_optima_indicators__cell--future block_optima_indicators__cell--lesson', 'Лекція 2. Теорія', 'Лекція 2. Теорія. Ще не виконано.', clipIcon)}
      ${cell('block_optima_indicators__cell--future block_optima_indicators__cell--quiz', 'Практичне заняття 5', 'Практичне заняття 5. Ще не виконано.', '<span class="block_optima_indicators__value">--</span>')}
      ${cell('block_optima_indicators__cell--future block_optima_indicators__cell--page', '03.09.2026 Анонс', '03.09.2026 Анонс. Ще не виконано.', clipIcon)}
    </div>
  </div>
</div>
<div class="block_optima_indicators__course-card">
  <div class="block_optima_indicators__course-header"><a href="https://b.optima-osvita.org/course/view.php?id=1005">Лідерство 3 курс</a></div>
  <div class="block_optima_indicators__scale">
    <h6 class="block_optima_indicators__section">Заняття, 6 семестр</h6>
    <div class="block_optima_indicators__cells">
      ${cell('block_optima_indicators__cell--completed block_optima_indicators__cell--lesson', 'Лекція 11. Підходи', 'Лекція 11. Підходи. Виконано.', checkIcon)}
    </div>
  </div>
</div>
<div class="block_optima_indicators__course-card">
  <div class="block_optima_indicators__course-header"><a href="https://b.optima-osvita.org/course/view.php?id=987">Студентське самоврядування</a></div>
  <div class="block_optima_indicators__scale">
    <h6 class="block_optima_indicators__section">Анонси</h6>
    <div class="block_optima_indicators__cells">
      ${cell('block_optima_indicators__cell--future block_optima_indicators__cell--page', '03.09.2026 Талановиті', 'Ще не виконано.', clipIcon)}
    </div>
  </div>
</div>`;

const dom = new JSDOM(`<body>${html}</body>`);
const courses = P.parseMyPage(dom.window.document);
ok(courses.length === 2, 'two courses after merge, got ' + courses.length);
const lead = courses.find((c) => c.courseId === '1005');
ok(lead.lectures.done === 2 && lead.lectures.total === 3, 'lectures 2/3 merged');
ok(lead.practices.graded === 4 && lead.practices.submitted === 1 && lead.practices.todo === 1 && lead.practices.total === 6, 'practices 4/1/1/6');
ok(JSON.stringify(lead.practices.scores.map((s) => s.score)) === '[12,13,11,0]', 'scores incl zero, aria fallback');
ok(lead.sections.length === 2, 'sections kept');
const self = courses.find((c) => c.courseId === '987');
ok(self.lectures.total === 0 && self.practices.total === 0, 'non-study ignored in counts');

// ---------- synthetic grade report ----------
const rep = new JSDOM(`<body><table class="user-grade">
<tr><th><div class="rowtitle"><a>Лекція 1</a></div></th><td class="column-grade"><div>80 %</div></td></tr>
<tr><th><div class="rowtitle"><a>Практичне заняття 1</a></div></th><td class="column-grade"><div>12</div></td></tr>
<tr><th><div class="rowtitle"><a>Практичне заняття 2</a></div></th><td class="column-grade">-</td></tr>
<tr><th><div class="rowtitle"><a>Практичне заняття 3</a></div></th><td class="column-grade"><div>--</div></td></tr>
<tr><th><div class="rowtitle"><a>Практичне заняття 5</a></div></th><td class="column-grade"><div>5</div></td></tr>
</table></body>`);
const rows = P.parseGradeReport(rep.window.document);
ok(rows.length === 2 && rows[0].score === 12 && rows[1].score === 5, 'grade report filters');

// ---------- end-to-end math on synthetic ----------
ok(P.mean([12, 13, 11, 0]) === 9, 'school mean');
ok(P.sumScores([12, 13, 11, 0]) === 36, 'profile sum');
ok(P.nationalFor100(36).ects === 'FX', '36 is FX');

console.log('ALL ' + n + ' ASSERTIONS PASSED');
