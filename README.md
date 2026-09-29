# Optima Progress (local)

![version](https://img.shields.io/badge/version-0.3.0-blue)
![license](https://img.shields.io/badge/license-MIT-green)
![privacy](https://img.shields.io/badge/data-local%20only-brightgreen)
![platform](https://img.shields.io/badge/platform-Chrome%20MV3-orange)
![ci](https://github.com/Markentyy/optima-progress/actions/workflows/ci.yml/badge.svg)

A local-only browser extension (Chrome MV3, Firefox next) for a Moodle-based learning platform. It counts completed lectures and practical assignments per course and shows grades.

## Features

- Completed/remaining lectures per course, parsed from the `/my/` dashboard.
- Graded/pending/todo practical assignments per course.
- Per-course grades (practices only), with a manually selected scale:
  - School (12-point): arithmetic mean, `sum / n`;
  - College (100-point): running total of earned points plus the 5-point and ECTS equivalent
    (A 90-100 → 5; B 82-89, C 74-81 → 4; D 64-73, E 60-63 → 3; FX 35-59, F 0-34 → 2).
- Checkboxes per course plus summed totals across selected courses. No cross-course average.
- Interface in English, Ukrainian and Russian with an in-UI switcher, in both the popup and the on-page sidebar panel.

## Install

1. Unzip the release archive (use the folder, not the zip).
2. Open `chrome://extensions`, enable Developer mode.
3. Load unpacked → select the folder.
4. Open `https://b.optima-osvita.org/my/`, click the extension icon.

## Privacy

See `PRIVACY.md`. In short: no network requests at all, only pages you already opened are read. No names, emails, user ids or session keys in code or storage.

## Beta: how to report a bug

Copy into the chat and fill in:
- Chrome version:
- Course:
- Expected:
- Shown:
- Screenshots of the popup and the `/my/` page (feel free to blur personal details).

## Development

- `npm ci && npm test` runs the parser/calculator regression suite.
- Load `src/` unpacked via `chrome://extensions` for manual testing.
- See `CONTRIBUTING.md` before opening a pull request.

## License

MIT. See `LICENSE`.
