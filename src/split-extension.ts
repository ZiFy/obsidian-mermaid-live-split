import { Annotation, EditorState, Prec, StateField, Transaction, type Extension } from '@codemirror/state';
import { Decoration, EditorView, WidgetType, keymap, lineNumbers, type DecorationSet } from '@codemirror/view';
import { defaultKeymap, indentWithTab, redo, undo } from '@codemirror/commands';
import { findMermaidBlocks, type MermaidBlock } from './fences';
import { attachSplitResizing } from './resize';

export interface SplitOptions {
  isLivePreview: (state: EditorState) => boolean;
  render: (code: string, target: HTMLElement, host: EditorView) => Promise<() => void>;
}
const fromHost = Annotation.define<boolean>();

class SplitWidget extends WidgetType {
  constructor(readonly block: MermaidBlock, readonly options: SplitOptions) { super(); }
  eq(other: SplitWidget): boolean {
    return this.block.from === other.block.from && this.block.to === other.block.to && this.block.code === other.block.code;
  }
  toDOM(host: EditorView): HTMLElement {
    const root = host.dom.ownerDocument.createDocumentFragment().createEl('div');
    root.className = 'mermaid-live-split';
    const controller = new SplitController(root, host, this.block, this.options);
    controllers.set(root, controller);
    return root;
  }
  updateDOM(dom: HTMLElement): boolean {
    const controller = controllers.get(dom);
    if (!controller) return false;
    controller.sync(this.block);
    return true;
  }
  destroy(dom: HTMLElement): void { controllers.get(dom)?.destroy(); controllers.delete(dom); }
  ignoreEvent(): boolean { return true; }
}
const controllers = new WeakMap<HTMLElement, SplitController>();

class SplitController {
  private editor: EditorView;
  private preview: HTMLElement;
  private status: HTMLElement;
  private timer: number | undefined;
  private window: Window;
  private version = 0;
  private cleanup: (() => void) | undefined;
  private dead = false;
  private syncing = false;
  private disposeResizing: () => void;
  constructor(private root: HTMLElement, private host: EditorView, private block: MermaidBlock, private options: SplitOptions) {
    this.window = root.ownerDocument.defaultView ?? window;
    const source = root.createEl('section');
    source.className = 'mls-source';
    const label = source.createEl('div');
    label.className = 'mls-label';
    label.textContent = 'Mermaid 源码';
    const right = root.createEl('section');
    right.className = 'mls-right';
    this.status = right.createEl('div');
    this.status.className = 'mls-label';
    this.status.textContent = '实时预览';
    this.preview = right.createEl('div');
    this.preview.className = 'mls-preview';
    this.preview.setAttribute('aria-label', 'Mermaid 图表预览');
    this.editor = new EditorView({
      parent: source,
      root: host.dom.ownerDocument,
      state: EditorState.create({ doc: block.code, extensions: [
        lineNumbers(), EditorView.lineWrapping,
        EditorView.contentAttributes.of({ 'aria-label': 'Mermaid 源码编辑器', spellcheck: 'false' }),
        keymap.of([
          { key: 'Mod-z', run: () => undo(this.host) },
          { key: 'Mod-Shift-z', run: () => redo(this.host) },
          { key: 'Mod-y', run: () => redo(this.host) },
          { key: 'Escape', run: () => { this.leave(false); return true; } },
          { key: 'ArrowUp', run: v => v.state.selection.main.empty && v.state.selection.main.head === 0 ? (this.leave(true), true) : false },
          { key: 'ArrowDown', run: v => v.state.selection.main.empty && v.state.selection.main.head === v.state.doc.length ? (this.leave(false), true) : false },
          indentWithTab, ...defaultKeymap,
        ]),
        EditorView.updateListener.of(update => {
          if (!update.docChanged || update.transactions.some(tr => tr.annotation(fromHost))) return;
          // Send exact character changes into the host document and its undo history.
          const changes: { from: number; to: number; insert: string }[] = [];
          update.changes.iterChanges((from, to, _a, _b, inserted) => {
            changes.push({ from: this.block.codeFrom + from, to: this.block.codeFrom + to, insert: inserted.toString() });
          });
          // Preserve the separator before the closing marker of a truly empty fence.
          if (this.block.codeFrom === this.block.codeTo && this.block.codeFrom === this.host.state.doc.lineAt(this.block.to).from) {
            const last = changes[changes.length - 1];
            if (last) last.insert += '\n';
          }
          this.syncing = true;
          try {
            this.host.dispatch({ changes, annotations: Transaction.userEvent.of('input.type') });
          } finally { this.syncing = false; }
          this.schedule();
        }),
      ] }),
    });
    // Embedded editor owns these events; do not let the outer editor handle them twice.
    for (const name of ['keydown', 'keyup', 'beforeinput', 'input', 'compositionstart', 'compositionupdate', 'compositionend', 'paste', 'copy', 'cut']) {
      root.addEventListener(name, event => event.stopPropagation());
    }
    this.disposeResizing = attachSplitResizing(root, () => {
      this.editor.requestMeasure(); this.host.requestMeasure();
    });
    this.schedule();
  }
  private leave(before: boolean): void {
    const pos = before ? Math.max(0, this.block.from - 1) : Math.min(this.host.state.doc.length, this.block.to + 1);
    this.host.dispatch({ selection: { anchor: pos }, scrollIntoView: true });
    this.host.focus();
  }
  sync(block: MermaidBlock): void {
    this.block = block;
    if (!this.syncing && this.editor.state.doc.toString() !== block.code) {
      this.editor.dispatch({ changes: { from: 0, to: this.editor.state.doc.length, insert: block.code }, annotations: fromHost.of(true) });
      this.schedule();
    }
  }
  private schedule(): void {
    this.window.clearTimeout(this.timer);
    const version = ++this.version;
    this.status.textContent = '实时预览 · 更新中';
    this.timer = this.window.setTimeout(() => { void this.render(version); }, 250);
  }
  private async render(version: number): Promise<void> {
    const stage = this.preview.createEl('div');
    stage.className = 'mls-render mls-staging';
    // Mermaid measures SVG text; render in an attached, invisible staging element.

    try {
      const cleanup = await this.options.render(this.block.code, stage, this.host);
      if (this.dead || version !== this.version) { cleanup(); stage.remove(); return; }
      this.cleanup?.();
      this.cleanup = cleanup;
      stage.classList.remove('mls-staging');
      this.preview.replaceChildren(stage);
      this.status.textContent = '实时预览';
      this.preview.classList.remove('mls-error');
    } catch (error) {
      stage.remove();
      if (this.dead || version !== this.version) return;
      this.cleanup?.(); this.cleanup = undefined;
      const message = this.preview.createEl('pre');
      message.textContent = error instanceof Error ? error.message : String(error);
      this.preview.replaceChildren(message);
      this.preview.classList.add('mls-error');
      this.status.textContent = '语法有误 · 修改后自动重试';
    }
    this.host.requestMeasure();
  }
  destroy(): void {
    this.dead = true; this.version++;
    this.window.clearTimeout(this.timer);
    this.disposeResizing(); this.cleanup?.(); this.editor.destroy();
  }
}

export function splitExtension(options: SplitOptions): Extension {
  function decorate(state: EditorState): DecorationSet {
    if (!options.isLivePreview(state)) return Decoration.none;
    return Decoration.set(findMermaidBlocks(state.doc.toString()).map(block =>
      Decoration.replace({ widget: new SplitWidget(block, options), block: true }).range(block.from, block.to)));
  }
  return Prec.highest(StateField.define<DecorationSet>({
    create: decorate,
    update(value, tr) {
      return tr.docChanged || options.isLivePreview(tr.startState) !== options.isLivePreview(tr.state) ? decorate(tr.state) : value;
    },
    provide: field => [EditorView.decorations.from(field), EditorView.atomicRanges.of(view => view.state.field(field))],
  }));
}
