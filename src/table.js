// Renders the journeys table. Route math (legs, risk, weights) lives on the
// Router; native-title tooltips are replaced by the popover.
export class PathsTable {
  constructor({ tbody, caption, router, popover }) {
    this.tbody = tbody;
    this.caption = caption;
    this.router = router;
    this.popover = popover;
  }

  render(paths, onSelect) {
    const tbody = this.tbody;
    tbody.innerHTML = "";

    if (this.caption) {
      const total = paths[0] ? paths[0].cells.length - 1 : 0;
      this.caption.textContent = total + " total hops";
    }

    paths.forEach((p, idx) => {
      const risk = this.router.riskCounts(p.cells);
      const segments = this.router.pathLegs(p.cells).length;

      const tr = document.createElement("tr");

      const weightTd = document.createElement("td");
      weightTd.className = "tabular";
      weightTd.textContent = this.router.formatWeight(p.cost);
      tr.appendChild(weightTd);

      const segTd = document.createElement("td");
      segTd.className = "tabular segments";
      segTd.textContent = String(segments);
      tr.appendChild(segTd);

      const riskTd = document.createElement("td");
      riskTd.className = "risk";
      tr.appendChild(riskTd);

      const badges = [];
      if (risk.unsupported === 0 && risk.uncertain === 0) {
        const z = document.createElement("span");
        z.className = "risk-badge zero";
        z.textContent = "—";
        badges.push(z);
      } else {
        if (risk.unsupported > 0) {
          const b = document.createElement("span");
          b.className = "risk-badge unsupported";
          b.textContent = "⚠ " + risk.unsupported;
          badges.push(b);
        }
        if (risk.uncertain > 0) {
          const b = document.createElement("span");
          b.className = "risk-badge uncertain";
          b.textContent = "◌ " + risk.uncertain;
          badges.push(b);
        }
      }
      for (const b of badges) riskTd.appendChild(b);

      tr.addEventListener("click", function () { onSelect(idx); });

      // Segments popover: full stop-by-stop route.
      const routeTitle = this.router.routeSummary(p.cells);
      this.popover.wire(segTd, () => this.routePopover(routeTitle));

      // Risk badge popovers.
      badges.forEach((b) => {
        let text = b.textContent.trim();
        this.popover.wire(b, () => {
          const n = document.createElement("div");
          n.className = "popover-title";
          if (text.indexOf("⚠") === 0) n.textContent = "Unsupported cells crossed (blue/gray): " + text.slice(1).trim();
          else if (text.indexOf("◌") === 0) n.textContent = "Inferred (dashed) green cells crossed: " + text.slice(1).trim();
          else n.textContent = "No risk cells crossed.";
          return n;
        });
      });

      tbody.appendChild(tr);
    });
  }

  routePopover(summary) {
    const node = document.createElement("div");
    const title = document.createElement("div");
    title.className = "popover-title";
    title.textContent = "Stop-by-stop route";
    node.appendChild(title);
    const list = document.createElement("ul");
    list.className = "popover-route";
    summary.split("\n").forEach((leg) => {
      const li = document.createElement("li");
      li.textContent = leg;
      list.appendChild(li);
    });
    node.appendChild(list);
    return node;
  }

  select(idx) {
    const rows = this.tbody.querySelectorAll("tr");
    rows.forEach((r, i) => { r.classList.toggle("selected", i === idx); });
  }
}