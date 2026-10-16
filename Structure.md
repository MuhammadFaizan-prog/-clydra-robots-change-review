# Structure

```
index.html              Landing page (product introduction, live sample preview)
tool.html               Workspace page
public/clydara-logo.png Approved Clydara mark (Built by Clydara link)
src/landing.ts          Renders the landing sample with the real matcher
src/tool.ts             Workspace state, inputs, states, exports
src/lib/robots.ts       RFC 9309 parser, linter, matcher, URL list parser
src/lib/crawlers.ts     Crawler catalog (tokens, purpose, docs links), custom tokens
src/lib/compare.ts      Before/after review, CSV and Markdown export
src/lib/sample.ts       Fictional shop sample (current, proposed, paths)
src/ui/matrix.ts        Matrix renderer + HTML escaping
src/styles/*.css        base (tokens, nav, footer), matrix, landing, tool
tests/robots.test.ts    Matcher, lint, URL list and review/export tests
vite.config.ts          Multi-page build + production CSP meta + vitest config
eslint.config.js, tsconfig.json, package.json, package-lock.json
PRD, Techspec, Appflow, Schema, ImplementationPlan, Tracker, Rules, Security, Structure, design-research, README, LICENSE, .env.example
```
