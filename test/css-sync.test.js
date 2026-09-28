/* The embedded FULL_CSS in content_panel.js must equal src/stats.css,
 * otherwise the tier-3 style fallback drifts. Run: npm test. */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'stats.css'), 'utf8');
const panel = fs.readFileSync(path.join(__dirname, '..', 'src', 'content_panel.js'), 'utf8');
const m = panel.match(/const FULL_CSS = ("(?:[^"\\]|\\.)*");/);
assert.ok(m, 'FULL_CSS constant found');
assert.strictEqual(JSON.parse(m[1]), css, 'FULL_CSS matches stats.css');
assert.ok(css.indexOf('.op-compact') !== -1, 'compact styles present');

console.log('ALL 2 ASSERTIONS PASSED');
