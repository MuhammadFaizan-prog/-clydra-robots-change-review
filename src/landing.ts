import "./styles/base.css";
import "./styles/matrix.css";
import "./styles/landing.css";
import { parseRobots, parseUrlList } from "./lib/robots";
import { CRAWLERS } from "./lib/crawlers";
import { review } from "./lib/compare";
import { SAMPLE_CURRENT, SAMPLE_PATHS, SAMPLE_PROPOSED } from "./lib/sample";
import { renderMatrix } from "./ui/matrix";

// The preview is computed live from the sample with the same code the tool uses.
const ids = ["googlebot", "bingbot", "gptbot", "oai-searchbot", "claudebot"];
const crawlers = ids.map((id) => CRAWLERS.find((c) => c.id === id)).filter((c): c is NonNullable<typeof c> => Boolean(c));
const r = review(parseRobots(SAMPLE_CURRENT), parseRobots(SAMPLE_PROPOSED), parseUrlList(SAMPLE_PATHS).urls, crawlers);

const matrix = document.getElementById("preview-matrix");
if (matrix) matrix.innerHTML = renderMatrix(r, { changesOnly: false, maxRows: 20, interactive: false }).html;

const summary = document.getElementById("preview-summary");
if (summary) {
  summary.innerHTML = `
    <span class="sum blocked"><b>${r.counts["newly-blocked"]}</b> newly blocked</span>
    <span class="sum allowed"><b>${r.counts["newly-allowed"]}</b> newly allowed</span>
    <span class="sum moved"><b>${r.counts["rule-changed"]}</b> rule changed</span>
    <span class="sum same"><b>${r.counts.same}</b> unchanged</span>`;
}
