import { describe, expect, it } from "vitest";
import { evaluate, parseRobots, parseUrlList, productToken, type Crawler } from "../src/lib/robots";
import { CRAWLERS, customCrawler } from "../src/lib/crawlers";
import { review, toCsv, toMarkdown } from "../src/lib/compare";

const bot = (id: string): Crawler => {
  const c = CRAWLERS.find((x) => x.id === id);
  if (!c) throw new Error("missing crawler " + id);
  return c;
};

describe("RFC 9309 matching (examples from RFC 9309 section 5 and Google's docs)", () => {
  it("longest match wins", () => {
    const p = parseRobots("User-agent: *\nDisallow: /fish\nAllow: /fish/salmon");
    expect(evaluate(p, bot("googlebot"), "/fish/salmon.html").allowed).toBe(true);
    expect(evaluate(p, bot("googlebot"), "/fish/tuna").allowed).toBe(false);
    expect(evaluate(p, bot("googlebot"), "/fish").allowed).toBe(false);
    expect(evaluate(p, bot("googlebot"), "/Fish").allowed).toBe(true); // paths are case-sensitive
  });

  it("allow wins an equal-length tie", () => {
    const p = parseRobots("User-agent: *\nDisallow: /page\nAllow: /page");
    const v = evaluate(p, bot("googlebot"), "/page");
    expect(v.allowed).toBe(true);
    expect(v.rule?.kind).toBe("allow");
  });

  it("supports * wildcards and $ end anchors", () => {
    const p = parseRobots("User-agent: *\nDisallow: /*.php$\nDisallow: /private*/\nAllow: /$");
    expect(evaluate(p, bot("googlebot"), "/index.php").allowed).toBe(false);
    expect(evaluate(p, bot("googlebot"), "/index.php?x=1").allowed).toBe(true);
    expect(evaluate(p, bot("googlebot"), "/private-area/x").allowed).toBe(false);
    expect(evaluate(p, bot("googlebot"), "/").allowed).toBe(true);
  });

  it("Google's documented example: allow /$ vs disallow / ", () => {
    const p = parseRobots("User-agent: *\nAllow: /$\nDisallow: /");
    expect(evaluate(p, bot("googlebot"), "/").allowed).toBe(true);
    expect(evaluate(p, bot("googlebot"), "/page.htm").allowed).toBe(false);
  });

  it("a specific group replaces the * group entirely", () => {
    const p = parseRobots("User-agent: *\nDisallow: /\n\nUser-agent: GPTBot\nDisallow: /members/");
    expect(evaluate(p, bot("gptbot"), "/blog/post").allowed).toBe(true);
    expect(evaluate(p, bot("gptbot"), "/members/a").allowed).toBe(false);
    expect(evaluate(p, bot("claudebot"), "/blog/post").allowed).toBe(false);
  });

  it("merges groups that name the same agent and shares rules across stacked user-agent lines", () => {
    const p = parseRobots("User-agent: ClaudeBot\nUser-agent: GPTBot\nDisallow: /a\n\nUser-agent: gptbot\nDisallow: /b");
    expect(evaluate(p, bot("gptbot"), "/a").allowed).toBe(false);
    expect(evaluate(p, bot("gptbot"), "/b").allowed).toBe(false);
    expect(evaluate(p, bot("claudebot"), "/a").allowed).toBe(false);
    expect(evaluate(p, bot("claudebot"), "/b").allowed).toBe(true);
  });

  it("Googlebot-Image falls back to the Googlebot group before *", () => {
    const p = parseRobots("User-agent: *\nDisallow: /\nUser-agent: Googlebot\nDisallow: /tmp/");
    const v = evaluate(p, bot("googlebot-image"), "/images/a.png");
    expect(v.allowed).toBe(true);
    expect(v.groupToken).toBe("googlebot");
  });

  it("user-agent matching is case-insensitive and ignores versions", () => {
    expect(productToken("GPTBot/1.4")).toBe("gptbot");
    const p = parseRobots("user-agent: GPTBOT/1.1\ndisallow: /");
    expect(evaluate(p, bot("gptbot"), "/x").allowed).toBe(false);
  });

  it("empty disallow allows everything; no group means allowed", () => {
    const p = parseRobots("User-agent: *\nDisallow:");
    expect(evaluate(p, bot("gptbot"), "/x").allowed).toBe(true);
    const q = parseRobots("User-agent: Bingbot\nDisallow: /");
    const v = evaluate(q, bot("gptbot"), "/x");
    expect(v.allowed).toBe(true);
    expect(v.reason).toBe("no-group");
  });

  it("/robots.txt is always allowed and an empty file allows everything", () => {
    const p = parseRobots("User-agent: *\nDisallow: /");
    expect(evaluate(p, bot("googlebot"), "/robots.txt").allowed).toBe(true);
    expect(evaluate(parseRobots("   \n"), bot("googlebot"), "/x").reason).toBe("no-file");
  });

  it("matches percent-encoded and UTF-8 paths equivalently", () => {
    const p = parseRobots("User-agent: *\nDisallow: /café");
    expect(evaluate(p, bot("googlebot"), "/caf%C3%A9/menu").allowed).toBe(false);
    expect(evaluate(p, bot("googlebot"), "/caf%c3%a9").allowed).toBe(false);
  });

  it("treats a literal $ in the middle of a pattern as a character", () => {
    const p = parseRobots("User-agent: *\nDisallow: /price$list");
    expect(evaluate(p, bot("googlebot"), "/price$list/a").allowed).toBe(false);
  });
});

describe("lint issues", () => {
  it("flags orphan rules, typos, missing slashes, noindex, crawl-delay, relative sitemaps, HTML, block-all", () => {
    const p = parseRobots("Disallow: /x\n<html>\nUser-agent: *\nDissallow: /y\nDisallow: admin\nNoindex: /z\nCrawl-delay: 5\nSitemap: /sitemap.xml\nDisallow: /");
    const codes = p.issues.map((i) => i.code);
    for (const c of ["orphan-rule", "html", "unknown-field", "no-slash", "noindex", "crawl-delay", "sitemap-relative", "block-all"]) expect(codes).toContain(c);
    expect(p.issues.find((i) => i.code === "unknown-field")?.message).toContain('Did you mean "disallow"');
  });

  it("truncates content past 500 KiB like Google", () => {
    const big = "User-agent: *\n" + "Disallow: /keep\n" + "#".repeat(520 * 1024) + "\nDisallow: /lost\n";
    const p = parseRobots(big);
    expect(p.truncated).toBe(true);
    expect(evaluate(p, bot("googlebot"), "/lost").allowed).toBe(true);
    expect(evaluate(p, bot("googlebot"), "/keep").allowed).toBe(false);
  });

  it("sitemap lines do not break a group", () => {
    const p = parseRobots("User-agent: GPTBot\nSitemap: https://e.com/s.xml\nDisallow: /");
    expect(evaluate(p, bot("gptbot"), "/a").allowed).toBe(false);
    expect(p.sitemaps).toHaveLength(1);
  });
});

describe("URL list", () => {
  it("accepts paths and URLs, rejects others, dedupes", () => {
    const r = parseUrlList("/a\nhttps://example.com/b?x=1#frag\nexample.com/c\n/a\n\n# comment\n/has space");
    expect(r.urls.map((u) => u.path)).toEqual(["/a", "/b?x=1"]);
    expect(r.invalid).toHaveLength(2);
    expect(r.duplicates).toBe(1);
  });

  it("custom crawler tokens validate", () => {
    expect(customCrawler("MyBot")?.chain).toEqual(["mybot", "*"]);
    expect(customCrawler("bad bot")).toBeNull();
  });
});

describe("change review", () => {
  const current = parseRobots("User-agent: *\nDisallow: /admin/\n");
  const proposed = parseRobots("User-agent: *\nDisallow: /admin/\nDisallow: /search\n\nUser-agent: GPTBot\nUser-agent: ClaudeBot\nDisallow: /\n");
  const urls = parseUrlList("/\n/blog/launch\n/search?q=x\n/admin/login").urls;
  const crawlers = [bot("googlebot"), bot("gptbot"), bot("claudebot")];
  const r = review(current, proposed, urls, crawlers);

  it("classifies newly blocked, unchanged and rule-changed combinations", () => {
    const find = (path: string, id: string) => r.cells.find((c) => c.url.path === path && c.crawler.id === id);
    expect(find("/search?q=x", "googlebot")?.change).toBe("newly-blocked");
    expect(find("/blog/launch", "gptbot")?.change).toBe("newly-blocked");
    expect(find("/blog/launch", "googlebot")?.change).toBe("same");
    // admin was blocked by "/admin/" for GPTBot before, and by "/" after: same verdict, different rule
    expect(find("/admin/login", "gptbot")?.change).toBe("rule-changed");
    expect(r.counts["newly-blocked"]).toBe(7);
    expect(r.counts["newly-allowed"]).toBe(0);
  });

  it("exports CSV and Markdown", () => {
    const csv = toCsv(r);
    expect(csv.split("\n")[0]).toContain("before_rule");
    expect(csv.trim().split("\n")).toHaveLength(13);
    expect(csv).toContain('"/search?q=x"'.replace(/"/g, "")); // plain path cell
    const md = toMarkdown(r);
    expect(md).toContain("Newly blocked: 7");
    expect(md).toContain("| `/blog/launch` | GPTBot | newly blocked |");
  });
});
