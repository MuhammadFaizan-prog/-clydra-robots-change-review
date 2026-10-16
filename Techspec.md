# Techspec

- Stack: TypeScript 6, Vite 8 multi-page build (`index.html` landing, `tool.html` workspace), no runtime dependencies. Vitest 5, ESLint 10 + typescript-eslint.
- Architecture: pure functions in `src/lib` (parser/matcher `robots.ts`, crawler catalog `crawlers.ts`, comparison/exports `compare.ts`, sample data `sample.ts`); DOM rendering in `src/ui/matrix.ts`, `src/landing.ts`, `src/tool.ts`.
- Matching: RFC 9309 + Google's documented behaviour. Groups merged per token; crawler token chain (e.g. Googlebot-Image -> Googlebot -> `*`); longest pattern (UTF-8 bytes) wins, Allow wins ties; `*` wildcard, trailing `$` anchor; percent-encoding normalised; `/robots.txt` always allowed; content past 500 KiB ignored.
- Data flow: textarea input -> debounce 160 ms -> parse both files -> parse URL list -> `review()` -> render matrix (max 300 rows shown, all rows in CSV) -> inspector on selection.
- Integrations: none. No network requests; production CSP `connect-src 'none'`.
- Supabase: dedicated project `clydra_robots_change_review` NOT created and not used. The tool is browser-only and stores no user data, so creating a database would add cost and risk without function.
- Deployment: static `dist/` (any static host). Not deployed; Vercel only after owner approval.
- Tradeoffs: paste instead of fetch (browsers cannot read other origins' robots.txt); textarea instead of a code editor (zero dependencies); Google's interpretation chosen where crawlers differ (documented in UI).
- Cost: $0 runtime beyond static hosting.
