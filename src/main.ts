import { Plugin, MarkdownRenderChild, MarkdownRenderer, editorInfoField, editorLivePreviewField } from 'obsidian';
import { splitExtension } from './split-extension';

export default class MermaidLiveSplitPlugin extends Plugin {
  private queue: Promise<unknown> = Promise.resolve();
  onload(): void {
    this.registerEditorExtension(splitExtension({
      isLivePreview: state => state.field(editorLivePreviewField, false) === true,
      render: (code, target, host) => {
        const sourcePath = host.state.field(editorInfoField, false)?.file?.path ?? '';
        const task = this.queue.then(async () => {
          const child = this.addChild(new MarkdownRenderChild(target));
          const cleanup = () => { this.removeChild(child); target.replaceChildren(); };
          const fence = '~'.repeat(Math.max(3, ...(code.match(/~+/g) ?? []).map(run => run.length + 1)));
          target.classList.add('markdown-rendered');
          try {
            // Use the same code block processing pipeline as the native Markdown preview.
            await MarkdownRenderer.render(this.app, fence + 'mermaid\n' + code + '\n' + fence, target, sourcePath, child);
          } catch (error) {
            cleanup();
            throw error;
          }
          return cleanup;
        });
        this.queue = task.catch(() => undefined);
        return task;
      },
    }));
  }
}
