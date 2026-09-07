import { createApp } from "./core.js";

// Embedded widget: a custom element rendering the whole matrix card (legend,
// toolbar, grid + journeys table) in a shadow root. The notes footer is not
// included. Styles and data are located relative to this module's own URL
// (import.meta.url); `data-src` / `data-styles` attributes can override.

// Theme variable sets mirror styles.css :root. Defined on the host element so
// they cascade into the shadow tree (the page's own :root is irrelevant here).
const LIGHT_VARS = {
  "--bg": "#eef1ee", "--surface": "#ffffff", "--surface-2": "#e4e8e3",
  "--ink": "#1c2321", "--ink-soft": "#5a655e", "--ink-faint": "#8b948b",
  "--line": "#d3d9d1", "--accent": "#3d5570", "--accent-soft": "#dbe4ec",
  "--home-color": "#3d5570", "--target-color": "#b5762a", "--current-color": "#7a4d8f",
  "--path-line": "#1c2321", "--path-halo": "rgb(0 0 0 / 0.15)",
  "--sem-green": "#3f7d52", "--sem-green-bg": "#cde3d4", "--sem-green-bg-soft": "#e6f0e8",
  "--sem-blue": "#3a6fa0", "--sem-blue-bg": "#c9dded", "--sem-blue-bg-soft": "#e6eff6",
  "--sem-red": "#ab392c", "--sem-red-bg": "#edc9c1", "--sem-red-bg-soft": "#f6e5e1",
  "--sem-gray": "#8c8578", "--sem-gray-bg": "#ddd8cc", "--sem-gray-bg-soft": "#eeece5"
};
const DARK_VARS = {
  "--bg": "#171a19", "--surface": "#1f2321", "--surface-2": "#262b28",
  "--ink": "#e9ece8", "--ink-soft": "#a7b0a8", "--ink-faint": "#6d766e",
  "--line": "#333a35", "--accent": "#8fb3d6", "--accent-soft": "#26333f",
  "--home-color": "#8fb3d6", "--target-color": "#d9a561", "--current-color": "#b98ada",
  "--path-line": "#ffffff", "--path-halo": "rgb(0 0 0 / 0.5)",
  "--sem-green": "#7fd199", "--sem-green-bg": "#2b4536", "--sem-green-bg-soft": "#202b25",
  "--sem-blue": "#8fc0ef", "--sem-blue-bg": "#28394c", "--sem-blue-bg-soft": "#1f2830",
  "--sem-red": "#ec9683", "--sem-red-bg": "#4a2f29", "--sem-red-bg-soft": "#2f2521",
  "--sem-gray": "#b3ac9c", "--sem-gray-bg": "#38352c", "--sem-gray-bg-soft": "#262521"
};

const CARD_HTML = `
<section class="card">
  <div class="legend">
    <div class="legend-item" data-desc="official, tested combination"><span class="swatch green">✓</span> Supported</div>
    <div class="legend-item" data-desc="runs, but not an officially supported pairing"><span class="swatch blue">~</span> Works</div>
    <div class="legend-item" data-desc="known to fail or below the minimum"><span class="swatch red">✗</span> Not supported</div>
    <div class="legend-item" data-desc="insufficient information"><span class="swatch gray">?</span> Unknown</div>
    <span class="legend-sep">|</span>
    <div class="legend-item" data-desc="backed by a gemspec, changelog, or a specific documented issue"><span class="swatch solid-demo"></span> Confirmed</div>
    <div class="legend-item" data-desc="fits the release timeline, but no direct citation for this exact pairing"><span class="swatch dashed"></span> Inferred</div>
    <span class="legend-sep">|</span>
    <div class="legend-item" data-desc="both Ruby and Rails reached end-of-life"><span class="swatch both-eol"></span> EOL</div>
  </div>
  <div class="toolbar">
    <button id="reset-btn" class="btn" type="button" aria-label="Reset" data-popover-title="Reset" data-popover-lifecycle="Delete Home, Target, Current"><svg viewBox="0 0 57.3 49.6" class="reset-icon" aria-hidden="true" focusable="false"><path fill="currentColor" d="M10.5 7.73A34 34 0 0 0 8 10.9a26 26 0 0 0-2.53 4.77A24.5 24.5 0 0 0 4.2 29.52a24.8 24.8 0 0 0 15.45 18.45 25 25 0 0 0 6.04 1.5l.5.05a26 26 0 0 0 7.93-.5 24 24 0 0 0 4.14-1.35c.52-.26.86-.82.86-1.4q-.01-.41-.2-.78-.37-.86-.76-1.71a1.4 1.4 0 0 0-.33-.41 1.6 1.6 0 0 0-1.37-.39c-.32.07-.6.23-.92.34q-2.02.75-4.16 1.04-1.7.22-3.41.16a20 20 0 0 1-13.3-5.73A19.7 19.7 0 0 1 8.92 23a19.7 19.7 0 0 1 4.88-11.31l.55-.62zM28.24 0A26 26 0 0 0 25.6.2a24 24 0 0 0-6.46 1.74c-.6.33-.97 1.05-.9 1.73q.08.45.29.85.26.61.56 1.22c.35.59 1.06.94 1.75.86.3-.02.57-.13.83-.24q2.27-.86 4.67-1.12 1.9-.2 3.79-.07a19.8 19.8 0 0 1 15.9 10.24 19.6 19.6 0 0 1 2.34 11.18 19.6 19.6 0 0 1-4.67 11.14l-.38.43a1 1 0 0 0-.15.33l-.06.18c0 .08.07.13.12.17l3.55 3.08a32 32 0 0 0 2.1-2.6 26 26 0 0 0 4.15-9.48 24 24 0 0 0-.17-10.79 24.7 24.7 0 0 0-7.4-12.54A25 25 0 0 0 31.6.17 26 26 0 0 0 28.24 0"/><path fill="currentColor" d="M12.49 7.27H2.06A2.16 2.16 0 0 0 0 9.6q-.01.56.03 1.13c.1.7.6 1.31 1.28 1.53q.44.13.9.1h8.97v9.37c.04.7.5 1.38 1.16 1.65q.48.2 1 .16.65.01 1.3-.01c.7-.08 1.32-.58 1.54-1.24q.14-.44.1-.9V10.7a3.56 3.56 0 0 0-3.22-3.4l-.1-.02zM44.35 25.9h-1.88c-.64.06-1.23.54-1.4 1.16-.08.26-.08.52-.08.79v11.24a3.24 3.24 0 0 0 3.08 3.09h11.17q.26.01.52-.04c.6-.13 1.14-.56 1.37-1.14q.18-.47.15-.98V38.8q0-.14-.03-.27a1.7 1.7 0 0 0-1.2-1.37 3 3 0 0 0-.85-.07h-9.1v-9.6a1.7 1.7 0 0 0-1.75-1.58"/></svg></button>
    <a href="https://github.com/nachokb/ruby-rails-journey" target="_blank" id="logo" class="btn btn-inverted" type="button" data-popover-title="AI-GENERATED" data-popover-lifecycle="DeepSeek V4: ~700k tokens · Claude Sonnet 5: ~300k tokens" aria-label="Ruby × Rails Journey"><svg viewBox="0 0 53.07 24.83" class="logo-ai" aria-hidden="true" focusable="false"><path fill="currentColor" d="M6.3.06c-.65.1-1.58.34-2.11.57a6.88 6.88 0 0 0-4.11 5.6C0 6.73 0 7.51 0 10.53l.02 3.68.2-.3a8 8 0 0 1 2.84-2.36l.3-.13.04-.92c.02-.5.02-1.31 0-1.8-.04-1.09.04-2.26.2-2.8q.5-1.84 2.61-2.4c.51-.14.56-.14 2.3-.14 2.01 0 2.21.03 3.1.46q.79.36 1.4 1.3c.52.78.71 1.5.7 2.6 0 1.07-.24 1.84-.8 2.63-.3.43-.64.72-1.21 1.06-.8.5-1.5.6-3.73.6-.86 0-1.83.02-2.15.06-1.61.15-2.93.79-4.05 1.96A6 6 0 0 0 .3 16.55c-.26.83-.3 1.03-.3 4.76h3.4c.02-2.79.05-3.3.11-3.53.13-.5.32-.88.6-1.25.39-.5.74-.75 1.43-1l.44-.15 2.24-.03c2.33-.04 2.62-.07 3.54-.32a7.3 7.3 0 0 0 5.28-5.79 8 8 0 0 0-2.03-7.04A7 7 0 0 0 10.81.1C10.2-.01 6.98-.03 6.3.06M27.38.1c-.65.09-1.58.34-2.1.57a6.88 6.88 0 0 0-4.11 5.6c-.08.51-.09 1.28-.08 4.3l.02 3.69.2-.31a8 8 0 0 1 2.85-2.36l.3-.13.03-.92c.03-.5.03-1.3 0-1.79-.03-1.09.05-2.27.2-2.81q.5-1.83 2.62-2.4c.5-.13.56-.14 2.3-.14 2 0 2.2.03 3.1.46a4.16 4.16 0 0 1 2.1 3.9c-.01 1.08-.25 1.85-.8 2.63-.32.43-.65.72-1.22 1.07-.8.49-1.49.6-3.73.6-.86 0-1.82.02-2.14.05-1.62.15-2.93.8-4.05 1.96a6.2 6.2 0 0 0-1.76 4.46h3.42c.01-.43.03-.6.06-.72q.19-.71.6-1.25c.39-.5.74-.75 1.44-.99l.43-.15 2.24-.04c2.34-.03 2.63-.06 3.54-.32a7.3 7.3 0 0 0 5.28-5.78 8 8 0 0 0-2.03-7.04A7 7 0 0 0 31.9.12C31.28.02 28.07 0 27.4.1M13.03 16.13c-.1 0-.26.03-.58.13a9 9 0 0 1-2.43.37l-.86.03.1.13a391 391 0 0 0 3.87 4.8c1 1.25 1.44 1.72 1.88 2.06a6 6 0 0 0 2.49 1.1 5.92 5.92 0 0 0 6.91-4.6c.07-.25.1-.39.11-1.64h-3.41c-.02.86-.04.99-.1 1.16a2.6 2.6 0 0 1-1.36 1.59c-.34.16-.4.17-.99.17-.52 0-.67-.02-.92-.13-.64-.26-.66-.28-3.23-3.46-.72-.9-1.35-1.65-1.4-1.69zM0 21.3c0 1.8.03 2.19.09 2.37a1.7 1.7 0 0 0 3.17.16c.1-.2.1-.28.14-2.53zM51.23 1.33q-.26 0-.63.1l-1.86.44c-1.22.29-2.65.63-6.74 1.64-.62.15-1.25.34-1.4.41-1.31.67-1.19 2.65.2 3.08.2.06.46.11.59.11s.77-.13 1.44-.3l4.16-1-.07.12-.49.6a55 55 0 0 0-2.12 2.8 13 13 0 0 0-2.5 6.36c-.02.13-.03.73-.04 1.65h3.42c.02-1.9.05-2.04.12-2.37.22-.97.66-2.04 1.19-2.87s1.44-2.07 2.48-3.36l.6-.75.03 2.58c.03 2.17.05 2.62.12 2.82a1.73 1.73 0 0 0 3.2.12c.12-.25.12-.3.14-3.86 0-1.98 0-4.38-.03-5.32-.04-1.64-.05-1.73-.17-1.98a1.8 1.8 0 0 0-1.64-1.02m-17.55 14.8c-.09 0-.25.03-.58.13a9 9 0 0 1-2.42.37l-.86.03.1.13a408 408 0 0 0 3.86 4.8c1.01 1.25 1.44 1.72 1.88 2.06a5.8 5.8 0 0 0 4.62 1.1 5.9 5.9 0 0 0 4.79-4.59c.08-.32.1-.45.12-2.82h-3.42c0 1.94-.03 2.1-.1 2.33a2.6 2.6 0 0 1-1.37 1.59c-.33.16-.39.17-.98.17-.53 0-.68-.02-.93-.12-.64-.26-.66-.29-3.23-3.47-.72-.89-1.34-1.65-1.39-1.69z"/></svg></a>
    <button id="copy-link-btn" class="btn" type="button" aria-label="Share" data-popover-title="Share" data-popover-lifecycle="Copy URL · as iframe · as Web Component"><svg viewBox="0 0 448 512" class="share-icon" aria-hidden="true" focusable="false"><path fill="currentColor" d="M352 320c-22.608 0-43.387 7.819-59.79 20.895l-102.486-64.054a96.551 96.551 0 0 0 0-41.683l102.486-64.054C308.613 184.181 329.392 192 352 192c53.019 0 96-42.981 96-96S405.019 0 352 0s-96 42.981-96 96c0 7.158.79 14.13 2.276 20.841L155.79 180.895C139.387 167.819 118.608 160 96 160c-53.019 0-96 42.981-96 96s42.981 96 96 96c22.608 0 43.387-7.819 59.79-20.895l102.486 64.054A96.301 96.301 0 0 0 256 416c0 53.019 42.981 96 96 96s96-42.981 96-96-42.981-96-96-96z"/></svg></button>
  </div>
  <div class="grid-and-table">
    <div class="grid-scroll">
      <svg id="matrix" xmlns="http://www.w3.org/2000/svg"></svg>
    </div>
    <div class="table-scroll" id="paths-panel" hidden="">
      <table class="paths-table" id="paths-table">
        <caption id="paths-caption"></caption>
        <thead>
          <tr><th>Weight</th><th>Segments</th><th>Risk</th></tr>
        </thead>
        <tbody id="paths-tbody"></tbody>
      </table>
      <p class="hint" id="no-path-msg" hidden=""></p>
      <p class="hint" id="journey-note" hidden=""></p>
    </div>
  </div>
</section>
`;

function resolveUrl(attr, base) {
  if (attr) return new URL(attr, document.baseURI).href;
  return new URL(base, import.meta.url).href;
}

export class RubyRailsMatrix extends HTMLElement {
  static get observedAttributes() { return ["theme"]; }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._booted = false;
    this._mql = null;
  }

  connectedCallback() {
    if (this._booted) return;
    this._booted = true;
    const root = this.shadowRoot;
    root.innerHTML = CARD_HTML;
    this._applyTheme();

    if (window.matchMedia) {
      this._mql = window.matchMedia("(prefers-color-scheme: dark)");
      this._mql.addEventListener("change", () => this._applyTheme());
    }

    const stylesUrl = resolveUrl(this.getAttribute("data-styles"), "./styles.css");
    const dataUrl = resolveUrl(this.getAttribute("data-src"), "./data.json");

    const styles = fetch(stylesUrl)
      .then((r) => r.text())
      .then((css) => {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(css);
        root.adoptedStyleSheets = [sheet];
      })
      .catch(() => {});

    const data = fetch(dataUrl, { cache: "no-cache" })
      .then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });

    Promise.all([styles, data])
      .then(([, data]) => {
        const urlSync = this.getAttribute("data-urlsync") === "true";
        createApp(data, root, {
          urlSync: urlSync,
          // In a full-page site, restore from the URL fragment and keep it in
          // sync. In embedded mode (urlSync false), optionally restore from
          // the fragment too via data-fragment.
          initialFromHash: this.getAttribute("data-fragment") === "true" || urlSync,
          initial: this._initialFromData(data),
          copyLinkBase: this._canonicalBase()
        });
      })
      .catch((err) => {
        console.error("Ruby × Rails Matrix widget: " + err.message);
      });
  }

  disconnectedCallback() {
    if (this._mql) this._mql.removeEventListener("change", () => this._applyTheme());
  }

  attributeChangedCallback() {
    this._applyTheme();
  }

  _applyTheme() {
    const theme = (this.getAttribute("theme") || "auto").toLowerCase();
    const dark = theme === "dark" ||
      (theme === "auto" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
    const vars = dark ? DARK_VARS : LIGHT_VARS;
    for (const k in vars) this.style.setProperty(k, vars[k]);
  }

  _canonicalBase() {
    // data-canonical-src wins; else resolve index.html next to this script.
    const attr = this.getAttribute("data-canonical-src");
    if (attr) return new URL(attr, document.baseURI).href;
    return new URL("./index.html", import.meta.url).href;
  }

  _initialFromData(data) {
    const parse = (attr) => {
      const s = (this.getAttribute(attr) || "").trim();
      if (!s) return null;
      const [r, y] = s.split("|");
      return { rails: r, ruby: y };
    };
    const home = parse("home");
    const target = parse("target");
    if (!home || !target) return null;
    const railsIdx = (v) => data.rails_versions.findIndex((o) => o.version === v);
    const rubyIdx = (v) => data.ruby_versions.findIndex((o) => o.version === v);
    const hi = railsIdx(home.rails), hj = rubyIdx(home.ruby);
    const ti = railsIdx(target.rails), tj = rubyIdx(target.ruby);
    if (hi < 0 || hj < 0 || ti < 0 || tj < 0) return null;
    return { home: { i: hi, j: hj }, target: { i: ti, j: tj } };
  }
}

if (!customElements.get("ruby-rails-matrix")) {
  customElements.define("ruby-rails-matrix", RubyRailsMatrix);
}
