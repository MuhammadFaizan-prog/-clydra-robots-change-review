import "./styles/base.css";
import "./styles/matrix.css";
import "./styles/tool.css";
import { parseRobots, parseUrlList, MAX_URLS, type Crawler, type Issue, type ParsedRobots, type Verdict } from "./lib/robots";
import { CRAWLERS, DEFAULT_CRAWLERS, PURPOSE_LABEL, customCrawler } from "./lib/crawlers";
import { review, toCsv, toMarkdown, describeVerdict, type Review } from "./lib/compare";
import { SAMPLE_CURRENT, SAMPLE_PATHS, SAMPLE_PROPOSED } from "./lib/sample";
import { esc, renderMatrix, verdictTag, CHANGE_LABEL } from "./ui/matrix";

const MAX_ROWS = 300;

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el as T;
};

const currentEl = $<HTMLTextAreaElement>("current");
const proposedEl = $<HTMLTextAreaElement>("proposed");
const pathsEl = $<HTMLTextAreaElement>("paths");
const stateEl = $("state");
const matrixEl = $("matrix");
const summaryEl = $("summary");
const inspectorEl = $("inspector");
const rowsNoteEl = $("rows-note");
const toastEl = $("toast");
const copyBtn = $<HTMLButtonElement>("copy-md");
const csvBtn = $<HTMLButtonElement>("download-csv");

const allCrawlers: Crawler[] = [...CRAWLERS];
const selectedIds = new Set<string>(DEFAULT_CRAWLERS);
let changesOnly = true;
let selected: { path: string; crawler: string } | null = null;
let lastReview: Review | null = null;
let parsedCurrent: ParsedRobots = parseRobots("");
let parsedProposed: ParsedRobots = parseRobots("");

/* ---------- tabs ---------- */
const tabs = [$("tab-current"), $("tab-proposed")];
function selectTab(i: number, focus = true): void {
  tabs.forEach((t, j) => {
    const on = i === j;
    t.setAttribute("aria-selected", String(on));
    t.tabIndex = on ? 0 : -1;
    const pane = document.getElementById(t.getAttribute("aria-controls") ?? "");
    if (pane) pane.hidden = !on;
  });
  if (focus) tabs[i]?.focus();
}
tabs.forEach((t, i) => {
  t.addEventListener("click", () => selectTab(i));
  t.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      selectTab((i + 1) % 2);
    }
  });
});

/* ---------- crawlers ---------- */
function renderCrawlerPicker(): void {
  const purposes = ["search", "ai-training", "ai-search", "ai-user", "other", "custom"] as const;
  const html = purposes
    .map((p) => {
      const list = allCrawlers.filter((c) => c.purpose === p);
      if (!list.length) return "";
      const items = list
        .map(
          (c) => `<label class="chip"><input type="checkbox" value="${esc(c.id)}" ${selectedIds.has(c.id) ? "checked" : ""} /><span>${esc(c.name)}</span><small>${esc(c.operator)}</small></label>`,
        )
        .join("");
      return `<fieldset class="chips"><legend>${esc(PURPOSE_LABEL[p])}</legend>${items}</fieldset>`;
    })
    .join("");
  $("crawler-groups").innerHTML = html;
  $("crawler-count").textContent = `${selectedIds.size} selected`;
}

$("crawler-groups").addEventListener("change", (e) => {
  const t = e.target as HTMLInputElement;
  if (t.type !== "checkbox") return;
  if (t.checked) selectedIds.add(t.value);
  else selectedIds.delete(t.value);
  $("crawler-count").textContent = `${selectedIds.size} selected`;
  schedule();
});

$("custom-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = $<HTMLInputElement>("custom-token");
  const err = $("custom-error");
  const c = customCrawler(input.value);
  if (!c) {
    err.textContent = input.value.trim() ? "Use letters, hyphens or underscores only, like the token in a User-agent line." : "Type a product token first.";
    input.setAttribute("aria-invalid", "true");
    input.focus();
    return;
  }
  const existing = allCrawlers.find((x) => x.chain[0] === c.chain[0]);
  if (existing) {
    selectedIds.add(existing.id);
    err.textContent = `${existing.name} is already in the list; it is now selected.`;
  } else {
    allCrawlers.push(c);
    selectedIds.add(c.id);
    err.textContent = "";
  }
  input.removeAttribute("aria-invalid");
  input.value = "";
  renderCrawlerPicker();
  schedule();
});

/* ---------- lint lists ---------- */
function renderIssues(listId: string, issues: Issue[], textarea: HTMLTextAreaElement, tabIndex: number): void {
  const list = $(listId);
  if (!issues.length) {
    list.innerHTML = "";
    return;
  }
  const order = { error: 0, warning: 1, info: 2 } as const;
  const sorted = [...issues].sort((a, b) => order[a.severity] - order[b.severity] || (a.line ?? 0) - (b.line ?? 0));
  list.innerHTML = sorted
    .map(
      (i) =>
        `<li class="issue ${i.severity}"><span class="sev">${i.severity === "error" ? "Error" : i.severity === "warning" ? "Check" : "Note"}</span>${
          i.line ? `<button type="button" class="line-link" data-line="${i.line}">Line ${i.line}</button>` : ""
        }<span class="msg">${esc(i.message)}</span></li>`,
    )
    .join("");
  list.querySelectorAll<HTMLButtonElement>(".line-link").forEach((b) =>
    b.addEventListener("click", () => {
      selectTab(tabIndex, false);
      selectLine(textarea, Number(b.dataset.line));
    }),
  );
}

function selectLine(ta: HTMLTextAreaElement, line: number): void {
  const lines = ta.value.split("\n");
  let start = 0;
  for (let i = 0; i < line - 1 && i < lines.length; i++) start += (lines[i]?.length ?? 0) + 1;
  const end = start + (lines[line - 1]?.length ?? 0);
  ta.focus();
  ta.setSelectionRange(start, end);
  const lh = parseFloat(getComputedStyle(ta).lineHeight) || 20;
  ta.scrollTop = Math.max(0, (line - 3) * lh);
}

function meta(p: ParsedRobots): string {
  if (p.empty) return "empty";
  const errors = p.issues.filter((i) => i.severity === "error").length;
  const warns = p.issues.filter((i) => i.severity === "warning").length;
  const g = `${p.groups.length} group${p.groups.length === 1 ? "" : "s"}`;
  return errors ? `${g} · ${errors} error${errors > 1 ? "s" : ""}` : warns ? `${g} · ${warns} to check` : g;
}

/* ---------- main compute ---------- */
let timer: number | undefined;
function schedule(): void {
  window.clearTimeout(timer);
  timer = window.setTimeout(run, 160);
}

function setState(html: string): void {
  stateEl.innerHTML = html;
  stateEl.hidden = !html;
}

function run(): void {
  parsedCurrent = parseRobots(currentEl.value);
  parsedProposed = parseRobots(proposedEl.value);
  $("meta-current").textContent = parsedCurrent.empty ? "none (all allowed)" : meta(parsedCurrent);
  $("meta-proposed").textContent = meta(parsedProposed);
  renderIssues("issues-current", parsedCurrent.issues, currentEl, 0);
  renderIssues("issues-proposed", parsedProposed.issues, proposedEl, 1);

  const urls = parseUrlList(pathsEl.value);
  const pathsStatus = $("paths-status");
  const bits = [`${urls.urls.length} path${urls.urls.length === 1 ? "" : "s"}`];
  if (urls.duplicates) bits.push(`${urls.duplicates} duplicate${urls.duplicates > 1 ? "s" : ""} skipped`);
  if (urls.truncated) bits.push(`limit ${MAX_URLS} reached`);
  pathsStatus.textContent = pathsEl.value.trim() ? bits.join(" · ") : "One per line";
  pathsEl.setAttribute("aria-invalid", urls.invalid.length ? "true" : "false");
  $("paths-errors").innerHTML = urls.invalid
    .slice(0, 8)
    .map((i) => `<li class="issue error"><span class="sev">Line ${i.line}</span><span class="msg"><code>${esc(i.input.slice(0, 80))}</code> ${esc(i.message)}</span></li>`)
    .join("") + (urls.invalid.length > 8 ? `<li class="issue info"><span class="msg">${urls.invalid.length - 8} more lines skipped.</span></li>` : "");

  const crawlers = allCrawlers.filter((c) => selectedIds.has(c.id));
  lastReview = null;
  copyBtn.disabled = true;
  csvBtn.disabled = true;
  matrixEl.hidden = true;
  rowsNoteEl.textContent = "";

  if (parsedProposed.empty && parsedCurrent.empty) {
    summaryEl.innerHTML = "";
    inspectorEl.innerHTML = "";
    setState(`<div class="empty"><h2>Paste two versions of robots.txt to compare them</h2>
      <p>Put the file that is live today under <b>Current</b> and your edit under <b>Proposed</b>, then list the paths you care about. Results appear here as you type.</p>
      <button class="btn" type="button" data-action="example">Load the shop example</button></div>`);
    return;
  }
  if (parsedProposed.empty) {
    summaryEl.innerHTML = "";
    inspectorEl.innerHTML = "";
    setState(`<div class="empty"><h2>Now add the proposed version</h2><p>Open the <b>Proposed</b> tab and paste your edited file. An empty proposed file would mean deleting robots.txt; to review that, type a single comment line such as <code># removed</code>.</p><button class="btn ghost" type="button" data-action="tab-proposed">Go to Proposed</button></div>`);
    return;
  }
  if (!urls.urls.length) {
    summaryEl.innerHTML = "";
    inspectorEl.innerHTML = "";
    setState(`<div class="empty"><h2>Add the paths you want checked</h2><p>Paste paths like <code>/products/shirt</code> or full URLs, one per line. ${urls.invalid.length ? "The lines you entered could not be read; see the notes under the box." : "A sample from your sitemap and your top landing pages is a good start."}</p><button class="btn ghost" type="button" data-action="focus-paths">Go to paths</button></div>`);
    return;
  }
  if (!crawlers.length) {
    summaryEl.innerHTML = "";
    inspectorEl.innerHTML = "";
    setState(`<div class="empty"><h2>Pick at least one crawler</h2><p>Choose crawlers by purpose in step 3.</p></div>`);
    return;
  }

  const r = review(parsedCurrent, parsedProposed, urls.urls, crawlers);
  lastReview = r;
  copyBtn.disabled = false;
  csvBtn.disabled = false;
  const changed = r.counts["newly-blocked"] + r.counts["newly-allowed"] + r.counts["rule-changed"];
  summaryEl.innerHTML = `
    <div class="count blocked"><b>${r.counts["newly-blocked"]}</b><span>newly blocked</span></div>
    <div class="count allowed"><b>${r.counts["newly-allowed"]}</b><span>newly allowed</span></div>
    <div class="count moved"><b>${r.counts["rule-changed"]}</b><span>rule changed</span></div>
    <div class="count same"><b>${r.counts.same}</b><span>unchanged</span></div>
    <p class="scope">${r.urls.length} path${r.urls.length === 1 ? "" : "s"} × ${r.crawlers.length} crawler${r.crawlers.length === 1 ? "" : "s"}</p>`;

  if (changesOnly && changed === 0) {
    setState(`<div class="empty ok"><h2>No changes for these ${r.cells.length} combinations</h2><p>Every checked path gets the same verdict from the same rule in both files. Paths you did not list are not covered.</p><button class="btn ghost" type="button" data-action="show-all">Show all rows</button></div>`);
    inspectorEl.innerHTML = "";
    return;
  }
  setState("");
  if (selected && !r.cells.some((c) => c.url.path === selected?.path && c.crawler.id === selected?.crawler)) selected = null;
  if (!selected) {
    const first = r.cells.find((c) => c.change === "newly-blocked") ?? r.cells.find((c) => c.change !== "same") ?? r.cells[0];
    if (first) selected = { path: first.url.path, crawler: first.crawler.id };
  }
  const m = renderMatrix(r, { changesOnly, maxRows: MAX_ROWS, selected, interactive: true });
  matrixEl.innerHTML = m.html;
  matrixEl.hidden = false;
  rowsNoteEl.textContent = m.totalRows > m.shownRows ? `Showing the first ${m.shownRows} of ${m.totalRows} rows. The CSV export includes every row.` : "";
  renderInspector();
}

function ruleBlock(label: string, v: Verdict, p: ParsedRobots): string {
  const groupLine = v.groupToken ? `Group used: <code>User-agent: ${esc(v.groupToken)}</code>` : v.reason === "no-file" ? "No file" : "No group applies";
  const line = v.rule ? `<pre class="rule"><span class="ln">${v.rule.line}</span>${esc(v.rule.raw)}</pre>` : "";
  void p;
  return `<div class="side"><h4>${label}</h4>${verdictTag(v.allowed)}<p>${esc(describeVerdict(v))}</p>${line}<p class="group">${groupLine}</p></div>`;
}

function renderInspector(): void {
  if (!lastReview || !selected) {
    inspectorEl.innerHTML = "";
    return;
  }
  const cell = lastReview.cells.find((c) => c.url.path === selected?.path && c.crawler.id === selected?.crawler);
  if (!cell) {
    inspectorEl.innerHTML = "";
    return;
  }
  const c = cell.crawler;
  inspectorEl.innerHTML = `
    <header><p class="eyebrow">${esc(CHANGE_LABEL[cell.change])}</p>
    <h3><code>${esc(cell.url.path)}</code> for ${esc(c.name)}</h3>
    <p class="who">${esc(c.operator)} · ${esc(PURPOSE_LABEL[c.purpose])} · token chain ${c.chain.map((t) => `<code>${esc(t)}</code>`).join(" → ")}</p>
    ${c.note ? `<p class="note">${esc(c.note)}</p>` : ""}</header>
    <div class="sides">${ruleBlock("Current", cell.before, parsedCurrent)}<div class="arrow" aria-hidden="true">→</div>${ruleBlock("Proposed", cell.after, parsedProposed)}</div>
    ${c.docs ? `<p class="docs"><a href="${esc(c.docs)}" rel="noopener" target="_blank">${esc(c.operator)} documentation for ${esc(c.name)}</a></p>` : ""}`;
}

matrixEl.addEventListener("click", (e) => {
  const td = (e.target as HTMLElement).closest<HTMLElement>("td[data-path]");
  if (!td) return;
  pick(td);
});
matrixEl.addEventListener("keydown", (e) => {
  const td = (e.target as HTMLElement).closest<HTMLElement>("td[data-path]");
  if (!td) return;
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    pick(td);
  }
});
function pick(td: HTMLElement): void {
  selected = { path: td.dataset.path ?? "", crawler: td.dataset.crawler ?? "" };
  matrixEl.querySelectorAll("td.is-selected").forEach((x) => {
    x.classList.remove("is-selected");
    x.setAttribute("aria-pressed", "false");
  });
  td.classList.add("is-selected");
  td.setAttribute("aria-pressed", "true");
  renderInspector();
}

/* ---------- actions ---------- */
function loadExample(): void {
  currentEl.value = SAMPLE_CURRENT;
  proposedEl.value = SAMPLE_PROPOSED;
  pathsEl.value = SAMPLE_PATHS;
  selected = null;
  for (const id of ["googlebot", "bingbot", "gptbot", "oai-searchbot", "claudebot", "perplexitybot", "google-extended"]) selectedIds.add(id);
  renderCrawlerPicker();
  run();
  flash("Loaded the shop example.");
}

function clearAll(): void {
  currentEl.value = "";
  proposedEl.value = "";
  pathsEl.value = "";
  selected = null;
  run();
  selectTab(0, false);
  currentEl.focus();
  flash("Cleared. Nothing was stored.");
}

let toastTimer: number | undefined;
function flash(msg: string): void {
  toastEl.textContent = msg;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (toastEl.textContent = ""), 3500);
}

stateEl.addEventListener("click", (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-action]");
  if (!b) return;
  const a = b.dataset.action;
  if (a === "example") loadExample();
  if (a === "tab-proposed") {
    selectTab(1, false);
    proposedEl.focus();
  }
  if (a === "focus-paths") pathsEl.focus();
  if (a === "show-all") {
    changesOnly = false;
    const all = document.querySelector<HTMLInputElement>('input[name="rows"][value="all"]');
    if (all) all.checked = true;
    run();
  }
});

$("load-example").addEventListener("click", loadExample);
$("clear-all").addEventListener("click", clearAll);
document.querySelectorAll<HTMLInputElement>('input[name="rows"]').forEach((r) =>
  r.addEventListener("change", () => {
    changesOnly = r.value === "changes" && r.checked ? true : r.value === "all" && r.checked ? false : changesOnly;
    run();
  }),
);

copyBtn.addEventListener("click", async () => {
  if (!lastReview) return;
  const text = toMarkdown(lastReview);
  try {
    await navigator.clipboard.writeText(text);
    flash("PR summary copied as Markdown.");
  } catch {
    // Clipboard can be blocked (permissions, insecure context): fall back to a download.
    download(text, "robots-change-review.md", "text/markdown");
    flash("Clipboard unavailable, so the summary was downloaded as robots-change-review.md.");
  }
});

csvBtn.addEventListener("click", () => {
  if (!lastReview) return;
  download(toCsv(lastReview), "robots-change-review.csv", "text/csv");
  flash(`Downloaded robots-change-review.csv (${lastReview.cells.length} rows).`);
});

function download(text: string, name: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

for (const el of [currentEl, proposedEl, pathsEl]) el.addEventListener("input", schedule);

renderCrawlerPicker();
window.addEventListener("hashchange", () => {
  if (location.hash === "#example") loadExample();
});
if (location.hash === "#example") loadExample();
else run();
