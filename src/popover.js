const SHOW_DELAY = 250;
const HIDE_DELAY = 150;
const GAP = 8;

// A single floating popover, position:fixed relative to the viewport.
// Anchored to any element (SVG g, td, span) via getBoundingClientRect.
// Opens on hover/focus; closes on leave/blur/Esc/scroll/pointerdown.
export class Popover {
  constructor(root) {
    this.root = root;          // document or a shadowRoot
    this.el = null;
    this.anchor = null;
    this.visible = false;
    this.showTimer = null;
    this.hideTimer = null;
    this.hideOnScroll = null;
  }

  _ensure() {
    if (this.el) return this.el;
    const doc = this.root.ownerDocument || document;
    this.el = doc.createElement("div");
    this.el.className = "popover";
    this.el.setAttribute("role", "tooltip");
    this.el.hidden = true;
    // In a shadow root, append to the root; otherwise to document.body.
    const host = this.root.nodeType === 11 ? this.root : doc.body;
    host.appendChild(this.el);

    doc.addEventListener("keydown", (e) => { if (e.key === "Escape") this.hide(); });
    // Close on any pointer press outside the popover itself (capture so it
    // beats stopPropagation on draggable markers); clicks inside the popover
    // (e.g. links) must not dismiss it.
    doc.addEventListener("pointerdown", (e) => {
      // Clicks inside the popover (e.g. links) must not dismiss it. Use
      // composedPath() — not e.target — because for events inside a shadow
      // root, document-level listeners see the retargeted host element, so
      // e.target wouldn't match a popover placed within the shadow tree.
      const path = e.composedPath ? e.composedPath() : (e.target ? [e.target] : []);
      if (this.el && path.indexOf(this.el) !== -1) return;
      this.hide();
    }, true);
    this.hideOnScroll = () => this.hide("scroll");
    doc.addEventListener("scroll", this.hideOnScroll, true);
    doc.addEventListener("resize", this.hideOnScroll);
    return this.el;
  }

  // attach hover/focus behavior to an anchor; getHtml() is called lazily on open.
  wire(anchor, getHtml) {
    if (!anchor || anchor.__popoverWired) return;
    anchor.__popoverWired = true;

    const show = () => {
      this._ensure();
      clearTimeout(this.hideTimer);
      clearTimeout(this.showTimer);
      this.showTimer = setTimeout(() => this.show(anchor, getHtml()), SHOW_DELAY);
    };
    const hide = () => {
      clearTimeout(this.showTimer);
      this.hideTimer = setTimeout(() => this.hide(), HIDE_DELAY);
    };

    anchor.addEventListener("pointerenter", show);
    anchor.addEventListener("pointerleave", hide);
    anchor.addEventListener("focusin", show);
    anchor.addEventListener("focusout", hide);
    anchor.addEventListener("pointerdown", () => this.hide());

    // Moving from the anchor onto the popover itself must keep it open:
    // entering the popover cancels the pending hide; leaving it schedules one.
    if (!this._popoverHoverWired) {
      this._popoverHoverWired = true;
      const el = this._ensure();
      el.addEventListener("pointerenter", () => clearTimeout(this.hideTimer));
      el.addEventListener("pointerleave", () => {
        clearTimeout(this.showTimer);
        this.hideTimer = setTimeout(() => this.hide(), HIDE_DELAY);
      });
    }
  }

  show(anchor, content) {
    clearTimeout(this.hideTimer);
    this.anchor = anchor;
    this.el.hidden = false;
    this.el.innerHTML = "";
    if (typeof content === "string") this.el.innerHTML = content;
    else if (content && content.nodeType === 1) this.el.appendChild(content);
    this.visible = true;
    this._position();
  }

  hide() {
    clearTimeout(this.showTimer);
    if (!this.visible) return;
    this.visible = false;
    this.el.hidden = true;
    this.el.innerHTML = "";
    this.anchor = null;
  }

  _position() {
    const r = this.anchor.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    const w = this.el.offsetWidth, h = this.el.offsetHeight;
    let left = r.left;
    let top = r.bottom + GAP;
    if (left + w > vw - GAP) left = Math.max(GAP, vw - GAP - w);
    if (r.bottom + GAP + h > vh - GAP) top = Math.max(GAP, r.top - h - GAP);
    this.el.style.left = left + "px";
    this.el.style.top = top + "px";
  }
}