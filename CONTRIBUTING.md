# Contributing

## Ground rules

- Privacy first: no network requests, no analytics, no personal data. Never commit
  screenshots, HTML dumps or storage exports containing names, emails, user ids
  or session keys.
- Keep it local-only: the extension reads pages the user already opened and
  computes everything in the browser.

## Workflow

1. Fork and create a feature branch.
2. `npm ci && npm test` must pass.
3. Match the existing code style (plain scripts, no bundler).
4. Update `CHANGELOG.md` and docs if behavior changes.
5. Open a pull request using the template.
