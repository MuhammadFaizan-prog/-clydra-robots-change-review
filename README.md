# Clydara Robots Change Review

Compare the robots.txt that is live today with a proposed edit, across the paths you care about and the main search and AI crawlers. See every path that becomes blocked or allowed, the line that decides it in each file, and export a Markdown summary for the pull request or a CSV of the full matrix.

- Landing page: `/` · Workspace: `/tool.html` (`/tool.html#example` loads a sample)
- Runs entirely in the browser; the production build's CSP forbids network requests.
- Matching follows RFC 9309 and Google's documented interpretation.

## Develop
```bash
npm install
npm run dev        # http://localhost:5173
npm test           # vitest unit tests
npm run lint && npm run typecheck
npm run build && npm run preview
```

## Limits
robots.txt is a request, not enforcement; only listed paths are checked; some crawlers parse differently; firewall/CDN bot rules are not visible. Crawler tokens were checked against operators' docs on 2026-10-16.

Built by [Clydara](https://www.clydralab.com/). Private source; see LICENSE.
