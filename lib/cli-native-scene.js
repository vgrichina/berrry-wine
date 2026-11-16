'use strict';

// Public native USER identities only. A permanent renderer owner can outlive
// individual dialogs; each intent must still match its own reviewed scene.
function context(s) {
  const window = h => s.windows?.find(w => w.hwnd === h) || null;
  return { mainHwnd:s.mainHwnd, main:window(s.mainHwnd), modalHwnd:s.modalHwnd,
    modal:window(s.modalHwnd), focus:s.focus, focusTopLevel:s.focusTopLevel,
    focusWindow:s.focusWindow, capture:s.capture, physicalUp:s.physicalUp,
    nativeProcess:s.nativeProcess, nativeMessageBox:s.nativeMessageBox, screen:s.screen };
}
function matches(current, expected) {
  if (!expected || current.quit || current.eip === '0x0' || !current.physicalUp || current.capture !== '0x0') return false;
  const c=context(current), main=c.main, modal=c.modal, focus=c.focusWindow;
  const live=w=>!!(w?.live && w.generation && w.generation!=='0' && w.processId && w.threadId);
  if (!live(main) || !main.visible || main.isChild || !live(focus) ||
      focus.processId!==main.processId || focus.threadId!==main.threadId ||
      !c.nativeProcess?.pid || !c.nativeProcess.executable || !c.screen?.w || !c.screen.h) return false;
  if (c.modalHwnd !== '0x0') {
    if (!live(modal) || !modal.visible || modal.isChild || modal.processId!==main.processId ||
        modal.threadId!==main.threadId || c.focusTopLevel!==modal.hwnd) return false;
    if (modal.owner!==main.hwnd) {
      const box=c.nativeMessageBox;
      if (modal.owner!=='0x0' || !box || box.controlClass!==16 || box.hwnd!==modal.hwnd ||
          box.generation!==modal.generation || box.processId!==main.processId || box.threadId!==main.threadId) return false;
    }
  } else if (c.focusTopLevel!==main.hwnd) return false;
  return JSON.stringify(c)===JSON.stringify(context(expected));
}
module.exports={context,matches};
