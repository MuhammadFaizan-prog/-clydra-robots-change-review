# PRD: Clydara Robots Change Review

## User and job
SEO leads, developers and site owners who review a robots.txt change (often in a pull request) and need to know, before it ships, which URLs each search or AI crawler gains or loses access to.

## Problem and evidence (researched 2026-10-16)
- Google retired the Search Console robots.txt Tester on 12 Dec 2023; its replacement report cannot test a URL or an unpublished draft ([Search Engine Land](https://searchengineland.com/google-search-console-adds-robots-txt-report-434708), [Google robots.txt report help](https://support.google.com/webmasters/answer/6062598), [Search Central community thread](https://support.google.com/webmasters/thread/258846307)).
- Practitioners built bulk checkers because single-URL testing is too slow ([note.com write-up](https://note.com/yukiseo/n/n14f1b2708cb7?hl=en)).
- Sites now add and remove AI-crawler groups often; OpenAI and Perplexity publish separate tokens for training, search and user-triggered fetches ([OpenAI crawlers](https://platform.openai.com/docs/bots), [Perplexity crawlers](https://docs.perplexity.ai/guides/bots)), so one edit can affect crawlers differently.
- Matching is subtle (longest match wins, Allow wins ties, a named group replaces `*`, prefix matching) per [RFC 9309](https://www.rfc-editor.org/rfc/rfc9309.html).

## Alternatives
| Tool | Does well | Gap for this job |
|---|---|---|
| Google Search Console robots.txt report / URL Inspection | Google's own view of the live file | One URL at a time, Googlebot only, no drafts |
| technicalseo.com robots.txt validator | Live fetch or editor mode, per-agent test | One file, one URL and agent per test; no before/after |
| SmartDev / Rank.ai / Nitro Sites testers | RFC 9309 matching, AI crawler lists, some matrices | Test one file; no comparison of two versions. REA capture of SmartDev showed analytics (GTM, GA, Datadog RUM, Cloudflare Insights) loading on the page |
| Google's open-source robotstxt library | Reference parser | Developer setup; single file |

## Original value
A **before/after diff of crawler access**: two files x a path list x chosen crawlers, with every changed cell, the deciding line in each file, a PR-ready Markdown summary and CSV. Fully local, zero third-party requests.

## Scope
In: paste current + proposed, path/URL list (max 1,000), 19 built-in crawler tokens + custom tokens, lint, matrix, inspector, Markdown + CSV export, landing page, mobile.
Out (non-goals): fetching live robots.txt (CORS), crawling sitemaps, accounts, storage, server, AI.

## Stories and acceptance criteria
1. As a reviewer I paste two files and paths and see newly blocked / newly allowed / rule-changed counts. AC: counts equal the matrix cells; verified by unit test (7 newly blocked case) and browser check.
2. I select a cell and see the group and deciding line in both files. AC: `/searchlight-collection` for Googlebot shows `Disallow: /search` line 7.
3. I export a PR summary. AC: clipboard Markdown begins `## robots.txt change review`; CSV has one row per path x crawler.
4. I'm told about mistakes. AC: misspelled fields, rules before user-agent, missing leading slash, relative sitemap, noindex, crawl-delay, HTML served as robots.txt are flagged with line links.
5. Invalid input is explained. AC: bad path lines listed, `aria-invalid` set; empty proposed and no-path states shown.
6. Works on mobile. AC: no page-level horizontal scroll at 390/768/1440.

## Success measures (post-release, only if deployed)
Successful reviews (matrix rendered), exports, repeat use, outbound clicks to clydralab.com. None measured yet; nothing is deployed.
