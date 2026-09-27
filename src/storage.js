/* Settings + cache helpers. Keys hold only course prefs and grade numbers. */
const DEFAULT_SETTINGS = { courses: {} };

function getStore(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}

function setStore(obj) {
  return new Promise((resolve) => chrome.storage.local.set(obj, resolve));
}

async function getCoursePref(courseId) {
  const data = await getStore('optimaSettings');
  const s = (data && data.optimaSettings) || DEFAULT_SETTINGS;
  const p = (s.courses && s.courses[courseId]) || { included: true, mode: '12' };
  return normalizePref(p);
}

function normalizePref(p) {
  const mode = p && (p.mode === '100' || p.mode === '12') ? p.mode : '12';
  return { included: !p || p.included !== false, mode };
}

async function setCoursePref(courseId, pref) {
  const data = await getStore('optimaSettings');
  const s = (data && data.optimaSettings) || { courses: {} };
  s.courses = s.courses || {};
  s.courses[courseId] = normalizePref(pref);
  await setStore({ optimaSettings: s });
}
