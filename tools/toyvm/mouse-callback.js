'use strict';

// INT33 0Ch/14h. Microsoft Mouse Programmer's Reference, functions 12/20;
// RBIL table 03172 corrects the older manual's swapped SI/DI descriptions.
// Input producers only enqueue snapshots. Guest execution belongs to DosSession.
const RETURN_SEG = 0xf000, RETURN_OFF = 0x201;

// Frontends receive screen coordinates; INT33 reports its guest-programmed
// virtual grid. Preserve the conventional frontend grid until a range is set.
function screenInput(mouse, x, y, width, height, dx, dy) {
  const mapped = (v, size, range) => range
    ? range[0] + Math.round(v * (range[1] - range[0]) / Math.max(1, size - 1)) : v;
  const mx = mapped(x, width, mouse.rangeX), my = mapped(y, height, mouse.rangeY);
  return [mx, my,
    mouse.rangeX ? Math.trunc((mx - mouse.x) * (mouse.ratioX || 8) / 8) : dx,
    mouse.rangeY ? Math.trunc((my - mouse.y) * (mouse.ratioY || 16) / 8) : dy];
}

function install(mouse, mask, segment, offset) {
  const old = mouse.callback || { mask: 0, segment: 0, offset: 0 };
  mouse.callback = { mask: mask & 0xffff, segment: segment & 0xffff, offset: offset & 0xffff };
  mouse.events = [];
  // An executing invocation owns its return context independently of changes
  // to registration, including reset/unregister from inside that invocation.
  return old;
}

function enqueue(mouse, x, y, buttons, dx = 0, dy = 0) {
  const handler = mouse.callback;
  if (!handler || !handler.mask) return;
  let conditions = (x !== mouse.x || y !== mouse.y || dx || dy) ? 1 : 0;
  const changed = mouse.buttons ^ buttons;
  for (let b = 0; b < 3; b++) {
    if (changed & (1 << b)) conditions |= 1 << (1 + b * 2 + ((buttons & (1 << b)) ? 0 : 1));
  }
  if (conditions & handler.mask) {
    // SI/DI expose the same accumulated motion counters read/cleared by
    // function 0Bh. Preserve their value at this event, including its delta.
    mouse.events.push({ handler, conditions, buttons, x, y,
      dx: mouse.dx + dx, dy: mouse.dy + dy });
  }
}

// The callback RETFs to a reserved host continuation, not an IRET frame.
// The driver saves the interrupted context, calls the guest on its 16-bit
// stack, and restores the context after RETF. No callback may nest another.
function handback(session) {
  const { vm, machine } = session, mouse = machine.mouse;
  const active = session.mouseCallback;
  if (active && vm.get('cs') === RETURN_SEG && vm.get('gip') === RETURN_OFF) {
    if (vm.get('ss') !== (active.ss & 0xffff) || vm.get('sp') !== (active.sp & 0xffff)) {
      throw new Error('INT33 callback returned with an unbalanced stack');
    }
    for (const [reg, value] of Object.entries(active)) vm.exports[`set_${reg}`](value);
    vm.set('rtop', 0);
    session.mouseCallback = null;
    return true;
  }
  if (active || !mouse.events?.length || machine.exited
      || (vm.exports.get_cr0() & 1) || !(vm.get('flags') & 0x200)
      || (vm.get('flags') & 0x100) || vm.raw('ifarm')
      || vm.get('cs') === RETURN_SEG) return false;
  const event = mouse.events.shift();
  const saved = {};
  for (const reg of ['ax','bx','cx','dx','si','di','bp','sp','cs','ss','ds','es','fs','gs','gip','flags']) saved[reg] = vm.raw(reg);
  const sp = (saved.sp - 4) & 0xffff;
  // Word pushes wrap at the 16-bit stack boundary, as a real far CALL does.
  for (const [i, byte] of [RETURN_OFF & 255, RETURN_OFF >> 8, RETURN_SEG & 255, RETURN_SEG >> 8].entries()) {
    machine.guestWrite(((saved.ss << 4) + ((sp + i) & 0xffff)) & 0xfffff, [byte]);
  }
  session.mouseCallback = saved;
  vm.exports.set_sp((saved.sp & 0xffff0000) | sp);
  vm.set('rtop', 0);
  vm.set('flags', saved.flags & ~0x700); // hardware entry clears IF/TF; driver clears DF
  vm.set('ds', RETURN_SEG); // driver data segment; caller must establish its own DS
  for (const [reg, value] of Object.entries({ ax:event.conditions, bx:event.buttons,
    cx:event.x, dx:event.y, si:event.dx, di:event.dy })) vm.set(reg, value);
  vm.set('cs', event.handler.segment);
  vm.set('gip', event.handler.offset);
  return false;
}

module.exports = { install, enqueue, handback, screenInput, RETURN_SEG, RETURN_OFF };
