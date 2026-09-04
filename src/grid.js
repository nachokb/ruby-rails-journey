const svgNS = "http://www.w3.org/2000/svg";

const glyphs = { green: "✓", blue: "~", red: "✗", gray: "?" };
// [confirmed fill, inferred (softer) fill, glyph/border ink]
const colorVar = {
  green: ["var(--sem-green-bg)", "var(--sem-green-bg-soft)", "var(--sem-green)"],
  blue:  ["var(--sem-blue-bg)",  "var(--sem-blue-bg-soft)",  "var(--sem-blue)"],
  red:   ["var(--sem-red-bg)",   "var(--sem-red-bg-soft)",   "var(--sem-red)"],
  gray:  ["var(--sem-gray-bg)",  "var(--sem-gray-bg-soft)",  "var(--sem-gray)"]
};

// Renders the SVG matrix (axes, cells), the draggable Home/Target pins, and
// the drawn upgrade path (with optional current-step dimming). Emits user
// intent through `onCellClick` / `onPinUpdate`; `makePopover(anchor, i, j)`
// returns the popover content node for a cell.
export class Grid {
  constructor({ svg, railsVersions, rubyVersions, notes, router, popover, onCellClick, onPinUpdate, makeCellPopover, isBothEol, axisPopover }) {
    this.svg = svg;
    this.railsVersions = railsVersions;
    this.rubyVersions = rubyVersions;
    this.notes = notes;
    this.router = router;
    this.popover = popover;
    this.onCellClick = onCellClick;
    this.onPinUpdate = onPinUpdate;
    this.makeCellPopover = makeCellPopover;
    this.isBothEol = isBothEol || (() => false);
    this.axisPopover = axisPopover || null;

    this.cell = 32;
    this.leftGutter = 56;
    this.topGutter = 74;

    const width = this.leftGutter + this.cols * this.cell + 4;
    const height = this.topGutter + this.rows * this.cell + 4;
    svg.setAttribute("viewBox", "0 0 " + width + " " + height);
    svg.setAttribute("width", width);
    svg.setAttribute("height", height);

    this.buildEolPattern();
    this.buildAxes();
    this.buildCells();

    // Layers append after the cells so paths/markers paint on top of them.
    this.pathLayer = this.make("g", { id: "path-layer" });
    svg.appendChild(this.pathLayer);
    this.markersLayer = this.make("g", { id: "markers-layer" });
    svg.appendChild(this.markersLayer);

    this.homeMarker = this.buildMarker("home", "var(--home-color)");
    this.targetMarker = this.buildMarker("target", "var(--target-color)");

    // Delegated overlay hover: any element carrying data-overlay shows the
    // underlying cell's popover tagged with the overlay role. Survives redraws.
    // Ignored while a marker is being dragged so the popover can't get in the way.
    this.draggingOverlay = false;
    svg.addEventListener("pointerover", (evt) => {
      if (this.draggingOverlay) return;
      const t = evt.target && evt.target.closest ? evt.target.closest("[data-overlay]") : null;
      if (!t) return;
      const role = t.getAttribute("data-overlay");
      const cell = this.overlayCell(role, evt);
      if (cell) {
        this.popover.show(
          this.cellGroups[cell.i][cell.j],
          this.makeCellPopover(cell.i, cell.j, this.overlayBadge(role))
        );
      }
    });
  }

  buildEolPattern() {
    const defs = this.make("defs", {});
    const pat = this.make("pattern", {
      id: "eol-hatch",
      width: 6, height: 6,
      "patternUnits": "userSpaceOnUse"
    });
    // Two short segments per tile forming 45° stripes; matches the legend
    // swatch's repeating-linear-gradient(45deg) direction (y-down coords).
    const line = this.make("line", {
      x1: 0, y1: 6, x2: 6, y2: 0,
      stroke: "var(--ink-faint)",
      "stroke-width": 1,
      "stroke-opacity": 0.5
    });
    pat.appendChild(line);
    defs.appendChild(pat);
    this.svg.appendChild(defs);
  }

  get cols() { return this.railsVersions.length; }
  get rows() { return this.rubyVersions.length; }

  make(tag, attrs) {
    const el = document.createElementNS(svgNS, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }

  cellCenter(i, j, offset) {
    return {
      x: this.leftGutter + i * this.cell + this.cell / 2 + (offset || 0),
      y: this.topGutter + j * this.cell + this.cell / 2
    };
  }

  clientToSvgPoint(evt) {
    const pt = this.svg.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    return pt.matrixTransform(this.svg.getScreenCTM().inverse());
  }

  nearestCell(pt) {
    let i = Math.round((pt.x - this.leftGutter - this.cell / 2) / this.cell);
    let j = Math.round((pt.y - this.topGutter - this.cell / 2) / this.cell);
    i = Math.max(0, Math.min(this.cols - 1, i));
    j = Math.max(0, Math.min(this.rows - 1, j));
    return { i: i, j: j };
  }

  buildAxes() {
    // Column headers (Rails versions), rotated
    const axisTitleRails = this.make("text", {
      x: this.leftGutter + (this.cols * this.cell) / 2,
      y: 16,
      "text-anchor": "middle",
      class: "axis-title"
    });
    axisTitleRails.textContent = "Rails version";
    this.svg.appendChild(axisTitleRails);

    this.railsVersions.forEach((rv, i) => {
      const x = this.leftGutter + i * this.cell + this.cell / 2;
      const t = this.make("text", {
        x: x,
        y: this.topGutter - 10,
        "text-anchor": "start",
        class: "axis-label",
        transform: "rotate(-55 " + x + " " + (this.topGutter - 10) + ")"
      });
      t.textContent = rv;
      this.svg.appendChild(t);
      if (this.axisPopover) this.popover.wire(t, () => this.axisPopover("rails", i));
    });

    // Row headers (Ruby versions)
    const axisTitleRuby = this.make("text", {
      x: 14,
      y: this.topGutter + (this.rows * this.cell) / 2,
      "text-anchor": "middle",
      class: "axis-title",
      transform: "rotate(-90 14 " + (this.topGutter + (this.rows * this.cell) / 2) + ")"
    });
    axisTitleRuby.textContent = "Ruby version";
    this.svg.appendChild(axisTitleRuby);

    this.rubyVersions.forEach((ruv, j) => {
      const y = this.topGutter + j * this.cell + this.cell / 2;
      const t = this.make("text", {
        x: this.leftGutter - 10,
        y: y + 4,
        "text-anchor": "end",
        class: "axis-label"
      });
      t.textContent = ruv;
      this.svg.appendChild(t);
      if (this.axisPopover) this.popover.wire(t, () => this.axisPopover("ruby", j));
    });
  }

  buildCells() {
    const inset = 1.5;
    this.cellGroups = [];
    this.railsVersions.forEach((rv, i) => {
      this.cellGroups[i] = [];
      this.rubyVersions.forEach((ruv, j) => {
        const resolved = this.notes.resolveCell(rv, ruv);
        const status = resolved.status;
        const conf = resolved.confidence;
        const x = this.leftGutter + i * this.cell;
        const y = this.topGutter + j * this.cell;
        const colors = colorVar[status];
        const isConfirmed = conf === "confirmed";

        const g = this.make("g", { class: "cell-group", tabindex: 0 });
        this.cellGroups[i][j] = g;
        g._i = i; g._j = j;

        const rect = this.make("rect", {
          x: x + inset, y: y + inset, width: this.cell - inset * 2, height: this.cell - inset * 2,
          rx: 3,
          fill: isConfirmed ? colors[0] : colors[1],
          class: "cell-rect"
        });

        const label = this.make("text", {
          x: x + this.cell / 2, y: y + this.cell / 2 + 4,
          "text-anchor": "middle",
          class: "cell-label",
          fill: colors[2]
        });
        label.textContent = glyphs[status];

        g.appendChild(rect);
        g.appendChild(label);

        // Both EOL: diagonal hatch overlay on green/blue cells only.
        if ((status === "green" || status === "blue") && this.isBothEol(i, j)) {
          const hatch = this.make("rect", {
            x: x + inset, y: y + inset, width: this.cell - inset * 2, height: this.cell - inset * 2,
            rx: 3,
            fill: "url(#eol-hatch)",
            class: "cell-hatch",
            "pointer-events": "none"
          });
          g.appendChild(hatch);
        }

        if (!isConfirmed) {
          const border = this.make("rect", {
            x: x + inset, y: y + inset, width: this.cell - inset * 2, height: this.cell - inset * 2,
            rx: 3,
            stroke: colors[2],
            "stroke-opacity": 0.55,
            "stroke-width": 1.25,
            "stroke-dasharray": "2.5 2",
            class: "cell-border"
          });
          g.appendChild(border);
        }

        g.addEventListener("click", () => this.onCellClick(i, j));
        g.setAttribute("aria-label", "Rails " + rv + " + Ruby " + ruv);
        this.popover.wire(g, () => this.makeCellPopover(i, j));

        this.svg.appendChild(g);
      });
    });
  }

  buildMarker(role, color) {
    const g = this.make("g", { class: "marker", "data-role": role, "data-overlay": role, tabindex: 0 });
    const halo = this.make("circle", { r: 10, class: "marker-halo" });
    const body = this.make("circle", { r: 8.5, fill: color, class: "marker-body" });
    const label = this.make("text", { y: 4, class: "marker-label" });
    label.textContent = role === "home" ? "H" : "T";
    g.appendChild(halo);
    g.appendChild(body);
    g.appendChild(label);

    g.addEventListener("pointerdown", (evt) => {
      evt.stopPropagation();
      this.draggingOverlay = true;
      this.popover.hide();
      g.setPointerCapture(evt.pointerId);
      g.classList.add("dragging");

      const onMove = (moveEvt) => {
        const pt = this.clientToSvgPoint(moveEvt);
        g.setAttribute("transform", "translate(" + pt.x + "," + pt.y + ")");
      };
      const onUp = (upEvt) => {
        const pt = this.clientToSvgPoint(upEvt);
        const snapped = this.nearestCell(pt);
        const target = this.router.isRed(snapped.i, snapped.j) ? null : snapped;
        // if the drop cell is red, `target` stays null and the app keeps the
        // last valid state; renderMarkers() snaps the pin back to it.
        g.classList.remove("dragging");
        this.draggingOverlay = false;
        g.removeEventListener("pointermove", onMove);
        g.removeEventListener("pointerup", onUp);
        this.onPinUpdate(role, target);
      };

      g.addEventListener("pointermove", onMove);
      g.addEventListener("pointerup", onUp);
      g.addEventListener("pointercancel", function onCancel() {
        g.classList.remove("dragging");
        this.draggingOverlay = false;
        g.removeEventListener("pointermove", onMove);
        g.removeEventListener("pointerup", onUp);
        g.removeEventListener("pointercancel", onCancel);
      });
    });

    return g;
  }

  // Map an overlay element to the cell it should surface:
  // markers -> their pinned cell; path/line/hops/step -> cell under the cursor.
  overlayCell(role, evt) {
    if (role === "home") return { i: this.homeMarker._i, j: this.homeMarker._j };
    if (role === "target") return { i: this.targetMarker._i, j: this.targetMarker._j };
    // path / hops / step
    const pt = this.clientToSvgPoint(evt);
    return this.nearestCell(pt);
  }

  overlayBadge(role) {
    if (role === "home") return "HOME";
    if (role === "target") return "TARGET";
    if (role === "step") return "CURRENT";
    return "";
  }

  renderMarkers(state) {
    this.markersLayer.innerHTML = "";
    if (!state.home && !state.target) return;

    if (state.home) {
      const overlapH = state.target && state.target.i === state.home.i && state.target.j === state.home.j;
      const ch = this.cellCenter(state.home.i, state.home.j, overlapH ? -6 : 0);
      this.homeMarker._i = state.home.i;
      this.homeMarker._j = state.home.j;
      this.homeMarker.setAttribute("transform", "translate(" + ch.x + "," + ch.y + ")");
      this.markersLayer.appendChild(this.homeMarker);
    }
    if (state.target) {
      const overlapT = state.home && state.target.i === state.home.i && state.target.j === state.home.j;
      const ct = this.cellCenter(state.target.i, state.target.j, overlapT ? 6 : 0);
      this.targetMarker._i = state.target.i;
      this.targetMarker._j = state.target.j;
      this.targetMarker.setAttribute("transform", "translate(" + ct.x + "," + ct.y + ")");
      this.markersLayer.appendChild(this.targetMarker);
    }
  }

  // Draw a path. If `step` is given (index into cells), the reached part keeps
  // full opacity and the remaining part is dimmed, with a small step marker.
  drawPath(cells, step) {
    this.pathLayer.innerHTML = "";
    this.currentStepMarker = null;
    if (!cells || cells.length < 2) return;

    const bendCells = [cells[0]];
    for (let k = 1; k < cells.length - 1; k++) {
      const axisBefore = cells[k].i !== cells[k - 1].i ? "rails" : "ruby";
      const axisAfter = cells[k + 1].i !== cells[k].i ? "rails" : "ruby";
      if (axisBefore !== axisAfter) bendCells.push(cells[k]);
    }
    bendCells.push(cells[cells.length - 1]);

    const points = bendCells.map((c) => {
      const ctr = this.cellCenter(c.i, c.j);
      return ctr.x + "," + ctr.y;
    }).join(" ");
    this.pathLayer.appendChild(this.make("polyline", { points: points, class: "path-halo", "data-overlay": "path" }));
    const line = this.make("polyline", { points: points, class: "path-line", "data-overlay": "path" });
    this.pathLayer.appendChild(line);

    for (let m = 1; m < cells.length - 1; m++) {
      const ctr2 = this.cellCenter(cells[m].i, cells[m].j);
      const hop = this.make("circle", { cx: ctr2.x, cy: ctr2.y, r: 2.5, class: "path-hop", "data-overlay": "path" });
      if (step != null && m > step) hop.setAttribute("class", "path-hop path-hop-dim");
      this.pathLayer.appendChild(hop);
    }

    // Dim the un-reached portion of the polyline by overlaying a shorter line.
    if (step != null && step > 0 && step < cells.length - 1) {
      const reached = [cells[0]];
      for (let k = 1; k <= step; k++) reached.push(cells[k]);
      const bend2 = [reached[0]];
      for (let k = 1; k < reached.length - 1; k++) {
        const ab = reached[k].i !== reached[k - 1].i ? "rails" : "ruby";
        const aa = reached[k + 1].i !== reached[k].i ? "rails" : "ruby";
        if (ab !== aa) bend2.push(reached[k]);
      }
      bend2.push(reached[reached.length - 1]);
      const pts2 = bend2.map((c) => {
        const ctr = this.cellCenter(c.i, c.j);
        return ctr.x + "," + ctr.y;
      }).join(" ");
      this.pathLayer.appendChild(this.make("polyline", { points: pts2, class: "path-progress", "data-overlay": "path" }));

      const sc = this.cellCenter(cells[step].i, cells[step].j);
      const sm = this.make("circle", { cx: sc.x, cy: sc.y, r: 6, class: "path-step", "data-overlay": "step" });
      this.currentStepMarker = sm;
      this.pathLayer.appendChild(sm);
    }
  }

  clearPath() {
    this.pathLayer.innerHTML = "";
    this.currentStepMarker = null;
  }
}