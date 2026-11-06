import './dom';
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import { EditorState, StateField } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import type { SplitOptions } from '../src/split-extension';
import { dom } from './dom';

after(() => dom.window.close());

class Child {
  unloaded = false;
  constructor(readonly containerEl: HTMLElement) {}
  unload() { this.unloaded = true; }
}
class Plugin {
  app = { native: true };
  children = new Set<Child>();
  addChild(child: Child) { this.children.add(child); return child; }
  removeChild(child: Child) { this.children.delete(child); child.unload(); return child; }
  registerEditorExtension() {}
}
type NativeRender = (app: unknown, markdown: string, target: HTMLElement, sourcePath: string, child: Child) => Promise<void>;
function setup(render: NativeRender) {
  const info = StateField.define({ create: () => ({ file: { path: 'folder/example.md' } }), update: v => v });
  const live = StateField.define({ create: () => true, update: v => v });
  const captured: { options?: SplitOptions } = {};
  const module = { exports: {} as Record<string, unknown> };
  const source = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  const compiled = transformSync(source, { loader: 'ts', format: 'cjs' }).code;
  runInNewContext(compiled, {
    module,
    exports: module.exports,
    require: (id: string) => {
      if (id === 'obsidian') return { Plugin, MarkdownRenderChild: Child, MarkdownRenderer: { render }, editorInfoField: info, editorLivePreviewField: live };
      if (id === './split-extension') return { splitExtension: (options: SplitOptions) => { captured.options = options; return []; } };
      throw new Error('Unexpected dependency: ' + id);
    },
  });
  const Constructor = module.exports.default as new () => Plugin & { onload(): void };
  const plugin = new Constructor();
  plugin.onload();
  assert.ok(captured.options);
  const host = { state: EditorState.create({ extensions: [info, live] }) } as EditorView;
  return { plugin, options: captured.options, host };
}

test('native adapter delegates fenced source, document path and lifecycle to MarkdownRenderer', async () => {
  let rendered: { markdown: string; path: string; child: Child } | undefined;
  const { plugin, options, host } = setup(async (app, markdown, target, path, child) => {
    assert.equal(app, plugin.app);
    rendered = { markdown, path, child };
    target.textContent = 'native diagram';
  });
  const target = document.createElement('div');
  const code = ['mindmap', 'root((~~~))'].join(String.fromCharCode(10));
  const cleanup = await options.render(code, target, host);
  assert.equal(rendered?.markdown, ['~~~~mermaid', code, '~~~~'].join(String.fromCharCode(10)));
  assert.equal(rendered?.path, 'folder/example.md');
  assert.equal(target.classList.contains('markdown-rendered'), true);
  assert.equal(plugin.children.size, 1);
  assert.equal(options.isLivePreview(host.state), true);
  assert.equal(options.isLivePreview(EditorState.create()), false);
  cleanup();
  assert.equal(rendered?.child.unloaded, true);
  assert.equal(plugin.children.size, 0);
  assert.equal(target.childNodes.length, 0);
});

test('native adapter disposes failed renders and allows subsequent renders', async () => {
  let calls = 0;
  const { plugin, options, host } = setup(async (_app, _markdown, target) => {
    target.textContent = 'partial result';
    if (++calls === 1) throw new Error('native failed');
  });
  const target = document.createElement('div');
  await assert.rejects(options.render('mindmap', target, host), /native failed/);
  assert.equal(plugin.children.size, 0);
  assert.equal(target.childNodes.length, 0);
  const cleanup = await options.render('mindmap', target, host);
  assert.equal(calls, 2);
  assert.equal(plugin.children.size, 1);
  cleanup();
  assert.equal(plugin.children.size, 0);
});
