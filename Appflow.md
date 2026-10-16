# Appflow

1. Landing `/`: nav (What you get, How it works, FAQ, Open the reviewer, Built by Clydara) -> hero with live sample matrix -> what the review shows -> how it works -> use cases -> privacy & limits -> FAQ -> closing CTA.
2. "Open the reviewer" -> `/tool.html` (empty state). "Run the shop example" -> `/tool.html#example` (sample loaded and computed).
3. Workspace: left = 1 files (Current/Proposed tabs with lint lists), 2 paths, 3 crawlers (chips by purpose + custom token); right = counts, row filter (Changed rows / All rows), exports, matrix, inspector.
States: first visit (paste prompt + example button); proposed empty; no valid paths; no crawlers; no changes (success-neutral, "Show all rows"); results; >300 rows note; copy/download feedback toast; clipboard fallback to download; clear all.
Responsive: <=900 px single column (inputs then results); matrix scrolls inside its frame with sticky path column; inspector stacks.
Keyboard: tabs with arrow keys; matrix cells are buttons (Enter/Space); lint line links jump to and select the line; skip link to results.
