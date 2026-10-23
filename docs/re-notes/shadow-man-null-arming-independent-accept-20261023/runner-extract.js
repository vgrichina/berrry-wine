    while (scheduledInput.length && scheduledInput[0].batch <= batch) {
      const ev = scheduledInput.shift();
      diagnosticActionSequence++;
if (ev.action === 'dlg-cmd') {
        const we = instance.exports;
        let dlg = 0;
        // A WAT-native modal (MessageBox, the common dialogs) owns the
        // CACA0006 pump, and nothing else can complete it. It is the target
        // whatever the renderer's z-order says, and it is not necessarily
        // flagged isDialog there, so ask WAT first.
        if (we.modal_dialog_hwnd) dlg = we.modal_dialog_hwnd() | 0;
        if (dlg) {
          const diagnosticSend = globalThis[Symbol.for('wine.shadow-null.selected-send.v1')];
          if (diagnosticSend) diagnosticSend({instance, pid:process.pid, runner:__filename,
            action:ev.action, actionSequence:diagnosticActionSequence, batch, cmdId:ev.cmdId,
            hwnd:dlg >>> 0, resolution:'modal'}, () => we.send_message(dlg, 0x0111, ev.cmdId, 0));
          else we.send_message(dlg, 0x0111, ev.cmdId, 0);
          logs.push(`[input] dlg-cmd: cmd=${ev.cmdId} modal hwnd=0x${dlg.toString(16)} at batch ${batch}`);
          continue;
        }
        if (renderer) {
          const wins = Object.values(renderer.windows || {})
            .filter(w => w && w.visible && w.isDialog)
            .sort((a, b) => ((b.zOrder || 0) - (a.zOrder || 0)) || ((b.hwnd || 0) - (a.hwnd || 0)));
          if (wins.length) dlg = wins[0].hwnd | 0;
        }
        if (!dlg && we.wnd_slot_hwnd && we.dlg_get_style) {
          for (let s = 255; s >= 0; s--) {
            const hwnd = we.wnd_slot_hwnd(s);
            if (hwnd && we.dlg_get_style(hwnd)) { dlg = hwnd; break; }
          }
        }
        // A property sheet's active page is itself a visible dialog and may
        // have a higher z-order than the sheet frame. WM_COMMAND IDOK/IDCANCEL
        // belongs to the outer dialog, so climb through dialog parents before
        // injecting the command.
        if (dlg && we.wnd_get_parent) {
          for (let guard = 0; guard < 16; guard++) {
            const parent = we.wnd_get_parent(dlg) | 0;
            const parentWin = parent && renderer && renderer.windows
              ? renderer.windows[parent]
              : null;
            if (!parent || !parentWin || !parentWin.isDialog) break;
            dlg = parent;
          }
        }
        if (dlg) {
          const diagnosticSend = globalThis[Symbol.for('wine.shadow-null.selected-send.v1')];
          if (diagnosticSend) diagnosticSend({instance, pid:process.pid, runner:__filename,
            action:ev.action, actionSequence:diagnosticActionSequence, batch, cmdId:ev.cmdId,
            hwnd:dlg >>> 0, resolution:'resolved-dialog'}, () => we.send_message(dlg, 0x0111, ev.cmdId, 0));
          else we.send_message(dlg, 0x0111, ev.cmdId, 0);
          logs.push(`[input] dlg-cmd: cmd=${ev.cmdId} hwnd=0x${dlg.toString(16)} at batch ${batch}`);
        } else {
          logs.push(`[input] dlg-cmd: cmd=${ev.cmdId} NO DIALOG at batch ${batch}`);
        }
}
}
