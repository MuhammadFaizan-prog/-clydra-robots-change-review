import type { Crawler } from "./robots";

// Product tokens as published by each operator (checked October 2026).
// Operators change these; each entry links its documentation so reviewers can confirm.
const GOOGLE = "https://developers.google.com/search/docs/crawling-indexing/overview-google-crawlers";
const OPENAI = "https://platform.openai.com/docs/bots";
const ANTHROPIC = "https://support.anthropic.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler";
const PERPLEXITY = "https://docs.perplexity.ai/guides/bots";
const APPLE = "https://support.apple.com/en-us/119829";

export const CRAWLERS: Crawler[] = [
  { id: "googlebot", name: "Googlebot", operator: "Google", purpose: "search", chain: ["googlebot", "*"], docs: GOOGLE },
  { id: "googlebot-image", name: "Googlebot-Image", operator: "Google", purpose: "search", chain: ["googlebot-image", "googlebot", "*"], note: "Falls back to the Googlebot group when it has none of its own.", docs: GOOGLE },
  { id: "bingbot", name: "Bingbot", operator: "Microsoft", purpose: "search", chain: ["bingbot", "*"], docs: "https://www.bing.com/webmasters/help/which-crawlers-does-bing-use-8c184ec0" },
  { id: "duckduckbot", name: "DuckDuckBot", operator: "DuckDuckGo", purpose: "search", chain: ["duckduckbot", "*"], docs: "https://duckduckgo.com/duckduckgo-help-pages/results/duckduckbot" },
  { id: "applebot", name: "Applebot", operator: "Apple", purpose: "search", chain: ["applebot", "*"], docs: APPLE },
  { id: "google-extended", name: "Google-Extended", operator: "Google", purpose: "ai-training", chain: ["google-extended", "*"], note: "A control token, not a separate crawler. It does not affect Google Search.", docs: GOOGLE },
  { id: "applebot-extended", name: "Applebot-Extended", operator: "Apple", purpose: "ai-training", chain: ["applebot-extended", "*"], note: "A control token for AI training use; Applebot still crawls.", docs: APPLE },
  { id: "gptbot", name: "GPTBot", operator: "OpenAI", purpose: "ai-training", chain: ["gptbot", "*"], docs: OPENAI },
  { id: "oai-searchbot", name: "OAI-SearchBot", operator: "OpenAI", purpose: "ai-search", chain: ["oai-searchbot", "*"], docs: OPENAI },
  { id: "chatgpt-user", name: "ChatGPT-User", operator: "OpenAI", purpose: "ai-user", chain: ["chatgpt-user", "*"], note: "Fetches pages when a user asks. OpenAI says robots.txt rules may not apply to user-initiated requests.", docs: OPENAI },
  { id: "claudebot", name: "ClaudeBot", operator: "Anthropic", purpose: "ai-training", chain: ["claudebot", "*"], docs: ANTHROPIC },
  { id: "claude-searchbot", name: "Claude-SearchBot", operator: "Anthropic", purpose: "ai-search", chain: ["claude-searchbot", "*"], docs: ANTHROPIC },
  { id: "claude-user", name: "Claude-User", operator: "Anthropic", purpose: "ai-user", chain: ["claude-user", "*"], docs: ANTHROPIC },
  { id: "perplexitybot", name: "PerplexityBot", operator: "Perplexity", purpose: "ai-search", chain: ["perplexitybot", "*"], docs: PERPLEXITY },
  { id: "perplexity-user", name: "Perplexity-User", operator: "Perplexity", purpose: "ai-user", chain: ["perplexity-user", "*"], note: "User-initiated fetches; Perplexity says these generally ignore robots.txt.", docs: PERPLEXITY },
  { id: "ccbot", name: "CCBot", operator: "Common Crawl", purpose: "ai-training", chain: ["ccbot", "*"], note: "Builds the public Common Crawl dataset, widely used for model training.", docs: "https://commoncrawl.org/ccbot" },
  { id: "bytespider", name: "Bytespider", operator: "ByteDance", purpose: "ai-training", chain: ["bytespider", "*"] },
  { id: "meta-externalagent", name: "Meta-ExternalAgent", operator: "Meta", purpose: "ai-training", chain: ["meta-externalagent", "*"], docs: "https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/" },
  { id: "amazonbot", name: "Amazonbot", operator: "Amazon", purpose: "other", chain: ["amazonbot", "*"], docs: "https://developer.amazon.com/amazonbot" },
];

export const DEFAULT_CRAWLERS = ["googlebot", "bingbot", "google-extended", "gptbot", "oai-searchbot", "claudebot", "perplexitybot", "ccbot"];

export const PURPOSE_LABEL: Record<Crawler["purpose"], string> = {
  search: "Search",
  "ai-training": "AI training",
  "ai-search": "AI search",
  "ai-user": "User-triggered AI",
  other: "Other",
  custom: "Custom",
};

export function customCrawler(token: string): Crawler | null {
  const t = token.trim();
  const m = /^[A-Za-z_-]+$/.exec(t);
  if (!m) return null;
  const lower = t.toLowerCase();
  return { id: "custom-" + lower, name: t, operator: "Custom token", purpose: "custom", chain: [lower, "*"] };
}
