import { JSDOM } from 'jsdom';

// Set up before importing CodeMirror: it captures browser globals at module load.
const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
const { window } = dom;
for (const name of ['window', 'document', 'navigator', 'MutationObserver', 'HTMLElement', 'Element', 'Node', 'Text', 'Range', 'DOMRect', 'KeyboardEvent', 'Event'] as const) {
  Object.defineProperty(globalThis, name, { configurable: true, value: name === 'window' ? window : window[name] });
}
Object.defineProperty(globalThis, 'getComputedStyle', { configurable: true, value: window.getComputedStyle.bind(window) });
Object.defineProperty(globalThis, 'requestAnimationFrame', { configurable: true, value: window.requestAnimationFrame.bind(window) });
Object.defineProperty(globalThis, 'cancelAnimationFrame', { configurable: true, value: window.cancelAnimationFrame.bind(window) });
// jsdom has no layout engine; CodeMirror only needs valid, finite measurements.
window.Range.prototype.getBoundingClientRect = () => new window.DOMRect(0, 0, 0, 0);
window.Range.prototype.getClientRects = () => Object.assign([], { item: () => null });
export { dom };
