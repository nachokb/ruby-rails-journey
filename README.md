# Ruby × Rails compatibility matrix

An interactive upgrade-planning grid: Ruby versions down the side, Rails versions across the top, with an upgrade-path router between any two cells.

## Requirements

- Node.js 18+ (for build/tests)
- A static HTTP server for running the site (ESM modules and `fetch("data.json")` require HTTP, not `file://`)

## Build

```sh
npm install      # first time
npm run build    # bundles src/widget.js -> dist/widget.js + copies assets
```

`dist/` is what GitHub Pages deploys (see `.github/workflows/pages.yml`).

## Run locally (dev, no build needed)

```sh
python3 -m http.server 3333
# open http://localhost:3333
```

Source ESM modules are loaded directly from `src/`; no build step in dev.

## Test

```sh
npm test
```

Runs `test/journey.test.mjs`, `test/core.test.mjs`, `test/bundle.test.mjs` (a DOM stub, no browser required).

> Tests load the real `data.json`. Appending new versions or editing cell data is fine; **culling a version from the front of the version arrays shifts indices and will break tests** (same rule as URL bookmarks — see INDEX.md).

```sh
npm run test:smoke
```

## Embed

```html
<script type="module" src="https://<your-site>/widget.js"></script>
<ruby-rails-matrix home="5.2|2.7" target="8.1|4.0" theme="auto"></ruby-rails-matrix>
```

- `home` / `target` — optional initial pins, `"rails|ruby"` version pairs
- `theme` — `light` | `dark` | `auto` (default `auto`)
- `data-src` / `data-styles` — optional overrides; by default the widget locates `data.json`/`styles.css` relative to its own script URL
- `data-fragment="true"` — read the initial state from the page's `#j;…` fragment (used by `embed.html`)
- Rendered in a shadow root (isolated styles)

`index.html` and `embed.html` both host a single `<ruby-rails-matrix>` (the widget is the one true card). `demo.html` demonstrates embedding the widget into an arbitrary page.

## Embed via iframe (GitLab MR)

GitLab strips `<script>` from MR descriptions, so the widget's JS bundle can't run there. Instead use the iframe build (`embed.html`, card-only, fixed 780px):

```html
<iframe src="https://<site>/embed.html#j;…" width="780" height="660"></iframe>
```

- The `#j;…` fragment configures Home/Target/path — the **share menu** (share icon in the toolbar) offers three copies: **Copy URL**, **Copy iframe code**, and **Copy Web Component code** (all carrying the current journey).
- Theme follows `prefers-color-scheme`.
- **Requires allowlisting** the Pages domain as an iframe source: self-hosted GitLab instance setting `allow_iframe_href` (instance-level). gitlab.com does **not** allow arbitrary iframe domains, so it won't render there — nor will GitHub PR descriptions (GitHub similarly allowlists iframe sources).

## Data

All data lives in `data.json` (versions with release/EOL dates, per-cell status/confidence/notes). Constraints — see `INDEX.md` for details:

1. Versions are only **appended at the end** and culled **from the front**.
2. Any change to the router must **bump `ROUTER_VERSION`** in `src/journey.js`.

## Project layout

- `src/` — ESM source (`core.js` shared logic; `grid.js`, `table.js`, `router.js`, `notes.js`, `popover.js`, `journey.js`, `lifecycle.js`, `widget.js`)
- `test/` — Node test suite
- `dist/` — build output (gitignored)
- `demo.html` — widget demo page
- `embed.html` — iframe embed page (card-only, fixed 780px, for GitLab MRs)
