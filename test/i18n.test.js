/* i18n + shared view tests. CI fails on missing dictionary keys. */
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

// ---------- dictionary parity ----------
const langs = ['en', 'uk', 'ru'];
const baseKeys = Object.keys(I.STR.en).sort();
ok(baseKeys.length > 10, 'dict non-empty');
for (const l of langs) {
  ok(JSON.stringify(Object.keys(I.STR[l]).sort()) === JSON.stringify(baseKeys), 'parity ' + l);
  for (const k of baseKeys) {
    ok(typeof I.STR[l][k] === 'string' && I.STR[l][k].length > 0, 'filled ' + l + '.' + k);
  }
}

// ---------- fmt ----------
ok(I.fmt('A {x} B {y}', { x: 1, y: 2 }) === 'A 1 B 2', 'fmt basic');
ok(I.fmt('A {x}', {}) === 'A {x}', 'fmt missing kept');
ok(I.fmt('A {x}', { x: 0 }) === 'A 0', 'fmt zero');

// ---------- normalizeLang / detectLang ----------
ok(I.normalizeLang('uk') === 'uk' && I.normalizeLang('ru') === 'ru', 'norm uk/ru');
ok(I.normalizeLang('auto') === 'en' && I.normalizeLang() === 'en', 'norm fallback');
const fakeDoc = (lang) => ({ documentElement: { getAttribute: () => lang } });
ok(I.detectLang(fakeDoc('uk')) === 'uk', 'detect page uk');
ok(I.detectLang(fakeDoc('ru-RU')) === 'ru', 'detect page ru');
ok(I.detectLang(fakeDoc('en-US')) === 'en', 'detect page en');
ok(I.detectLang(null) === 'en', 'detect null doc');
global.__origNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
Object.defineProperty(globalThis, 'navigator', { value: { language: 'ru-RU' }, configurable: true, writable: true });
ok(I.detectLang(fakeDoc(null)) === 'ru', 'detect navigator');
if (global.__origNavigator) Object.defineProperty(globalThis, 'navigator', global.__origNavigator);
else delete globalThis.navigator;

// ---------- grade labels resolve through the dict ----------
for (const l of langs) {
  for (const g of [5, 4, 3, 2]) ok(I.STR[l]['g5_' + g].length > 1, 'label ' + l + ' ' + g);
}
const nat = P.nationalFor100(85);
ok(nat.ects === 'B' && I.STR.ru['g5_' + nat.grade5] === 'Хорошо', 'ru label via dict');

// ---------- shared view smoke test in all languages ----------
function sampleCourses() {
  return [{
    courseId: '1005',
    title: 'Sample Course',
    lectures: { done: 2, total: 3 },
    practices: {
      graded: 2, submitted: 1, todo: 1, total: 4,
      scores: [{ name: 'P1', score: 12, url: '' }, { name: 'P2', score: 13, url: '' }],
    },
  }];
}
for (const l of langs) {
  const dom = new JSDOM('<body></body>');
  const doc = dom.window.document;
  const node = V.buildStatsView(doc,
    {
      courses: sampleCourses(),
      gradesByCourse: {},
      settings: { courses: { 1005: { included: true, mode: '100' } } },
      lang: l,
      onLang: () => {}, onPref: () => {}, onReset: () => {},
    });
  const html = node.outerHTML;
  ok(html.indexOf('Sample Course') !== -1, l + ' title kept');
  ok(html.indexOf('25 / 100') !== -1, l + ' profile sum');
  ok(html.indexOf('undefined') === -1, l + ' no undefined');
  ok(node.querySelector('select.op-lang').value === l, l + ' lang selected');
  ok(node.querySelectorAll('div.op-course').length === 1, l + ' one row');
}
// empty state + school mean (en)
{
  const dom = new JSDOM('<body></body>');
  const empty = V.buildStatsView(dom.window.document,
    { courses: [], gradesByCourse: {}, settings: { courses: {} }, lang: 'en', onLang: () => {}, onPref: () => {}, onReset: () => {} });
  ok(empty.outerHTML.indexOf('/my/') !== -1, 'empty state link');
  const dom2 = new JSDOM('<body></body>');
  const school = V.buildStatsView(dom2.window.document,
    {
      courses: sampleCourses(),
      gradesByCourse: {},
      settings: { courses: { 1005: { included: true, mode: '12' } } },
      lang: 'en', onLang: () => {}, onPref: () => {}, onReset: () => {},
    });
  ok(school.outerHTML.indexOf('12.50 / 12') !== -1, 'school mean');
}
// journal fallback: no /my/ scores -> grades used, no doubling
{
  const noScores = [{
    courseId: '1005', title: 'C', lectures: { done: 0, total: 0 },
    practices: { graded: 0, submitted: 0, todo: 1, total: 1, scores: [] },
  }];
  ok(JSON.stringify(V.scoresFor(noScores[0], { 1005: [{ name: 'P', score: 7 }] })) === '[7]', 'fallback used');
  const withScores = [{
    courseId: '1005', title: 'C', lectures: { done: 0, total: 0 },
    practices: { graded: 1, submitted: 0, todo: 0, total: 1, scores: [{ name: 'P', score: 9, url: '' }] },
  }];
  ok(JSON.stringify(V.scoresFor(withScores[0], { 1005: [{ name: 'P', score: 7 }] })) === '[9]', 'no doubling');
}

console.log('ALL ' + n + ' ASSERTIONS PASSED');
