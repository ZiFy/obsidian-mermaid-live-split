import { dom } from './dom';
import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { attachSplitResizing } from '../src/resize';

function setup(t: TestContext) {
  const root = document.body.appendChild(document.createElement('div'));
  root.append(document.createElement('section'), document.createElement('section'));
  root.getBoundingClientRect = () => new dom.window.DOMRect(0, 0, 1000, 440);
  let measures = 0;
  const dispose = attachSplitResizing(root, () => { measures++; });
  t.after(() => { dispose(); root.remove(); });
  return { root, dispose, measured: () => measures,
    divider: root.querySelector<HTMLElement>('.mls-divider')!,
    height: root.querySelector<HTMLElement>('.mls-height-handle')! };
}
function pointer(target: EventTarget, type: string, x: number, y: number, id = 1) {
  const event = new dom.window.MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 });
  Object.defineProperty(event, 'pointerId', { value: id });
  target.dispatchEvent(event);
}

test('pointer dragging changes local width and height with independent handles', t => {
  const { root, divider, height, measured } = setup(t);
  pointer(divider, 'pointerdown', 500, 100);
  pointer(document, 'pointermove', 700, 100, 2); // Another pointer cannot hijack the drag.
  assert.equal(divider.getAttribute('aria-valuenow'), '50');
  pointer(document, 'pointermove', 700, 100);
  assert.equal(divider.getAttribute('aria-valuenow'), '70');
  assert.equal(root.style.getPropertyValue('--mls-source-fr'), '70fr');
  pointer(document, 'pointerup', 700, 100);
  pointer(height, 'pointerdown', 500, 440);
  pointer(document, 'pointermove', 500, 600);
  pointer(document, 'pointerup', 500, 600);
  assert.equal(root.style.getPropertyValue('--mls-height'), '600px');
  assert.equal(divider.getAttribute('aria-valuenow'), '70');
  assert.equal(measured(), 2);
});

test('keyboard resizing has accessible bounds and double click restores defaults', t => {
  const { root, divider, height } = setup(t);
  divider.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));
  divider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
  assert.equal(divider.getAttribute('aria-valuenow'), '80');
  divider.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' }));
  divider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
  assert.equal(divider.getAttribute('aria-valuenow'), '20');
  height.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' }));
  height.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
  assert.equal(root.style.getPropertyValue('--mls-height'), '240px');
  divider.dispatchEvent(new Event('dblclick'));
  height.dispatchEvent(new Event('dblclick'));
  assert.equal(divider.getAttribute('aria-valuenow'), '50');
  assert.equal(root.style.getPropertyValue('--mls-height'), '440px');
});

test('cancel, window blur and disposal stop dragging and release global listeners', t => {
  const { root, divider, dispose, measured } = setup(t);
  pointer(divider, 'pointerdown', 500, 100);
  pointer(document, 'pointercancel', 500, 100);
  pointer(document, 'pointermove', 700, 100);
  pointer(divider, 'pointerdown', 500, 100);
  dom.window.dispatchEvent(new Event('blur'));
  pointer(document, 'pointermove', 700, 100);
  pointer(divider, 'pointerdown', 500, 100);
  dispose();
  pointer(document, 'pointermove', 700, 100);
  assert.equal(measured(), 0);
  assert.equal(root.classList.contains('mls-resizing-columns'), false);
  assert.equal(root.querySelector('[role="separator"]'), null);
});
