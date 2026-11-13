'use strict';

// main_hwnd belongs to one guest WASM thread, not to the CLI process. The
// presentation target is shared, but only its registered live guest owner can
// authorize input. Never adopt that window into slot 0 or select a renderer
// window by title, size or enumeration order.
function createCliInputSnapshot({ instance, memory, renderer, getDevice, getThreadManager }) {
  return function snapshot() {
    const we = instance.exports;
    const mainHwnd = we.get_main_hwnd();
    const hwnd = mainHwnd || we.get_dx_present_hwnd();
    const tid = hwnd ? we.get_window_thread(hwnd) : 0;
    let actor = null, actorInstance = null;
    if (tid === we.get_current_thread_id()) actorInstance = instance;
    else {
      for (const thread of getThreadManager()?.threads.values() || []) {
        if (thread.state === 'active' && thread.instance?.exports.get_current_thread_id() === tid) {
          // Refuse duplicate registrations rather than guess an actor.
          if (actor) { actor = null; actorInstance = null; break; }
          actor = thread;
          actorInstance = thread.instance;
        }
      }
    }
    const owner = actorInstance?.exports;
    const device = getDevice(), win = renderer?.windows[hwnd];
    const refs = { instance, exports: we, memory, buffer: memory.buffer, renderer,
      actor, actorInstance, actorExports: owner, tid, mainHwnd,
      queue: renderer?.inputQueue, canvas: renderer?.canvas, window: win, hwnd,
      width: renderer?.canvas?.width, height: renderer?.canvas?.height,
      device, adapter: device?.worker, module: device?.module,
      control: device?.control, controlBuffer: device?.controlBuffer,
      down: renderer?.handleKeyDown, up: renderer?.handleKeyUp,
      mouseDown: renderer?.handleMouseDown, mouseUp: renderer?.handleMouseUp };
    if (device?.buffers) device.buffers.forEach((b, i) => { refs['deviceBuffer' + i] = b.buffer; });
    return { refs, healthy: !!(win?.visible && owner && owner.get_main_hwnd() === hwnd &&
      !we.get_quit_flag() && we.get_eip() && !owner.get_quit_flag() && owner.get_eip() &&
      (!device || (typeof device.snapshot === 'function' && device.snapshot().ready))) };
  };
}

module.exports = { createCliInputSnapshot };
