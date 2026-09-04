# Ruby × Rails compatibility matrix

Static site for the pending Ruby/Rails upgrade: a grid, Ruby down the side, Rails across the top (x.y only, patch versions ignored), plus an interactive router that plans an upgrade path between any two cells.

Source is ESM modules under `src/`; a build step bundles them into `dist/` for GitHub Pages. No external deps besides Google Fonts.

## The grid
Each cell is green (officially supported), blue (works, not an official pairing), red (not supported/known broken), or gray (no data) — hover (or focus) any cell for a popover with the reasoning. Green and blue cells also carry a confidence flag: solid fill = confirmed by a citation, dashed border = inferred from the release timeline only. Cell popovers also show each version's lifecycle status (maintained / security-only / EOL), derived from the EOL dates at render time.

## Data invariants (IMPORTANT)
Editing `data.json` is the only supported way to change the matrix, and two rules keep bookmarks working across edits:

1. **Versions are only appended at the end and culled from the front.** Never insert a version in the middle of `ruby_versions` / `rails_versions`. The journey serializer encodes versions by their string and reconstructs routes positionally, so any violation of this rule silently breaks old bookmarks — it is on whoever broke it to fix.
2. **Any change to the path-finding function MUST bump `ROUTER_VERSION`** in `src/journey.js`. It is folded into the URL fingerprint so stale bookmarks are detected even when `data.json` is unchanged.

**Method:**
- Minimum Ruby per Rails series comes straight from `required_ruby_version` in that series' `rails.gemspec`. Confirmed minimums: 4.0–4.2 → 1.9.3, 5.0–5.2 → 2.2.2, 6.0–6.1 → 2.5.0, 7.0–7.1 → 2.7.0, 7.2 → 3.1.0, 8.0–8.1 → 3.2.0.
- Above the floor: green if the Ruby version shipped within roughly Rails' release year + 2 (confirmed if within ~1 year, inferred if further out); otherwise blue (works, untested pairing, always inferred). Some inferred greens have since been confirmed against real CI (`4.0|2.2`, `4.1|2.3`, `4.2|2.4` via the branches' final `.travis.yml`).
- Two documented breaks override the floor regardless of timeline:
  - Ruby 3.0's positional/keyword-argument separation breaks Rails ≤6.0 outright (confirmed: rails/rails#40938). → red.
  - Ruby 3.2+'s built-in `Set` class, plus Ruby 3.4's removal of default gems like `cgi`, forces a workaround on Rails 6.1 and 7.0 (fixed upstream in 7.1+). → blue, confirmed, with the workaround spelled out in each affected cell's popover.
- Ruby 4.0 (Dec 2025) and Rails 8.1 (Oct 2025) are both confirmed released.

This is a heuristic for upgrade planning, not a guarantee — verify anything load-bearing against your own `Gemfile.lock` and CI.

## Interactive upgrade path
- **Pins:** click any non-red cell to drop a Home pin; Target auto-places on the newest pair. Both pins are draggable, snap to the nearest cell, and refuse to land on red. A Reset button clears both.
- **Router:** up to 5 cheapest loop-free paths, computed with a bounded k-shortest-paths search (grid is a DAG, movement monotone toward Target). Manhattan-only: one axis per step, never both.
- **Weights:** green confirmed 1, green inferred 1.5, blue 2, gray 10, red impassable. Plus +1 every time the route switches axis.
- **Journeys table** (alongside the grid): Weight, Segments (hover for the full stop-by-stop route), Risk. Clicking a row draws it.
- **Current step:** once Home/Target are set, clicking a cell on the drawn path marks it as the current step — the path dims beyond it.
- **Bookmarks:** the URL carries the whole journey — `#j;<fingerprint>;h<home>;t<target>;<route>;s<step>` — auto-synced as you move pins/select/advance. A **Copy Link** button copies the shareable URL. On load, bookmarks re-map onto the current grid by version string; if the bookmarked route is no longer valid a note explains why.
- Marching-ants animation on the path was discussed and explicitly deferred to a "v2."

## Repo layout

All data lives in `data.json` — the single source of truth. Versions carry `released`/`support`/`eol` dates; cells carry `status`/`confidence`/`notes` (template refs + literals).

- `src/widget.js` — `<ruby-rails-matrix>` custom element (shadow DOM), the single UI entry for both the site page and embeds.
- `src/core.js` — `createApp(DATA, root, opts)`: wires grid/table/pins/paths, URL serialization, Copy Link. Reused by both the site and the widget.
- `src/notes.js` — `Notes` class: version comparison, note templates + per-cell refs, rule fallback (`noteRules`).
- `src/router.js` — `Router` class (pure): k-shortest-paths, legs, risk, weights.
- `src/grid.js` — `Grid` class: SVG matrix, draggable pins, path drawing + current-step dimming.
- `src/table.js` — `PathsTable`: journeys table.
- `src/popover.js` — hover/focus popover component (replaces every native `title`).
- `src/journey.js` — URL serialization (`ROUTER_VERSION`, fingerprint, encode/decode).
- `src/lifecycle.js` — maintained / security-only / EOL labels from dates.

- `styles.css` — theming via CSS custom properties.

## Widget

Drop the matrix card (legend, toolbar, grid + journeys table) into any page:

```html
<script type="module" src="https://<site>/widget.js"></script>
<ruby-rails-matrix home="5.2|2.7" target="8.1|4.0" theme="auto"></ruby-rails-matrix>
```

- `home` / `target` — initial pins as `"rails|ruby"` version pairs.
- `theme` — `light` | `dark` | `auto` (default auto).
- `data-src` / `data-styles` — optional overrides; by default the widget locates `data.json`/`styles.css` relative to its own published script URL.
- Rendered in a shadow root (fully isolated styles); the notes footer is not included.

## Build & deploy

- Dev: serve the folder (`python3 -m http.server`) and open `index.html` — it loads the ESM modules directly.
- Build: `npm run build` (esbuild) → `dist/` with `widget.js` (ESM bundle) plus assets.
- GitHub Pages: `.github/workflows/pages.yml` runs `npm ci && npm run build` on push and deploys `dist/`.
- Everything is version-driven from `data.json`; nothing in the HTML or JS hardcodes a Ruby/Rails version.

## Roadmap

1. ✅ **Data extraction** — `data.json` is the single source of truth.
2. ✅ **Popovers** — every native `title` replaced by a styled popover (hover/focus, 50vh max); Sources section kept, Method prose folded into cell notes.
3. ✅ **Journey serialization** — `#j;…` fragment with fingerprint + version-encoded home/target + exact route runs + step; Copy Link.
4. ✅ **Current step in the hash** — clicking a path cell advances the step; persisted in `s`; dims the remainder.
5. ✅ **GitHub Pages scaffold** — esbuild → `dist/`, Actions workflow.
6. ✅ **Embed as a widget** — `<ruby-rails-matrix>` custom element (shadow DOM), configurable Home/Target/theme; plus `embed.html` (card-only iframe page) for GitLab MRs where scripts are stripped.
7. ✅ **EOL data + enrichment** — release/support/EOL dates for Rails and Ruby, lifecycle labels, corrected provisional dates.
8. Future: SVG keyboard arrow navigation; marching-ants; "copy link" share sheet; more sources per version.
