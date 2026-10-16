# Schema

**This tool stores no user data.** No database, no localStorage/sessionStorage, no cookies, no server.

In-memory types (`src/lib`): `ParsedRobots {groups, sitemaps, issues, bytes, truncated}`, `Group {agents, rules}`, `Rule {kind, pattern, line, raw}`, `Crawler {id, name, operator, purpose, chain, note, docs}`, `Verdict {allowed, reason, rule, groupToken}`, `Review {cells, counts, perCrawler}`.
Validation: robots.txt truncated at 500 KiB; URL list max 1,000 unique paths, must start with `/` or `http(s)://`; custom tokens `[A-Za-z_-]+`.
Retention/deletion: data lives only in the open tab; closing it or "Clear all" deletes it. Exports are files/clipboard the user controls.
Supabase: `clydra_robots_change_review` not created (no data to store). No migrations.
