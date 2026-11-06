"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => MermaidLiveSplitPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");

// src/split-extension.ts
var import_state = require("@codemirror/state");
var import_view = require("@codemirror/view");
var import_commands = require("@codemirror/commands");

// src/fences.ts
function findMermaidBlocks(text) {
  const blocks = [];
  let offset = 0;
  let fence;
  for (const line of text.split("\n")) {
    if (!fence) {
      const opening = /^( {0,3})(\x60{3,}|~{3,})([^\r]*)\r?$/.exec(line);
      if (opening) {
        fence = {
          marker: opening[2][0],
          length: opening[2].length,
          from: offset,
          codeFrom: offset + line.length + 1,
          mermaid: /^mermaid\s*$/i.test(opening[3].trim())
        };
      }
    } else {
      const closing = /^( {0,3})(\x60+|~+)[ \t]*\r?$/.exec(line);
      if (closing && closing[2][0] === fence.marker && closing[2].length >= fence.length) {
        if (fence.mermaid) {
          const codeFrom = Math.min(fence.codeFrom, offset);
          const codeTo = Math.max(codeFrom, offset - (text[offset - 2] === "\r" ? 2 : 1));
          blocks.push({
            from: fence.from,
            to: offset + line.length,
            codeFrom,
            codeTo,
            code: text.slice(codeFrom, codeTo)
          });
        }
        fence = void 0;
      }
    }
    offset += line.length + 1;
  }
  return blocks;
}

// src/resize.ts
function attachSplitResizing(root, measure) {
  const doc = root.ownerDocument;
  const divider = doc.createElement("div");
  divider.className = "mls-divider";
  divider.setAttribute("aria-label", "\u8C03\u6574\u6E90\u7801\u4E0E\u9884\u89C8\u5BBD\u5EA6");
  divider.title = "\u62D6\u52A8\u8C03\u6574\u5DE6\u53F3\u5BBD\u5EA6\uFF0C\u53CC\u51FB\u6062\u590D\u5747\u5206";
  const heightHandle = doc.createElement("div");
  heightHandle.className = "mls-height-handle";
  heightHandle.setAttribute("aria-label", "\u8C03\u6574\u53CC\u680F\u9AD8\u5EA6");
  heightHandle.title = "\u62D6\u52A8\u8C03\u6574\u9AD8\u5EA6\uFF0C\u53CC\u51FB\u6062\u590D\u9ED8\u8BA4\u9AD8\u5EA6";
  root.insertBefore(divider, root.children[1] ?? null);
  root.appendChild(heightHandle);
  for (const [handle, orientation] of [[divider, "vertical"], [heightHandle, "horizontal"]]) {
    handle.tabIndex = 0;
    handle.setAttribute("role", "separator");
    handle.setAttribute("aria-orientation", orientation);
  }
  divider.setAttribute("aria-valuemin", "20");
  divider.setAttribute("aria-valuemax", "80");
  heightHandle.setAttribute("aria-valuemin", "240");
  let percent = 50;
  let height = 440;
  let stopDrag;
  const setWidth = (value) => {
    percent = Math.max(20, Math.min(80, value));
    root.style.setProperty("--mls-source-fr", percent + "fr");
    root.style.setProperty("--mls-preview-fr", 100 - percent + "fr");
    divider.setAttribute("aria-valuenow", String(Math.round(percent)));
    measure();
  };
  const setHeight = (value) => {
    height = Math.max(240, Math.round(value));
    root.style.setProperty("--mls-height", height + "px");
    heightHandle.setAttribute("aria-valuenow", String(height));
    measure();
  };
  divider.setAttribute("aria-valuenow", String(percent));
  heightHandle.setAttribute("aria-valuenow", String(height));
  const bind = (handle, horizontal) => {
    const down = (event) => {
      if (event.button !== 0 || event.isPrimary === false) return;
      event.preventDefault();
      event.stopPropagation();
      stopDrag?.();
      const bounds = root.getBoundingClientRect();
      const start = horizontal ? event.clientX : event.clientY;
      const initial = horizontal ? percent : bounds.height || height;
      const move = (next) => {
        if (next.pointerId !== event.pointerId) return;
        next.preventDefault();
        const delta = (horizontal ? next.clientX : next.clientY) - start;
        if (horizontal) setWidth(initial + delta / Math.max(1, bounds.width) * 100);
        else setHeight(initial + delta);
      };
      const end = (next) => {
        if (next.pointerId === event.pointerId) stopDrag?.();
      };
      const blur = () => stopDrag?.();
      const className = horizontal ? "mls-resizing-columns" : "mls-resizing-height";
      root.classList.add(className);
      doc.addEventListener("pointermove", move);
      doc.addEventListener("pointerup", end);
      doc.addEventListener("pointercancel", end);
      handle.addEventListener("lostpointercapture", end);
      doc.defaultView?.addEventListener("blur", blur);
      stopDrag = () => {
        stopDrag = void 0;
        doc.removeEventListener("pointermove", move);
        doc.removeEventListener("pointerup", end);
        doc.removeEventListener("pointercancel", end);
        handle.removeEventListener("lostpointercapture", end);
        doc.defaultView?.removeEventListener("blur", blur);
        root.classList.remove(className);
        if (handle.hasPointerCapture?.(event.pointerId)) handle.releasePointerCapture(event.pointerId);
      };
      handle.setPointerCapture?.(event.pointerId);
    };
    const keydown = (event) => {
      const step = event.shiftKey ? 10 : 2;
      const delta = horizontal ? event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0 : event.key === "ArrowUp" ? -step * 8 : event.key === "ArrowDown" ? step * 8 : 0;
      if (!delta && event.key !== "Home" && !(horizontal && event.key === "End")) return;
      event.preventDefault();
      event.stopPropagation();
      if (horizontal) setWidth(event.key === "Home" ? 20 : event.key === "End" ? 80 : percent + delta);
      else setHeight(event.key === "Home" ? 240 : height + delta);
    };
    const reset = () => {
      if (horizontal) setWidth(50);
      else setHeight(440);
    };
    handle.addEventListener("pointerdown", down);
    handle.addEventListener("keydown", keydown);
    handle.addEventListener("dblclick", reset);
    return () => {
      handle.removeEventListener("pointerdown", down);
      handle.removeEventListener("keydown", keydown);
      handle.removeEventListener("dblclick", reset);
      handle.remove();
    };
  };
  const unbindWidth = bind(divider, true);
  const unbindHeight = bind(heightHandle, false);
  return () => {
    stopDrag?.();
    unbindWidth();
    unbindHeight();
  };
}

// src/split-extension.ts
var fromHost = import_state.Annotation.define();
var SplitWidget = class extends import_view.WidgetType {
  constructor(block, options) {
    super();
    this.block = block;
    this.options = options;
  }
  eq(other) {
    return this.block.from === other.block.from && this.block.to === other.block.to && this.block.code === other.block.code;
  }
  toDOM(host) {
    const root = host.dom.ownerDocument.createElement("div");
    root.className = "mermaid-live-split";
    const controller = new SplitController(root, host, this.block, this.options);
    controllers.set(root, controller);
    return root;
  }
  updateDOM(dom) {
    const controller = controllers.get(dom);
    if (!controller) return false;
    controller.sync(this.block);
    return true;
  }
  destroy(dom) {
    controllers.get(dom)?.destroy();
    controllers.delete(dom);
  }
  ignoreEvent() {
    return true;
  }
};
var controllers = /* @__PURE__ */ new WeakMap();
var SplitController = class {
  constructor(root, host, block, options) {
    this.root = root;
    this.host = host;
    this.block = block;
    this.options = options;
    const source = root.appendChild(root.ownerDocument.createElement("section"));
    source.className = "mls-source";
    const label = source.appendChild(root.ownerDocument.createElement("div"));
    label.className = "mls-label";
    label.textContent = "Mermaid \u6E90\u7801";
    const right = root.appendChild(root.ownerDocument.createElement("section"));
    right.className = "mls-right";
    this.status = right.appendChild(root.ownerDocument.createElement("div"));
    this.status.className = "mls-label";
    this.status.textContent = "\u5B9E\u65F6\u9884\u89C8";
    this.preview = right.appendChild(root.ownerDocument.createElement("div"));
    this.preview.className = "mls-preview";
    this.preview.setAttribute("aria-label", "Mermaid \u56FE\u8868\u9884\u89C8");
    this.editor = new import_view.EditorView({
      parent: source,
      root: host.dom.ownerDocument,
      state: import_state.EditorState.create({ doc: block.code, extensions: [
        (0, import_view.lineNumbers)(),
        import_view.EditorView.lineWrapping,
        import_view.EditorView.contentAttributes.of({ "aria-label": "Mermaid \u6E90\u7801\u7F16\u8F91\u5668", spellcheck: "false" }),
        import_view.keymap.of([
          { key: "Mod-z", run: () => (0, import_commands.undo)(this.host) },
          { key: "Mod-Shift-z", run: () => (0, import_commands.redo)(this.host) },
          { key: "Mod-y", run: () => (0, import_commands.redo)(this.host) },
          { key: "Escape", run: () => {
            this.leave(false);
            return true;
          } },
          { key: "ArrowUp", run: (v) => v.state.selection.main.empty && v.state.selection.main.head === 0 ? (this.leave(true), true) : false },
          { key: "ArrowDown", run: (v) => v.state.selection.main.empty && v.state.selection.main.head === v.state.doc.length ? (this.leave(false), true) : false },
          import_commands.indentWithTab,
          ...import_commands.defaultKeymap
        ]),
        import_view.EditorView.updateListener.of((update) => {
          if (!update.docChanged || update.transactions.some((tr) => tr.annotation(fromHost))) return;
          const changes = [];
          update.changes.iterChanges((from, to, _a, _b, inserted) => {
            changes.push({ from: this.block.codeFrom + from, to: this.block.codeFrom + to, insert: inserted.toString() });
          });
          if (this.block.codeFrom === this.block.codeTo && this.block.codeFrom === this.host.state.doc.lineAt(this.block.to).from) {
            const last = changes[changes.length - 1];
            if (last) last.insert += "\n";
          }
          this.syncing = true;
          try {
            this.host.dispatch({ changes, annotations: import_state.Transaction.userEvent.of("input.type") });
          } finally {
            this.syncing = false;
          }
          this.schedule();
        })
      ] })
    });
    for (const name of ["keydown", "keyup", "beforeinput", "input", "compositionstart", "compositionupdate", "compositionend", "paste", "copy", "cut"]) {
      root.addEventListener(name, (event) => event.stopPropagation());
    }
    this.disposeResizing = attachSplitResizing(root, () => {
      this.editor.requestMeasure();
      this.host.requestMeasure();
    });
    this.schedule();
  }
  editor;
  preview;
  status;
  timer;
  version = 0;
  cleanup;
  dead = false;
  syncing = false;
  disposeResizing;
  leave(before) {
    const pos = before ? Math.max(0, this.block.from - 1) : Math.min(this.host.state.doc.length, this.block.to + 1);
    this.host.dispatch({ selection: { anchor: pos }, scrollIntoView: true });
    this.host.focus();
  }
  sync(block) {
    this.block = block;
    if (!this.syncing && this.editor.state.doc.toString() !== block.code) {
      this.editor.dispatch({ changes: { from: 0, to: this.editor.state.doc.length, insert: block.code }, annotations: fromHost.of(true) });
      this.schedule();
    }
  }
  schedule() {
    clearTimeout(this.timer);
    const version = ++this.version;
    this.status.textContent = "\u5B9E\u65F6\u9884\u89C8 \xB7 \u66F4\u65B0\u4E2D";
    this.timer = setTimeout(() => {
      void this.render(version);
    }, 250);
  }
  async render(version) {
    const stage = this.root.ownerDocument.createElement("div");
    stage.className = "mls-render";
    stage.style.cssText = "position:absolute;visibility:hidden;pointer-events:none;inset:0;";
    this.preview.appendChild(stage);
    try {
      const cleanup = await this.options.render(this.block.code, stage, this.host);
      if (this.dead || version !== this.version) {
        cleanup();
        stage.remove();
        return;
      }
      this.cleanup?.();
      this.cleanup = cleanup;
      stage.removeAttribute("style");
      this.preview.replaceChildren(stage);
      this.status.textContent = "\u5B9E\u65F6\u9884\u89C8";
      this.preview.classList.remove("mls-error");
    } catch (error) {
      stage.remove();
      if (this.dead || version !== this.version) return;
      this.cleanup?.();
      this.cleanup = void 0;
      const message = this.root.ownerDocument.createElement("pre");
      message.textContent = error instanceof Error ? error.message : String(error);
      this.preview.replaceChildren(message);
      this.preview.classList.add("mls-error");
      this.status.textContent = "\u8BED\u6CD5\u6709\u8BEF \xB7 \u4FEE\u6539\u540E\u81EA\u52A8\u91CD\u8BD5";
    }
    this.host.requestMeasure();
  }
  destroy() {
    this.dead = true;
    this.version++;
    clearTimeout(this.timer);
    this.disposeResizing();
    this.cleanup?.();
    this.editor.destroy();
  }
};
function splitExtension(options) {
  function decorate(state) {
    if (!options.isLivePreview(state)) return import_view.Decoration.none;
    return import_view.Decoration.set(findMermaidBlocks(state.doc.toString()).map((block) => import_view.Decoration.replace({ widget: new SplitWidget(block, options), block: true }).range(block.from, block.to)));
  }
  return import_state.Prec.highest(import_state.StateField.define({
    create: decorate,
    update(value, tr) {
      return tr.docChanged || options.isLivePreview(tr.startState) !== options.isLivePreview(tr.state) ? decorate(tr.state) : value;
    },
    provide: (field) => [import_view.EditorView.decorations.from(field), import_view.EditorView.atomicRanges.of((view) => view.state.field(field))]
  }));
}

// src/main.ts
var MermaidLiveSplitPlugin = class extends import_obsidian.Plugin {
  queue = Promise.resolve();
  onload() {
    this.registerEditorExtension(splitExtension({
      isLivePreview: (state) => state.field(import_obsidian.editorLivePreviewField, false) === true,
      render: (code, target, host) => {
        const sourcePath = host.state.field(import_obsidian.editorInfoField, false)?.file?.path ?? "";
        const task = this.queue.then(async () => {
          const child = this.addChild(new import_obsidian.MarkdownRenderChild(target));
          const cleanup = () => {
            this.removeChild(child);
            target.replaceChildren();
          };
          const fence = "~".repeat(Math.max(3, ...(code.match(/~+/g) ?? []).map((run) => run.length + 1)));
          target.classList.add("markdown-rendered");
          try {
            await import_obsidian.MarkdownRenderer.render(this.app, fence + "mermaid\n" + code + "\n" + fence, target, sourcePath, child);
          } catch (error) {
            cleanup();
            throw error;
          }
          return cleanup;
        });
        this.queue = task.catch(() => void 0);
        return task;
      }
    }));
  }
};
