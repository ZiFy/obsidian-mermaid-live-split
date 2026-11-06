/** Keep widget dimensions local to the view; resizing must never edit the note. */
export function attachSplitResizing(root: HTMLElement, measure: () => void): () => void {
  const doc = root.ownerDocument;
  const divider = root.createEl('div');
  divider.className = 'mls-divider';
  divider.setAttribute('aria-label', '调整源码与预览宽度');
  divider.title = '拖动调整左右宽度，双击恢复均分';
  const heightHandle = root.createEl('div');
  heightHandle.className = 'mls-height-handle';
  heightHandle.setAttribute('aria-label', '调整双栏高度');
  heightHandle.title = '拖动调整高度，双击恢复默认高度';
  root.insertBefore(divider, root.children[1] ?? null);
  root.appendChild(heightHandle);
  for (const [handle, orientation] of [[divider, 'vertical'], [heightHandle, 'horizontal']] as const) {
    handle.tabIndex = 0;
    handle.setAttribute('role', 'separator');
    handle.setAttribute('aria-orientation', orientation);
  }
  divider.setAttribute('aria-valuemin', '20');
  divider.setAttribute('aria-valuemax', '80');
  heightHandle.setAttribute('aria-valuemin', '240');
  let percent = 50;
  let height = 440;
  let stopDrag: (() => void) | undefined;
  const setWidth = (value: number) => {
    percent = Math.max(20, Math.min(80, value));
    root.style.setProperty('--mls-source-fr', percent + 'fr');
    root.style.setProperty('--mls-preview-fr', (100 - percent) + 'fr');
    divider.setAttribute('aria-valuenow', String(Math.round(percent)));
    measure();
  };
  const setHeight = (value: number) => {
    height = Math.max(240, Math.round(value));
    root.style.setProperty('--mls-height', height + 'px');
    heightHandle.setAttribute('aria-valuenow', String(height));
    measure();
  };
  divider.setAttribute('aria-valuenow', String(percent));
  heightHandle.setAttribute('aria-valuenow', String(height));
  const bind = (handle: HTMLElement, horizontal: boolean) => {
    const down = (event: PointerEvent) => {
      if (event.button !== 0 || event.isPrimary === false) return;
      event.preventDefault(); event.stopPropagation();
      stopDrag?.();
      const bounds = root.getBoundingClientRect();
      const start = horizontal ? event.clientX : event.clientY;
      const initial = horizontal ? percent : bounds.height || height;
      const move = (next: PointerEvent) => {
        if (next.pointerId !== event.pointerId) return;
        next.preventDefault();
        const delta = (horizontal ? next.clientX : next.clientY) - start;
        if (horizontal) setWidth(initial + delta / Math.max(1, bounds.width) * 100);
        else setHeight(initial + delta);
      };
      const end = (next: PointerEvent) => {
        if (next.pointerId === event.pointerId) stopDrag?.();
      };
      const blur = () => stopDrag?.();
      const className = horizontal ? 'mls-resizing-columns' : 'mls-resizing-height';
      root.classList.add(className);
      doc.addEventListener('pointermove', move);
      doc.addEventListener('pointerup', end);
      doc.addEventListener('pointercancel', end);
      handle.addEventListener('lostpointercapture', end);
      doc.defaultView?.addEventListener('blur', blur);
      stopDrag = () => {
        stopDrag = undefined;
        doc.removeEventListener('pointermove', move);
        doc.removeEventListener('pointerup', end);
        doc.removeEventListener('pointercancel', end);
        handle.removeEventListener('lostpointercapture', end);
        doc.defaultView?.removeEventListener('blur', blur);
        root.classList.remove(className);
        if (handle.hasPointerCapture?.(event.pointerId)) handle.releasePointerCapture(event.pointerId);
      };
      handle.setPointerCapture?.(event.pointerId);
    };
    const keydown = (event: KeyboardEvent) => {
      const step = event.shiftKey ? 10 : 2;
      const delta = horizontal
        ? event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0
        : event.key === 'ArrowUp' ? -step * 8 : event.key === 'ArrowDown' ? step * 8 : 0;
      if (!delta && event.key !== 'Home' && !(horizontal && event.key === 'End')) return;
      event.preventDefault(); event.stopPropagation();
      if (horizontal) setWidth(event.key === 'Home' ? 20 : event.key === 'End' ? 80 : percent + delta);
      else setHeight(event.key === 'Home' ? 240 : height + delta);
    };
    const reset = () => { if (horizontal) setWidth(50); else setHeight(440); };
    handle.addEventListener('pointerdown', down);
    handle.addEventListener('keydown', keydown);
    handle.addEventListener('dblclick', reset);
    return () => {
      handle.removeEventListener('pointerdown', down);
      handle.removeEventListener('keydown', keydown);
      handle.removeEventListener('dblclick', reset);
      handle.remove();
    };
  };
  const unbindWidth = bind(divider, true);
  const unbindHeight = bind(heightHandle, false);
  return () => { stopDrag?.(); unbindWidth(); unbindHeight(); };
}
