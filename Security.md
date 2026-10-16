# Security

- Trust boundary: everything runs in the user's browser; there is no server or API.
- Secrets: none required; `.env.example` is empty by design. Verified no secrets in source, bundle or git history (grep in Tracker).
- CSP (production): `default-src 'self'; img-src 'self' data:; style-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'; connect-src 'none'`. Pasted content cannot be sent anywhere by the app.
- XSS: all user-derived text is HTML-escaped (`esc()`) before insertion; no `eval`.
- Abuse/DoS: input capped (500 KiB per file, 1,000 paths, 300 rendered rows); regex built from escaped patterns only (no catastrophic backtracking constructs beyond `.*`).
- Privacy: no storage, cookies or telemetry. External documentation links open only on user click.
- Dependencies: dev-only (vite, vitest, typescript, eslint). `npm audit` result recorded in Tracker.
- Incidents: none.
