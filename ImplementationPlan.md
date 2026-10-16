# Implementation plan

1. Parser + matcher + crawler catalog with RFC 9309 tests (done).
2. Comparison, Markdown/CSV export (done).
3. Landing page with live sample preview (done).
4. Workspace UI, states, keyboard, mobile (done).
5. Production CSP, build, browser verification script `verify/verify_robots.py` (done, 33/33).
6. Review video (done) -> owner review gate.
7. Deployment gate: only after explicit owner approval of this tool: new Vercel project, static build, verify live (section 15).
Recovery: git history in the private repo plus `../clydra-robots-change-review.bundle` in the tool-studio date folder.
