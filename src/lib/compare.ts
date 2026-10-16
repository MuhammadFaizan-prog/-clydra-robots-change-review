import { evaluate, type Crawler, type ParsedRobots, type ParsedUrl, type Verdict } from "./robots";

export type Change = "newly-blocked" | "newly-allowed" | "rule-changed" | "same";

export interface Cell {
  url: ParsedUrl;
  crawler: Crawler;
  before: Verdict;
  after: Verdict;
  change: Change;
}

export interface Review {
  cells: Cell[];
  urls: ParsedUrl[];
  crawlers: Crawler[];
  counts: Record<Change, number>;
  perCrawler: Record<string, Record<Change, number>>;
}

function ruleKey(v: Verdict): string {
  return v.rule ? `${v.rule.kind}:${v.rule.pattern}` : `none:${v.reason}`;
}

export function classify(before: Verdict, after: Verdict): Change {
  if (before.allowed && !after.allowed) return "newly-blocked";
  if (!before.allowed && after.allowed) return "newly-allowed";
  if (ruleKey(before) !== ruleKey(after)) return "rule-changed";
  return "same";
}

const zero = (): Record<Change, number> => ({ "newly-blocked": 0, "newly-allowed": 0, "rule-changed": 0, same: 0 });

export function review(current: ParsedRobots, proposed: ParsedRobots, urls: ParsedUrl[], crawlers: Crawler[]): Review {
  const cells: Cell[] = [];
  const counts = zero();
  const perCrawler: Record<string, Record<Change, number>> = {};
  for (const c of crawlers) perCrawler[c.id] = zero();
  for (const url of urls) {
    for (const crawler of crawlers) {
      const before = evaluate(current, crawler, url.path);
      const after = evaluate(proposed, crawler, url.path);
      const change = classify(before, after);
      counts[change]++;
      const pc = perCrawler[crawler.id];
      if (pc) pc[change]++;
      cells.push({ url, crawler, before, after, change });
    }
  }
  return { cells, urls, crawlers, counts, perCrawler };
}

export function describeVerdict(v: Verdict): string {
  switch (v.reason) {
    case "no-file":
      return "Allowed: no robots.txt";
    case "robots-path":
      return "Allowed: /robots.txt is always fetchable";
    case "no-group":
      return "Allowed: no group applies";
    case "no-matching-rule":
      return `Allowed: no rule in the ${v.groupToken === "*" ? "*" : v.groupToken} group matches`;
    case "rule":
      return `${v.allowed ? "Allowed" : "Blocked"} by line ${v.rule?.line}: ${v.rule?.kind === "allow" ? "Allow" : "Disallow"}: ${v.rule?.pattern}`;
  }
}

function csvEscape(s: string): string {
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(r: Review): string {
  const head = ["path", "crawler", "operator", "before", "before_line", "before_rule", "after", "after_line", "after_rule", "change"];
  const rows = r.cells.map((c) => [
    c.url.path,
    c.crawler.name,
    c.crawler.operator,
    c.before.allowed ? "allowed" : "blocked",
    c.before.rule ? String(c.before.rule.line) : "",
    c.before.rule ? `${c.before.rule.kind}: ${c.before.rule.pattern}` : c.before.reason,
    c.after.allowed ? "allowed" : "blocked",
    c.after.rule ? String(c.after.rule.line) : "",
    c.after.rule ? `${c.after.rule.kind}: ${c.after.rule.pattern}` : c.after.reason,
    c.change,
  ]);
  return [head, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n") + "\n";
}

function md(s: string): string {
  return s.replace(/\|/g, "\\|");
}

/** A change summary suitable for pasting into a pull request description. */
export function toMarkdown(r: Review): string {
  const changed = r.cells.filter((c) => c.change !== "same");
  const lines: string[] = [];
  lines.push("## robots.txt change review");
  lines.push("");
  lines.push(`Checked ${r.urls.length} path${r.urls.length === 1 ? "" : "s"} against ${r.crawlers.length} crawler${r.crawlers.length === 1 ? "" : "s"} (${r.cells.length} combinations).`);
  lines.push("");
  lines.push(`- Newly blocked: ${r.counts["newly-blocked"]}`);
  lines.push(`- Newly allowed: ${r.counts["newly-allowed"]}`);
  lines.push(`- Same verdict, different deciding rule: ${r.counts["rule-changed"]}`);
  lines.push(`- Unchanged: ${r.counts.same}`);
  lines.push("");
  if (changed.length === 0) {
    lines.push("No verdict or deciding rule changes for the checked paths.");
  } else {
    lines.push("| Path | Crawler | Change | Before | After |");
    lines.push("|---|---|---|---|---|");
    for (const c of changed) {
      lines.push(`| \`${md(c.url.path)}\` | ${c.crawler.name} | ${c.change.replace("-", " ")} | ${md(describeVerdict(c.before))} | ${md(describeVerdict(c.after))} |`);
    }
  }
  lines.push("");
  lines.push("Matching follows RFC 9309 (longest rule wins, Allow wins ties). A path list only covers the paths it names.");
  return lines.join("\n") + "\n";
}
