# Privacy

- All computation happens locally in the browser (`content_scripts` + `popup` + `chrome.storage.local`).
- The extension makes no network requests at all: it only reads pages the user already opened (`/my/`, grade reports). No per-activity fetching, no max lookup.
- No personal data is collected, stored, or transmitted by design:
  - the code does not read user names, emails, avatars, `userId`, `sesskey`, messages, or notifications;
  - storage keys (`optimaMy`, `optimaGrades`, `optimaSettings`) keep only course ids/titles from public curriculum links, activity names/statuses, numeric grades, and user display preferences (checkbox/mode);
  - course titles are curriculum labels, not personal data.
- Permissions are minimal: `storage` only. Content scripts are limited to the two Moodle page patterns in `manifest.json`.
