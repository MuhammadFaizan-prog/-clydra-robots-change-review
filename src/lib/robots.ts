// robots.txt parser and matcher following RFC 9309 (Robots Exclusion Protocol)
// and Google's documented interpretation:
// - groups start with one or more user-agent lines; groups naming the same token are merged
// - a crawler obeys the group for its most specific product token, otherwise "*"
// - the longest matching rule wins; on equal length the allow rule wins
// - "*" matches any sequence, a trailing "$" anchors the end of the path
// - /robots.txt itself is always allowed
// - content past 500 KiB is ignored (Google's documented limit)

export const MAX_BYTES = 500 * 1024;

export type RuleKind = "allow" | "disallow";

export interface Rule {
  kind: RuleKind;
  pattern: string;
  line: number;
  raw: string;
}

export interface AgentLine {
  token: string; // normalised product token ("*" or lowercase token)
  value: string; // as written
  line: number;
}

export interface Group {
  agents: AgentLine[];
  rules: Rule[];
}

export type Severity = "error" | "warning" | "info";

export interface Issue {
  severity: Severity;
  line: number | null;
  code: string;
  message: string;
}

export interface ParsedRobots {
  empty: boolean;
  groups: Group[];
  sitemaps: { url: string; line: number }[];
  issues: Issue[];
  bytes: number;
  truncated: boolean;
}

const KNOWN = ["user-agent", "allow", "disallow", "sitemap", "crawl-delay", "host", "noindex", "clean-param", "request-rate", "visit-time"];

function levenshtein(a: string, b: string): number {
  const dp: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0] ?? 0;
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j] ?? 0;
      dp[j] = Math.min((dp[j] ?? 0) + 1, (dp[j - 1] ?? 0) + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length] ?? 0;
}

/** Normalise a user-agent value to its product token. "Googlebot/2.1" -> "googlebot". */
export function productToken(value: string): string {
  const v = value.trim();
  if (v === "*") return "*";
  const m = /^[A-Za-z_-]+/.exec(v);
  return m ? m[0].toLowerCase() : "";
}

export function utf8Bytes(text: string): number {
  return new TextEncoder().encode(text).length;
}

export function parseRobots(input: string): ParsedRobots {
  const issues: Issue[] = [];
  let text = input;
  const bytes = utf8Bytes(text);
  let truncated = false;
  if (bytes > MAX_BYTES) {
    const enc = new TextEncoder().encode(text).slice(0, MAX_BYTES);
    text = new TextDecoder().decode(enc);
    truncated = true;
    issues.push({ severity: "warning", line: null, code: "too-large", message: `File is ${Math.round(bytes / 1024)} KiB. Google ignores everything after 500 KiB, so rules past that point are not evaluated here either.` });
  }
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const groups: Group[] = [];
  const sitemaps: { url: string; line: number }[] = [];
  let current: Group | null = null;
  let lastWasAgent = false;
  let sawHtml = false;
  const lines = text.split(/\r\n|\r|\n/);

  lines.forEach((rawLine, idx) => {
    const lineNo = idx + 1;
    const noComment = rawLine.replace(/#.*$/, "").trim();
    if (!noComment) return;
    if (!sawHtml && /^<(!doctype|html|head|body|meta|div|script)/i.test(noComment)) {
      sawHtml = true;
      issues.push({ severity: "error", line: lineNo, code: "html", message: "This looks like an HTML page, not a robots.txt file. A server that returns HTML here usually means the file is missing." });
    }
    const colon = noComment.indexOf(":");
    if (colon < 0) {
      issues.push({ severity: "warning", line: lineNo, code: "no-colon", message: `Line has no "field: value" separator and is ignored.` });
      return;
    }
    const field = noComment.slice(0, colon).trim().toLowerCase();
    const value = noComment.slice(colon + 1).trim();

    if (field === "user-agent") {
      const token = productToken(value);
      if (!token) {
        issues.push({ severity: "warning", line: lineNo, code: "bad-agent", message: `User-agent "${value}" has no usable product token and is ignored.` });
        return;
      }
      if (token !== "*" && token !== value.toLowerCase()) {
        issues.push({ severity: "info", line: lineNo, code: "agent-version", message: `"${value}" is matched as the product token "${token}". Version numbers and extra text are ignored.` });
      }
      if (!lastWasAgent || !current) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push({ token, value, line: lineNo });
      lastWasAgent = true;
      return;
    }

    if (field === "allow" || field === "disallow") {
      lastWasAgent = false;
      if (!current) {
        issues.push({ severity: "error", line: lineNo, code: "orphan-rule", message: `${field === "allow" ? "Allow" : "Disallow"} appears before any User-agent line, so no crawler applies it.` });
        return;
      }
      if (value === "") {
        if (field === "disallow") {
          issues.push({ severity: "info", line: lineNo, code: "empty-disallow", message: "Empty Disallow blocks nothing (it allows everything for this group)." });
        }
        return;
      }
      if (!value.startsWith("/") && !value.startsWith("*")) {
        issues.push({ severity: "warning", line: lineNo, code: "no-slash", message: `Path "${value}" does not start with "/". Crawlers compare against paths that begin with "/", so this rule may never match. Did you mean "/${value}"?` });
      }
      current.rules.push({ kind: field, pattern: value, line: lineNo, raw: noComment });
      return;
    }

    if (field === "sitemap") {
      if (!/^https?:\/\//i.test(value)) {
        issues.push({ severity: "warning", line: lineNo, code: "sitemap-relative", message: "Sitemap must be a full URL (https://...). Relative sitemap paths are ignored." });
      }
      sitemaps.push({ url: value, line: lineNo });
      return; // sitemap lines do not end a group
    }

    lastWasAgent = false;
    if (field === "crawl-delay") {
      issues.push({ severity: "info", line: lineNo, code: "crawl-delay", message: "Crawl-delay is ignored by Googlebot. Some crawlers (for example Bingbot) honour it." });
      return;
    }
    if (field === "noindex") {
      issues.push({ severity: "warning", line: lineNo, code: "noindex", message: "Noindex in robots.txt is not supported by Google (since 2019). Use a meta robots tag or X-Robots-Tag header." });
      return;
    }
    if (KNOWN.includes(field)) return;
    const suggestion = ["user-agent", "allow", "disallow", "sitemap"].find((k) => levenshtein(field, k) <= 2);
    issues.push({
      severity: "warning",
      line: lineNo,
      code: "unknown-field",
      message: suggestion
        ? `Unknown field "${field}". Did you mean "${suggestion}"? This tool ignores it, like RFC 9309 parsers do; some crawlers accept a few misspellings, so fix it rather than rely on either behaviour.`
        : `Unknown field "${field}" is ignored.`,
    });
  });

  for (const g of groups) {
    const star = g.agents.some((a) => a.token === "*");
    if (g.rules.length === 0) {
      const first = g.agents[0];
      issues.push({ severity: "info", line: first?.line ?? null, code: "empty-group", message: `Group for ${g.agents.map((a) => a.value).join(", ")} has no rules, so it allows everything for those crawlers.` });
    }
    const blockAll = g.rules.find((r) => r.kind === "disallow" && r.pattern === "/");
    if (star && blockAll) {
      issues.push({ severity: "warning", line: blockAll.line, code: "block-all", message: `"Disallow: /" in the * group blocks every crawler that has no group of its own.` });
    }
  }

  return { empty: input.trim() === "", groups, sitemaps, issues, bytes, truncated };
}

/** Percent-encode non-ASCII and normalise existing escapes to upper case so pattern and path compare equally. */
export function normaliseEncoding(s: string): string {
  let out = "";
  for (const ch of s) {
    const code = ch.codePointAt(0) ?? 0;
    if (code > 0x7e || code < 0x21) {
      for (const b of new TextEncoder().encode(ch)) out += "%" + b.toString(16).toUpperCase().padStart(2, "0");
    } else out += ch;
  }
  return out.replace(/%[0-9a-f]{2}/gi, (m) => m.toUpperCase());
}

const regexCache = new Map<string, RegExp>();

export function patternToRegExp(pattern: string): RegExp {
  const cached = regexCache.get(pattern);
  if (cached) return cached;
  let p = normaliseEncoding(pattern);
  let anchored = false;
  if (p.endsWith("$")) {
    anchored = true;
    p = p.slice(0, -1);
  }
  const body = p
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  const re = new RegExp("^" + body + (anchored ? "$" : ""));
  regexCache.set(pattern, re);
  return re;
}

export function ruleMatches(rule: Rule, path: string): boolean {
  return patternToRegExp(rule.pattern).test(normaliseEncoding(path));
}

export interface Crawler {
  id: string;
  name: string;
  operator: string;
  purpose: "search" | "ai-training" | "ai-search" | "ai-user" | "other" | "custom";
  chain: string[]; // product tokens from most to least specific; "*" last
  note?: string;
  docs?: string;
}

export type VerdictReason = "rule" | "no-matching-rule" | "no-group" | "no-file" | "robots-path";

export interface Verdict {
  allowed: boolean;
  reason: VerdictReason;
  rule: Rule | null;
  groupToken: string | null; // the token whose group was applied
}

export function selectRules(parsed: ParsedRobots, crawler: Crawler): { token: string | null; rules: Rule[] } {
  for (const token of crawler.chain) {
    const matching = parsed.groups.filter((g) => g.agents.some((a) => a.token === token));
    if (matching.length) return { token, rules: matching.flatMap((g) => g.rules) };
  }
  return { token: null, rules: [] };
}

function patternLength(p: string): number {
  return utf8Bytes(p);
}

export function evaluate(parsed: ParsedRobots, crawler: Crawler, path: string): Verdict {
  if (parsed.empty) return { allowed: true, reason: "no-file", rule: null, groupToken: null };
  if (path === "/robots.txt" || path.startsWith("/robots.txt?")) return { allowed: true, reason: "robots-path", rule: null, groupToken: null };
  const { token, rules } = selectRules(parsed, crawler);
  if (token === null) return { allowed: true, reason: "no-group", rule: null, groupToken: null };
  let best: Rule | null = null;
  for (const r of rules) {
    if (!ruleMatches(r, path)) continue;
    if (!best) {
      best = r;
      continue;
    }
    const lr = patternLength(r.pattern);
    const lb = patternLength(best.pattern);
    if (lr > lb || (lr === lb && r.kind === "allow" && best.kind === "disallow")) best = r;
  }
  if (!best) return { allowed: true, reason: "no-matching-rule", rule: null, groupToken: token };
  return { allowed: best.kind === "allow", reason: "rule", rule: best, groupToken: token };
}

export interface ParsedUrl {
  input: string;
  path: string;
  line: number;
}

export interface UrlParseResult {
  urls: ParsedUrl[];
  invalid: { input: string; line: number; message: string }[];
  duplicates: number;
  truncated: boolean;
}

export const MAX_URLS = 1000;

export function parseUrlList(text: string): UrlParseResult {
  const urls: ParsedUrl[] = [];
  const invalid: { input: string; line: number; message: string }[] = [];
  const seen = new Set<string>();
  let duplicates = 0;
  let truncated = false;
  text.split(/\r\n|\r|\n/).forEach((raw, i) => {
    const s = raw.trim();
    if (!s || s.startsWith("#")) return;
    let path: string;
    if (/^https?:\/\//i.test(s)) {
      try {
        const u = new URL(s);
        path = (u.pathname || "/") + u.search;
      } catch {
        invalid.push({ input: s, line: i + 1, message: "Not a valid URL." });
        return;
      }
    } else if (s.startsWith("/")) {
      if (/\s/.test(s)) {
        invalid.push({ input: s, line: i + 1, message: "Paths cannot contain spaces. Encode them as %20." });
        return;
      }
      path = s.replace(/#.*$/, "");
    } else {
      invalid.push({ input: s, line: i + 1, message: 'Start with "/" (a path) or "https://" (a full URL).' });
      return;
    }
    if (seen.has(path)) {
      duplicates++;
      return;
    }
    if (urls.length >= MAX_URLS) {
      truncated = true;
      return;
    }
    seen.add(path);
    urls.push({ input: s, path, line: i + 1 });
  });
  return { urls, invalid, duplicates, truncated };
}
