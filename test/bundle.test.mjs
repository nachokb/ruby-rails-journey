import fs from "node:fs";
import { ROOT } from "./helpers.mjs";

// ---- dist pages load the widget bundle, not source modules ----
for (const page of ["index.html", "embed.html"]) {
  const html = fs.readFileSync(ROOT + "/dist/" + page, "utf-8");
  if (!/src="widget\.js(?:\?[^"]*)?"/.test(html)) throw new Error("dist/" + page + " should load widget.js");
  if (html.includes("src/app.js") || html.includes("src/site.js") || html.includes("src/") && html.includes("module")) {
    // src/ references are fine as data-src/data-styles, but module script must be the bundle
    if (/<script[^>]+src="src\/[^"]+"/.test(html)) throw new Error("dist/" + page + " has a source module script");
  }
}
console.log("dist/index.html + dist/embed.html load widget.js: OK");

// ---- widget bundle ----
const wcode = fs.readFileSync(ROOT + "/dist/widget.js", "utf-8");
if (!wcode.includes("customElements.define") || !wcode.includes("ruby-rails-matrix")) {
  throw new Error("widget bundle missing element registration");
}
if (!wcode.includes("import.meta.url")) {
  throw new Error("widget bundle must preserve import.meta.url for self-locating assets");
}
// The AI-Generated button lives in the widget now (single source), using the
// inline logo SVG + popover wiring.
if (!wcode.includes("logo-ai") || !wcode.includes("data-popover-text")) {
  throw new Error("widget bundle should contain the AI button (logo svg + popover wiring)");
}
console.log("widget bundle defines <ruby-rails-matrix>, self-locating, with AI button: OK");

console.log("\nBUNDLE: ALL PASS");