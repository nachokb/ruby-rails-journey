import { build } from "esbuild";
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const dist = join(root, "dist");

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

// Widget bundle: ESM so `import.meta.url` survives and data/styles resolve
// relative to the published script URL. Both index.html and embed.html now
// host <ruby-rails-matrix> and load this bundle.
await build({
  entryPoints: [join(root, "src/widget.js")],
  bundle: true,
  format: "esm",
  target: ["es2020"],
  outfile: join(dist, "widget.js"),
  sourcemap: true
});

for (const name of ["index.html", "embed.html", "styles.css", "data.json", "favicon.svg"]) {
  copyFileSync(join(root, name), join(dist, name));
}

// Rewrite the script tag in both pages so dist doesn't need src/, and
// cache-bust the bundle so a stale widget.js can never linger in the browser.
const stamp = Date.now().toString(36);
for (const page of ["index.html", "embed.html"]) {
  const p = join(dist, page);
  let html = readFileSync(p, "utf-8");
  html = html.replace(
    '<script type="module" src="src/widget.js"></script>',
    '<script type="module" src="widget.js?v=' + stamp + '"></script>'
  );
  writeFileSync(p, html);
}

console.log("Built → dist/ (widget.js?v=" + stamp + ")");