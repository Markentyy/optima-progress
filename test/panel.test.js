/* Interaction guard + event shield tests (language select survival). */
global.window = {};
global.chrome = {
  storage: { local: { get: (k, cb) => cb({}), set: (o, cb) => cb && cb() } },
  runtime: { getURL: (p) => 'chrome-extension://x/' + p },
};
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// boot() exits early without the other modules: only helpers are tested.
eval(fs.readFileSync(path.join(__dirname, '..', 'src', 'content_panel.js'), 'utf8'));
const Panel = global.window.OptimaPanel;
const assert = require('assert');
let n = 0;
const ok = (cond, msg) => { n++; assert.ok(cond, msg); };
ok(Panel && Panel.HOST_ID === 'optima-progress-block', 'internals exposed');

// ---------- guard: free render runs at once ----------
{
  let calls = 0;
  const g = Panel.createInteractionGuard(() => { calls += 1; });
  ok(g.request() === true && calls === 1, 'free render immediate');
  g.cancel();
}

// ---------- guard: interaction defers, release resumes ----------
{
  let calls = 0;
  const g = Panel.createInteractionGuard(() => { calls += 1; });
  g.poke(60000);
  ok(g.request() === false && calls === 0, 'busy defers');
  g.release();
  ok(g.request() === true && calls === 1, 'release resumes');
  g.cancel();
}

// ---------- guard: custom isBusy gate ----------
{
  let calls = 0;
  let busy = true;
  const g = Panel.createInteractionGuard(() => { calls += 1; }, { isBusy: () => busy });
  ok(g.request() === false && calls === 0, 'isBusy defers');
  busy = false;
  ok(g.request() === true && calls === 1, 'idle runs');
  g.cancel();
}

// ---------- shield: page handlers silenced, own handlers kept ----------
{
  const dom = new JSDOM('<body><section id="h"><span id="c"></span></section></body>');
  const doc = dom.window.document;
  const host = doc.getElementById('h');
  const child = doc.getElementById('c');
  let docClicks = 0;
  let ownClicks = 0;
  doc.addEventListener('click', () => { docClicks += 1; });
  child.addEventListener('click', () => { ownClicks += 1; });
  const click = () => child.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  click();
  ok(docClicks === 1 && ownClicks === 1, 'baseline bubbles');
  Panel.shieldHost(host);
  click();
  ok(ownClicks === 2, 'own handlers still fire');
  ok(docClicks === 1, 'page handlers silenced');
}

// ---------- panelHasFocus: open select counts as busy ----------
{
  const dom = new JSDOM('<body></body>');
  const doc = dom.window.document;
  const host = doc.createElement('section');
  host.id = Panel.HOST_ID;
  doc.body.appendChild(host);
  ok(Panel.panelHasFocus(doc) === false, 'no shadow yet');
  const shadow = host.attachShadow({ mode: 'open' });
  const sel = doc.createElement('select');
  shadow.appendChild(sel);
  ok(Panel.panelHasFocus(doc) === false, 'not focused yet');
  sel.focus();
  ok(Panel.panelHasFocus(doc) === true, 'focused select is busy');
  sel.blur();
  ok(Panel.panelHasFocus(doc) === false, 'blurred is free');
}

// ---------- sidebar mode: shadow lives on the inner card-body div ----------
{
  const dom = new JSDOM('<body></body>');
  const doc = dom.window.document;
  const section = doc.createElement('section');
  section.id = Panel.HOST_ID;
  const inner = doc.createElement('div');
  inner.setAttribute('data-op-body', '1');
  section.appendChild(inner);
  doc.body.appendChild(section);
  ok(Panel.panelShadowRoot(doc) === null, 'no shadow yet');
  ok(Panel.panelHasFocus(doc) === false, 'no shadow means free');
  const shadow = inner.attachShadow({ mode: 'open' });
  ok(Panel.panelShadowRoot(doc) === shadow, 'inner shadow found');
  const sel = doc.createElement('select');
  shadow.appendChild(sel);
  sel.focus();
  ok(Panel.panelHasFocus(doc) === true, 'block-mode focused select is busy');
  sel.blur();
  ok(Panel.panelHasFocus(doc) === false, 'block-mode blurred is free');
}

console.log('ALL ' + n + ' ASSERTIONS PASSED');
