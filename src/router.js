// Pure path mathematics: cell lookup, weights, k-shortest-paths, legs, risk.
// No DOM access — kept separate from rendering so it is testable in Node.
export class Router {
  constructor({ railsVersions, rubyVersions, cells, weights, turnPenalty, maxPaths }) {
    this.railsVersions = railsVersions;
    this.rubyVersions = rubyVersions;
    this.cells = cells;
    this.weights = weights;
    this.turnPenalty = turnPenalty;
    this.maxPaths = maxPaths;
  }

  get cols() { return this.railsVersions.length; }
  get rows() { return this.rubyVersions.length; }

  cellKey(i, j) {
    return this.railsVersions[i] + "|" + this.rubyVersions[j];
  }

  cellAt(i, j) {
    return this.cells[this.cellKey(i, j)] || {};
  }

  isRed(i, j) {
    return this.cellAt(i, j).status === "red";
  }

  cellWeight(i, j) {
    const cellData = this.cellAt(i, j);
    const status = cellData.status || "gray";
    const w = this.weights;
    if (status === "gray") return w.gray;
    if (status === "blue") return w.blue;
    return cellData.confidence === "confirmed" ? w.green : w.greenInferred;
  }

  // Nearest non-red cell to (i0, j0), searching outward ring by ring.
  findNearestAllowed(i0, j0) {
    if (!this.isRed(i0, j0)) return { i: i0, j: j0 };
    const maxR = Math.max(this.cols, this.rows);
    for (let r = 1; r <= maxR; r++) {
      for (let di = -r; di <= r; di++) {
        for (let dj = -r; dj <= r; dj++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
          const i = i0 + di, j = j0 + dj;
          if (i < 0 || i >= this.cols || j < 0 || j >= this.rows) continue;
          if (!this.isRed(i, j)) return { i: i, j: j };
        }
      }
    }
    return { i: i0, j: j0 };
  }

  // Up to K cheapest loop-free Manhattan paths from home to target.
  // Movement is monotone toward target on each axis (never backtracks),
  // each unit step costs the destination cell's weight, plus 1 whenever
  // the step's axis differs from the previous step's axis.
  computeKShortestPaths(home, target) {
    const K = this.maxPaths;
    const dirI = Math.sign(target.i - home.i);
    const dirJ = Math.sign(target.j - home.j);
    const results = [];
    const visitCount = {};
    const frontier = [{ i: home.i, j: home.j, lastAxis: null, cost: 0, parent: null }];

    while (frontier.length && results.length < K) {
      let bestIdx = 0;
      for (let k = 1; k < frontier.length; k++) {
        if (frontier[k].cost < frontier[bestIdx].cost) bestIdx = k;
      }
      const cur = frontier.splice(bestIdx, 1)[0];

      const key = cur.i + "," + cur.j + "," + cur.lastAxis;
      visitCount[key] = (visitCount[key] || 0) + 1;
      if (visitCount[key] > K) continue;

      if (cur.i === target.i && cur.j === target.j) {
        results.push(this.reconstructPath(cur));
        continue;
      }

      if (dirI !== 0 && cur.i !== target.i) {
        const ni = cur.i + dirI;
        if (!this.isRed(ni, cur.j)) {
          const turnR = cur.lastAxis && cur.lastAxis !== "rails" ? this.turnPenalty : 0;
          frontier.push({
            i: ni, j: cur.j, lastAxis: "rails",
            cost: cur.cost + this.cellWeight(ni, cur.j) + turnR,
            parent: cur
          });
        }
      }
      if (dirJ !== 0 && cur.j !== target.j) {
        const nj = cur.j + dirJ;
        if (!this.isRed(cur.i, nj)) {
          const turnB = cur.lastAxis && cur.lastAxis !== "ruby" ? this.turnPenalty : 0;
          frontier.push({
            i: cur.i, j: nj, lastAxis: "ruby",
            cost: cur.cost + this.cellWeight(cur.i, nj) + turnB,
            parent: cur
          });
        }
      }
    }
    return results;
  }

  reconstructPath(node) {
    const cells = [];
    for (let n = node; n; n = n.parent) cells.unshift({ i: n.i, j: n.j });
    return { cost: node.cost, cells: cells };
  }

  // Merge consecutive same-axis unit steps into legs, for the route summary
  // and for drawing (bend points only, not every intermediate cell).
  pathLegs(cells) {
    const legs = [];
    for (let k = 1; k < cells.length; k++) {
      const axis = cells[k].i !== cells[k - 1].i ? "rails" : "ruby";
      const idx = axis === "rails" ? cells[k].i : cells[k].j;
      const last = legs[legs.length - 1];
      if (last && last.axis === axis) {
        last.toIdx = idx;
      } else {
        legs.push({ axis: axis, fromIdx: axis === "rails" ? cells[k - 1].i : cells[k - 1].j, toIdx: idx });
      }
    }
    return legs;
  }

  legLabel(leg) {
    const versions = leg.axis === "rails" ? this.railsVersions : this.rubyVersions;
    const icon = leg.axis === "rails" ? "🛤️" : "💎";
    return icon + " " + versions[leg.fromIdx] + "→" + versions[leg.toIdx];
  }

  routeSummary(cells) {
    return this.pathLegs(cells).map((leg) => this.legLabel(leg)).join("\n");
  }

  // Two distinct kinds of risk along a route: cells that are blue/gray
  // (unsupported-but-works, or unknown) vs. green cells that are only an
  // inferred pairing (dashed border in the grid) rather than a confirmed one.
  riskCounts(pathCells) {
    let unsupported = 0, uncertain = 0;
    for (let k = 1; k < pathCells.length; k++) {
      const i = pathCells[k].i, j = pathCells[k].j;
      const cellData = this.cellAt(i, j);
      const status = cellData.status || "gray";
      if (status === "blue" || status === "gray") unsupported++;
      else if (status === "green" && cellData.confidence !== "confirmed") uncertain++;
    }
    return { unsupported: unsupported, uncertain: uncertain };
  }

  formatWeight(w) {
    return (Math.round(w * 10) / 10).toString();
  }
}