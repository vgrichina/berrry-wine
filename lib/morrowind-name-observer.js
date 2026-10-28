'use strict';

// Diagnostics only. No guest function calls, stores, input or replay.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const SHA = 'f48300e194c6917cd98d235d259ebc3ab5d7c2071e9b41d798b996a8ce4d0676';
const sourcePins = {
  '04-cache.wat': '8bdc18b56ef54388d6d33497930b36eacf8900dd',
  '06b-core-handlers.wat': 'b84716b91caf51cf3e889973c99fdf6fe9cabfcd',
  '07-decoder.wat': '40d54f194eb3ac1e235aae416d0834b54e1961c8',
  '09a8-handlers-directx.wat': '262805db23c10088ff2afa7c857b0192cc3594eb',
  '09b-dispatch.wat': '6f4df6673a7117ed50e0a4d1960d36693697882b',
  '13-exports.wat': 'e775571b6c5fda3820de5446d3f69cdf35485fb2',
};
function verifySources() {
  for (const [name, pin] of Object.entries(sourcePins)) {
    const bytes = fs.readFileSync(path.join(__dirname, '../src', name));
    const hash = crypto.createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
    if (hash !== pin) throw Error('Name observer source identity: ' + name);
  }
}
function install({ enabled = false, exeBytes, exports: e, read, emit,
  parallel = false, traceConflict = false }) {
  if (!enabled) return null; // Do not even inspect dependencies when disabled.
  if (parallel || traceConflict) throw Error('Name observer conflicts with parallel workers/EIP tracing');
  if (exeBytes.length !== 3907584 || crypto.createHash('sha256').update(exeBytes).digest('hex') !== SHA)
    throw Error('Name observer original executable identity');
  verifySources();
  const base = e.get_image_base() >>> 0, delta = base - 0x400000;
  if (base !== 0x400000) throw Error('Name observer relocation unsupported: preferred load required');
  // Validate the loaded code as well as the original file before attaching.
  const anchors = [[0x406923, 'ff5128'], [0x406926, '85c0'],
    [0x5e672d, '8bf8'], [0x5807c2, '8b8e88000000'], [0x6385e6, 'e8d5a0f3ff']];
  for (const [pc, hex] of anchors)
    if (Buffer.from(read(pc + delta, hex.length / 2)).toString('hex') !== hex)
      throw Error('Name observer loaded code/relocation identity');
  for (const name of ['set_trace_eip_range', 'set_api_log', 'get_current_thread_id',
    'get_eax', 'get_esp', 'get_ecx', 'get_esi'])
    if (typeof e[name] !== 'function') throw Error('Name observer missing hook ' + name);
  let stopped = false, count = 0, serial = 0, lifetime = 0;
  let target = null, lastCommit = null;
  const frames = new Map(), polls = new Map(), callbacks = new Map();
  const tid = () => e.get_current_thread_id() >>> 0;
  const u32 = p => Buffer.from(read(p >>> 0, 4)).readUInt32LE();
  function record(kind, fields = {}) {
    if (stopped) return;
    if (count === 127) {
      stopped = true;
      try { emit({ kind: 'overflow', ordinal: 128, limit: 128, records: count }); } catch (_) {}
      return;
    }
    try { emit({ kind, ordinal: ++count, thread: tid(), ...fields }); }
    catch (_) { stopped = true; }
  }
  function text(element) {
    const object = element + 0x164;
    if (!element || object + 16 > 0xffffffff) throw Error('invalid text object');
    const pointer = u32(object + 4), length = u32(object + 8);
    if (length > 0x100000 || (!pointer && length) || pointer + length > 0x100000000)
      throw Error('invalid text pointer/length');
    const bytes = length ? Buffer.from(read(pointer, Math.min(31, length))) : Buffer.alloc(0);
    return { object, pointer, length, hex: bytes.toString('hex'),
      cursor: bytes.indexOf(124), truncated: length > 31 };
  }
  function safe(fn) {
    if (stopped) return;
    try { fn(); } catch (error) {
      record('unavailable', { reason: String(error.message).slice(0, 160) });
      stopped = true;
    }
  }
  function matchingTarget(thread) { return target && target.thread === thread; }
  const observer = {
    apiEnter(name) { safe(() => {
      const thread = tid(), esp = e.get_esp() >>> 0;
      const stack = frames.get(thread) || [];
      const frame = { id: ++serial, name, esp, ret: u32(esp), thread };
      // Every entry owns an exit, including unrelated/nested invocations.
      if (stack.length >= 32) throw Error('API nesting bound');
      stack.push(frame); frames.set(thread, stack);
      if (frame.ret === 0x406926 + delta) polls.delete(thread);
      if (name !== 'IDirectInputDevice_GetDeviceData' || frame.ret !== 0x406926 + delta ||
          !matchingTarget(thread)) return;
      const device = u32(esp + 4), stride = u32(esp + 8), data = u32(esp + 12),
        countPointer = u32(esp + 16), flags = u32(esp + 20);
      // Exact caller stack layout; reject coincidences and other call forms.
      if (!device || stride !== 20 || flags !== 0 || countPointer !== esp + 24 ||
          data !== esp + 28 || u32(countPointer) !== 1) return;
      if (lastCommit && lastCommit.lifetime === target.lifetime) {
        const current = text(target.pointer);
        record('later-text-sample', { target: target.pointer, text: current,
          changed: JSON.stringify(current) !== JSON.stringify(lastCommit.text),
          firstWriter: null, limitation: 'sample only; intervening writer unobserved' });
        lastCommit = null;
      }
      frame.poll = { invocation: frame.id, entryPC: 0x406923 + delta,
        returnPC: frame.ret, device, data, countPointer, completionESP: esp + 24,
        pollCallerReturn: u32(esp + 48),
        target: target.pointer, lifetime: target.lifetime };
      record('poll-entry', frame.poll);
    }); },
    apiExit() { safe(() => {
      const thread = tid(), stack = frames.get(thread), frame = stack && stack.pop();
      if (!frame || !frame.poll) return;
      const p = frame.poll;
      if (!matchingTarget(thread) || target.pointer !== p.target || target.lifetime !== p.lifetime ||
          (e.get_esp() >>> 0) !== p.completionESP) {
        record('unmatched-completion', { invocation: p.invocation }); return;
      }
      const hresult = e.get_eax() >>> 0, returnedCount = u32(p.countPointer);
      const event = hresult === 0 && returnedCount === 1
        ? Array.from({ length: 5 }, (_, i) => u32(p.data + i * 4)) : null;
      const completed = { ...p, hresult, returnedCount, event, thread, boundarySeen: false };
      polls.set(thread, completed);
      record('poll-completion', { ...completed, beforeNextGuestInstruction: true,
        actualHook: 'log_api_exit', validEvent: event !== null });
    }); },
    onEip(pc) { safe(() => {
      pc >>>= 0;
      const thread = tid(), esp = e.get_esp() >>> 0;
      if (pc === 0x406900 + delta) polls.delete(thread);
      if ((pc === 0x637d30 + delta || pc === 0x5e6895 + delta) && matchingTarget(thread)) {
        record('name-submission-boundary', { pc, target: target.pointer, lifetime: target.lifetime });
        target = null; polls.clear(); callbacks.clear(); lastCommit = null;
      }
      if (pc === 0x5e672d + delta) {
        const pointer = e.get_eax() >>> 0;
        if (!pointer) throw Error('null Name builder result');
        target = { pointer, thread, lifetime: ++lifetime };
        lastCommit = null;
        polls.clear(); callbacks.clear();
        record('name-builder-return', target);
      }
      if (!matchingTarget(thread)) return;
      const p = polls.get(thread);
      if (pc === 0x406926 + delta && p) {
        if (p.boundarySeen || esp !== p.completionESP || (e.get_eax() >>> 0) !== p.hresult) {
          record('unmatched-return', { invocation: p.invocation }); polls.delete(thread); return;
        }
        p.boundarySeen = true;
        record('poll-return-boundary', { invocation: p.invocation, pc });
      }
      if (pc === 0x5807c2 + delta && p && p.boundarySeen && p.event &&
          p.pollCallerReturn === 0x58072b + delta) {
        const ui = e.get_esi() >>> 0;
        p.character = e.get_eax() >>> 0;
        record('translation', { invocation: p.invocation, pc, character: p.character,
          ui, shift: Buffer.from(read(ui + 0x84, 1))[0], modifiers: u32(ui + 0x9c),
          destination: u32(ui + 0x70) });
      }
      if (pc === 0x638050 + delta && p && p.boundarySeen && p.event &&
          p.character !== undefined && u32(esp + 8) === 0xffff803e &&
          u32(esp + 12) === p.character && u32(esp + 20) === target.pointer) {
        const c = { invocation: p.invocation, target: target.pointer, lifetime: target.lifetime,
          entryESP: esp, returnPC: u32(esp) };
        callbacks.set(thread, c);
        record('name-callback', { ...c, pc, root: u32(esp + 4),
          character: u32(esp + 12), aux: u32(esp + 16), text: text(c.target) });
        polls.delete(thread); // A delivered record cannot authorize another callback.
      }
      const c = callbacks.get(thread);
      if (!c || c.lifetime !== target.lifetime) return;
      // The CALL itself is interior to its block. Observe the callee entry,
      // before any setter instruction; never pretend this is a 6385e6 EIP hit.
      if (pc === 0x5726c0 + delta && u32(esp) === 0x6385eb + delta &&
          (e.get_ecx() >>> 0) === c.target) {
        c.setterESP = esp;
        record('setter-before', { ...c, pc, callSite: 0x6385e6 + delta, text: text(c.target) });
      }
      if (pc === 0x6385eb + delta && c.setterESP !== undefined && esp === c.setterESP + 20) {
        const after = text(c.target);
        record('setter-after', { ...c, pc, text: after });
        lastCommit = { lifetime: c.lifetime, text: after };
        delete c.setterESP;
      }
      if (pc === 0x6385ff + delta) record('rejection-or-epilogue', { ...c, pc,
        warning: 'shared epilogue does not alone prove rejection', text: text(c.target) });
      if (pc === c.returnPC && esp === c.entryESP + 4) callbacks.delete(thread);
    }); },
  };
  e.set_api_log(1);
  e.set_trace_eip_range(1, 0x406900 + delta, 0x638600 + delta);
  record('installed', { base, delta, lifetimePolicy: 'builder generation; destruction unobserved',
    laterWriter: 'unobserved: no arbitrary guest write hook',
    beforeSetter: 'callee entry, not interior CALL instruction' });
  return observer;
}
module.exports = { install };
