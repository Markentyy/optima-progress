# Changelog

## [0.3.0] - 2026-09-28
### Added
- In-page sidebar panel with the same full stats as the popup.
- Interface in English, Ukrainian and Russian with an in-UI switcher.
- Shared stats view for popup and panel, dictionary parity tests.
- Bulletproof panel styling (constructed stylesheet, linked resource, embedded copy).
- Compact layout for the narrow sidebar, full course names on hover.## [0.2.1] - 2026-09-27
### Fixed
- Duplicate cards of one course no longer double the totals (merged by courseId).
- Grade report backs up scores when `/my/` has none (no double counting).
- Single popup render instead of two, guards against corrupt records.
- Bare `/my` match, aria labels, roughly half the storage footprint.

## [0.2.0] - 2026-09-27
### Changed
- Grading mode is manual only: school 12 or college 100.
- College courses: score total plus 5-point grade and ECTS.
- School courses: mean `sum / n`.
- Removed background max fetching, the worker and extra permissions.

## [0.1.0] - 2026-09-27
### Added
- Lecture and practice counters from the `/my/` page.
- Practice grades, per-course checkboxes, totals across selected courses.
- Local storage, no outbound network requests.
