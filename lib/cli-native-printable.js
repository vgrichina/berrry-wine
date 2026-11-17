'use strict';

// An explicit browser character accompanies a physical key; never derive text
// from a virtual-key code or ask TranslateMessage to generate it a second time.
// Native EDIT/common-modal paths can execute synchronously in the renderer and
// need their own invocation proof. This route accepts queued USER messages only.
function validatePrintable(event, scene, renderer) {
  if (event.charCode === undefined) return;
  if (event.action !== 'keydown' || !Number.isInteger(event.code) || event.code < 1 || event.code > 255 ||
      !Number.isInteger(event.charCode) || event.charCode < 32 || event.charCode > 126)
    throw Error('unsupported guarded printable character');
  const focus = scene.windows?.find(w => w.hwnd === scene.focus);
  if (!scene.physicalUp || scene.modalHwnd !== '0x0' || scene.capture !== '0x0' ||
      !focus?.live || !focus.visible || focus.controlClass !== 0 || focus.isChild ||
      focus.hwnd !== scene.focusWindow?.hwnd || focus.generation !== scene.focusWindow.generation ||
      focus.processId !== scene.focusWindow.processId || focus.threadId !== scene.focusWindow.threadId ||
      focus.hwnd !== scene.mainHwnd ||
      focus.hwnd !== scene.focusTopLevel || (focus.style & (1 << 27)))
    throw Error('unsupported guarded printable native target');
  if (!renderer || typeof renderer.handleKeyDown !== 'function' || typeof renderer.handleKeyPress !== 'function' ||
      renderer._findWatEditTarget?.() || renderer._menuMode || renderer._menuEscapeHeld ||
      renderer._suppressNextKeyPress || renderer.peekKeyDownState?.(16) ||
      renderer.peekKeyDownState?.(17) || renderer.peekKeyDownState?.(18) ||
      !(event.code === 32 || (event.code >= 48 && event.code <= 57) ||
        (event.code >= 65 && event.code <= 90) || (event.code >= 96 && event.code <= 111) ||
        (event.code >= 186 && event.code <= 192) || (event.code >= 219 && event.code <= 222)))
    throw Error('unsupported guarded printable keyboard route');
}
module.exports = { validatePrintable };
