import type { Cell, Change, Review } from "../lib/compare";
import { PURPOSE_LABEL } from "../lib/crawlers";

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

export const CHANGE_LABEL: Record<Change, string> = {
  "newly-blocked": "Newly blocked",
  "newly-allowed": "Newly allowed",
  "rule-changed": "Rule changed",
  same: "Unchanged",
};

export function verdictTag(allowed: boolean): string {
  return `<span class="v ${allowed ? "allowed" : "blocked"}">${allowed ? "Allowed" : "Blocked"}</span>`;
}

function cellInner(c: Cell): string {
  const before = c.before.allowed ? "allowed" : "blocked";
  const after = c.after.allowed ? "allowed" : "blocked";
  if (c.change === "same") {
    return `<span class="mx-same ${after}" aria-hidden="true">${after === "allowed" ? "✓" : "×"}</span><span class="sr-only">${CHANGE_LABEL.same}, ${after}</span>`;
  }
  return `<span class="mx-flow" aria-hidden="true"><i class="${before}">${before === "allowed" ? "✓" : "×"}</i><b>→</b><i class="${after}">${after === "allowed" ? "✓" : "×"}</i></span><span class="mx-label">${CHANGE_LABEL[c.change]}</span>`;
}

export interface MatrixOptions {
  changesOnly: boolean;
  maxRows: number;
  selected?: { path: string; crawler: string } | null;
  interactive: boolean;
}

export function renderMatrix(r: Review, opts: MatrixOptions): { html: string; shownRows: number; totalRows: number } {
  const byPath = new Map<string, Cell[]>();
  for (const c of r.cells) {
    const list = byPath.get(c.url.path) ?? [];
    list.push(c);
    byPath.set(c.url.path, list);
  }
  let rows = [...byPath.entries()];
  if (opts.changesOnly) rows = rows.filter(([, cells]) => cells.some((c) => c.change !== "same"));
  const totalRows = rows.length;
  rows = rows.slice(0, opts.maxRows);

  const head = r.crawlers
    .map((c) => {
      const pc = r.perCrawler[c.id];
      const lost = pc ? pc["newly-blocked"] : 0;
      return `<th scope="col"><span class="mx-bot">${esc(c.name)}</span><span class="mx-purpose">${esc(PURPOSE_LABEL[c.purpose])}</span>${lost ? `<span class="mx-lost">−${lost}</span>` : ""}</th>`;
    })
    .join("");

  const body = rows
    .map(([path, cells]) => {
      const tds = cells
        .map((c) => {
          const sel = opts.selected && opts.selected.path === path && opts.selected.crawler === c.crawler.id;
          const attrs = opts.interactive
            ? ` tabindex="0" role="button" aria-pressed="${sel ? "true" : "false"}" data-path="${esc(path)}" data-crawler="${esc(c.crawler.id)}" aria-label="${esc(`${path}, ${c.crawler.name}: ${CHANGE_LABEL[c.change]}. Before ${c.before.allowed ? "allowed" : "blocked"}, after ${c.after.allowed ? "allowed" : "blocked"}`)}"`
            : "";
          return `<td class="mx-cell ${c.change}${sel ? " is-selected" : ""}"${attrs}>${cellInner(c)}</td>`;
        })
        .join("");
      return `<tr><th scope="row"><code>${esc(path)}</code></th>${tds}</tr>`;
    })
    .join("");

  const html = `<table class="mx"><thead><tr><th scope="col" class="mx-corner">Path</th>${head}</tr></thead><tbody>${body}</tbody></table>`;
  return { html, shownRows: rows.length, totalRows };
}
