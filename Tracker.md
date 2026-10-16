# Tracker

Status (2026-10-16): **Built and verified locally. Local commit only: private GitHub repo BLOCKED** (Hark GitHub app gets 403 "Resource not accessible by integration" on repo_create). Not deployed.

## Verification evidence (fresh, 2026-10-16)
- `npm run lint` pass, `npm run typecheck` pass, `npm test` 19/19 pass, `npm run build` pass, `npm audit` 0 vulnerabilities.
- Browser (local production build via `vite preview`, Chromium 155): `../verify/verify_robots.py` 33/33 pass: landing links/anchors, example flow, inspector deciding line (`/searchlight-collection` -> `Disallow: /search`, line 7), keyboard selection + visible focus, Markdown clipboard, CSV (64 rows), row filter, custom token valid/invalid, lint + line jump, tab arrows, invalid/empty paths, no-change, empty proposed, clear, no horizontal scroll at 390/768, 0 console errors, 0 external requests.
- Secrets: none in source, dist or git history (grep).
- Video: `../videos/clydra-robots-change-review.mp4` (75 s, recorded from the local build).
- NOT TESTED: screen readers beyond accessible names/roles; Safari/Firefox (Chromium only).

## Decisions
- Paste, not fetch (CORS). Google interpretation where crawlers differ. Supabase project not created (browser-only, no data).
- REA 6.5.0 used on a HAR of a reference tester (see ../research/REA-NOTES.md).

## Next
1. Owner creates empty private repo `clydra-robots-change-review` and grants the Hark GitHub app access; then push the bundle/commit.
2. Owner review of video; deploy only on explicit approval.
