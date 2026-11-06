import './dom';
import assert from 'node:assert/strict';
import { after, test, type TestContext } from 'node:test';
import { Compartment, EditorState, Facet } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { history, redo, undo } from '@codemirror/commands';
import { splitExtension, type SplitOptions } from '../src/split-extension';
import { dom } from './dom';

const live = Facet.define<boolean, boolean>({ combine: values => values[0] ?? false });
const fence = (code: string) => '```mermaid\n' + code + '\n```';
const initial = 'before\n' + fence('graph TD\nA-->B') + '\nbetween\n' + fence('flowchart LR\nX-->Y') + '\nafter';

function setup(t: TestContext, doc = initial, render: SplitOptions['render'] = async () => () => {}) {
  const mode = new Compartment();
  const parent = document.body.appendChild(document.createElement('div'));
  const host = new EditorView({ parent, state: EditorState.create({ doc, extensions: [
    history(), mode.of(live.of(true)),
    splitExtension({ isLivePreview: state => state.facet(live), render }),
  ] }) });
  let destroyed = false;
  const destroy = () => {
    if (!destroyed) { host.destroy(); parent.remove(); destroyed = true; }
  };
  t.after(destroy);
  return { host, mode, destroy };
}
function nested(host: EditorView): EditorView[] {
  return [...host.dom.querySelectorAll<HTMLElement>('.mls-source .cm-editor')].map(element => {
    const view = EditorView.findFromDOM(element);
    assert.ok(view);
    assert.notEqual(view, host);
    return view;
  });
}
function append(view: EditorView, text: string) {
  view.dispatch({ changes: { from: view.state.doc.length, insert: text }, userEvent: 'input.type' });
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
after(() => dom.window.close());

test('native nested EditorView consecutive edits update only its host fence', t => {
  const { host } = setup(t);
  const [first, second] = nested(host);
  assert.equal(nested(host).length, 2);
  for (const char of '\nB-->中文') append(first, char);
  assert.equal(first.state.doc.toString(), 'graph TD\nA-->B\nB-->中文');
  assert.equal(host.state.doc.toString(), initial.replace('graph TD\nA-->B', 'graph TD\nA-->B\nB-->中文'));
  assert.equal(second.state.doc.toString(), 'flowchart LR\nX-->Y');
  assert.equal(nested(host)[0], first, 'typing preserves the active native editor');
});

test('resizing preserves document history, block independence and dimensions through edits', t => {
  const { host } = setup(t);
  const [first] = nested(host);
  const root = host.dom.querySelector<HTMLElement>('.mermaid-live-split')!;
  const divider = root.querySelector<HTMLElement>('.mls-divider')!;
  const height = root.querySelector<HTMLElement>('.mls-height-handle')!;
  divider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
  height.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
  assert.equal(host.state.doc.toString(), initial);
  assert.equal(undo(host), false, 'display adjustments do not enter note history');
  const dimensions = root.getAttribute('style');
  append(first, '\nB-->C');
  assert.equal(host.dom.querySelector('.mermaid-live-split'), root);
  assert.equal(root.getAttribute('style'), dimensions);
  assert.equal(host.dom.querySelectorAll('.mermaid-live-split')[1].getAttribute('style'), null);
  assert.equal(undo(host), true);
  assert.equal(host.state.doc.toString(), initial);
  assert.equal(root.getAttribute('style'), dimensions);
});

test('nested replacement and deletion preserve the host fences and surrounding prose', t => {
  const { host } = setup(t);
  const first = nested(host)[0];
  first.dispatch({ changes: { from: 9, to: 14, insert: 'Alpha-->Beta' } });
  first.dispatch({ changes: { from: 0, to: 9, insert: '' } });
  assert.equal(first.state.doc.toString(), 'Alpha-->Beta');
  assert.equal(host.state.doc.toString(), initial.replace('graph TD\nA-->B', 'Alpha-->Beta'));
});

test('host undo and redo synchronize nested editors without creating extra history', t => {
  const { host } = setup(t);
  append(nested(host)[0], '\nB-->C');
  append(nested(host)[0], '\nC-->D');
  const edited = host.state.doc.toString();
  assert.equal(undo(host), true);
  assert.equal(host.state.doc.toString(), initial);
  assert.equal(nested(host)[0].state.doc.toString(), 'graph TD\nA-->B');
  assert.equal(undo(host), false, 'host-origin nested synchronization adds no history');
  assert.equal(redo(host), true);
  assert.equal(host.state.doc.toString(), edited);
  assert.equal(nested(host)[0].state.doc.toString(), 'graph TD\nA-->B\nB-->C\nC-->D');
});

test('insertion before fences and growth of first fence remap later nested edits', t => {
  const { host } = setup(t);
  host.dispatch({ changes: { from: 0, insert: 'new heading\n' } });
  append(nested(host)[0], '\nB-->C');
  append(nested(host)[1], '\nY-->Z');
  assert.equal(host.state.doc.toString(), 'new heading\n' + initial
    .replace('A-->B', 'A-->B\nB-->C').replace('X-->Y', 'X-->Y\nY-->Z'));
  assert.equal(nested(host)[1].state.doc.toString(), 'flowchart LR\nX-->Y\nY-->Z');
});

test('host changes can remove the first block while the remaining block stays editable', t => {
  const { host } = setup(t);
  const end = initial.indexOf('between');
  host.dispatch({ changes: { from: 0, to: end, insert: '' } });
  assert.equal(nested(host).length, 1);
  append(nested(host)[0], '\nY-->Z');
  assert.equal(host.state.doc.toString(), 'between\n' + fence('flowchart LR\nX-->Y\nY-->Z') + '\nafter');
});

test('Compartment mode changes remove and restore widgets without changing document', t => {
  const { host, mode } = setup(t);
  host.dispatch({ effects: mode.reconfigure(live.of(false)) });
  assert.equal(nested(host).length, 0);
  assert.equal(host.state.doc.toString(), initial);
  host.dispatch({ changes: { from: initial.indexOf('A-->B'), to: initial.indexOf('A-->B') + 5, insert: 'A-->C' } });
  host.dispatch({ effects: mode.reconfigure(live.of(true)) });
  assert.equal(nested(host).length, 2);
  assert.equal(nested(host)[0].state.doc.toString(), 'graph TD\nA-->C');
  append(nested(host)[1], '\nY-->Z');
  assert.match(host.state.doc.toString(), /Y-->Z/);
});

test('first input into a fence with no source lines preserves closing fence and history', t => {
  const original = "~~~mermaid\n~~~";
  const { host } = setup(t, original);
  const editor = nested(host)[0];
  assert.equal(editor.state.doc.toString(), '');
  append(editor, 'graph TD');
  assert.equal(host.state.doc.toString(), "~~~mermaid\ngraph TD\n~~~");
  assert.equal(nested(host)[0], editor);
  append(editor, "\nA-->B");
  assert.equal(host.state.doc.toString(), "~~~mermaid\ngraph TD\nA-->B\n~~~");
  assert.equal(undo(host), true);
  assert.equal(host.state.doc.toString(), original);
  assert.equal(nested(host)[0].state.doc.toString(), '');
  assert.equal(redo(host), true);
  assert.equal(host.state.doc.toString(), "~~~mermaid\ngraph TD\nA-->B\n~~~");
});

function controlledRender() {
  const calls: { code: string; target: HTMLElement; resolve: (cleanup: () => void) => void; reject: (error: Error) => void; cleaned: number }[] = [];
  const render: SplitOptions['render'] = (code, target) => new Promise((resolve, reject) => {
    calls.push({ code, target, resolve, reject, cleaned: 0 });
  });
  const finish = async (index: number) => {
    const call = calls[index];
    call.target.textContent = call.code;
    call.resolve(() => { call.cleaned++; });
    await flush();
  };
  return { calls, render, finish };
}

test('render debounce coalesces consecutive input into the latest source', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { calls, render, finish } = controlledRender();
  const { host } = setup(t, fence('graph TD'), render);
  for (const char of '\nA-->B') append(nested(host)[0], char);
  t.mock.timers.tick(249);
  assert.equal(calls.length, 0);
  t.mock.timers.tick(1);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].code, 'graph TD\nA-->B');
  assert.equal(calls[0].target.isConnected, true, 'Mermaid staging node is attached for measurement');
  await finish(0);
  assert.equal(host.dom.querySelector('.mls-preview')?.textContent, 'graph TD\nA-->B');
});

test('older async render resolving last is cleaned and cannot replace current preview', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { calls, render, finish } = controlledRender();
  const { host } = setup(t, fence('graph TD'), render);
  t.mock.timers.tick(250);
  append(nested(host)[0], '\nA-->B');
  t.mock.timers.tick(250);
  assert.equal(calls.length, 2);
  await finish(1);
  await finish(0);
  assert.equal(calls[0].cleaned, 1);
  assert.equal(calls[1].cleaned, 0);
  assert.equal(calls[0].target.isConnected, false);
  assert.equal(host.dom.querySelector('.mls-preview')?.textContent, 'graph TD\nA-->B');
  assert.equal(host.dom.querySelector('.mls-right .mls-label')?.textContent, '实时预览');
});

test('a stale render rejection cannot mark the latest preview as erroneous', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { calls, render, finish } = controlledRender();
  const { host } = setup(t, fence('graph TD'), render);
  t.mock.timers.tick(250);
  append(nested(host)[0], '\nA-->B');
  t.mock.timers.tick(250);
  await finish(1);
  calls[0].reject(new Error('obsolete failure'));
  await flush();
  assert.equal(host.dom.querySelector('.mls-error'), null);
  assert.equal(host.dom.querySelector('.mls-preview')?.textContent, 'graph TD\nA-->B');
  assert.equal(calls[1].cleaned, 0);
});

test('current render errors are shown and a later successful edit recovers', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { calls, render, finish } = controlledRender();
  const { host } = setup(t, fence('graph TD'), render);
  t.mock.timers.tick(250);
  calls[0].reject(new Error('Invalid diagram'));
  await flush();
  assert.equal(host.dom.querySelector('.mls-error')?.textContent, 'Invalid diagram');
  append(nested(host)[0], '\nA-->B');
  t.mock.timers.tick(250);
  await finish(1);
  assert.equal(host.dom.querySelector('.mls-error'), null);
  assert.equal(host.dom.querySelector('.mls-preview')?.textContent, 'graph TD\nA-->B');
});

test('destroying via mode switch cleans current render and late async completion', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { calls, render, finish } = controlledRender();
  const { host, mode } = setup(t, fence('graph TD'), render);
  t.mock.timers.tick(250);
  await finish(0);
  append(nested(host)[0], '\nA-->B');
  t.mock.timers.tick(250);
  host.dispatch({ effects: mode.reconfigure(live.of(false)) });
  assert.equal(calls[0].cleaned, 1);
  await finish(1);
  assert.equal(calls[1].cleaned, 1);
  assert.equal(calls[1].target.isConnected, false);
  assert.equal(nested(host).length, 0);
  t.mock.timers.tick(1000);
  assert.equal(calls.length, 2);
});

test('host destruction disposes nested views and cleans late render completion', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { calls, render, finish } = controlledRender();
  const { host, destroy } = setup(t, fence('graph TD'), render);
  const child = nested(host)[0];
  t.mock.timers.tick(250);
  destroy();
  assert.equal(host.dom.isConnected, false);
  assert.equal(child.dom.isConnected, false);
  await finish(0);
  assert.equal(calls[0].cleaned, 1);
  assert.equal(calls[0].target.isConnected, false);
  t.mock.timers.tick(1000);
  assert.equal(calls.length, 1);
});

test('destroy cancels a render that has not started', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { calls, render } = controlledRender();
  const { host, mode } = setup(t, fence('graph TD'), render);
  host.dispatch({ effects: mode.reconfigure(live.of(false)) });
  t.mock.timers.tick(1000);
  assert.equal(calls.length, 0);
});
