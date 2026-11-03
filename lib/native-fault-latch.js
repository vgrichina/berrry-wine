'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const clone = value => JSON.parse(JSON.stringify(value));

function persistNativeFault(filename, evidence) {
  if (typeof filename !== 'string' || !filename) throw new Error('fault termination needs an evidence path');
  const fd = fs.openSync(filename, 'wx');
  try {
    fs.writeFileSync(fd, JSON.stringify(evidence, null, 2) + '\n');
    fs.fsyncSync(fd);
  } finally { fs.closeSync(fd); }
  const dir = fs.openSync(path.dirname(filename), 'r');
  try { fs.fsyncSync(dir); } finally { fs.closeSync(dir); }
}

// An explicitly armed cooperative scheduler may retain a failed native run.
// There is deliberately no resume operation: a trap is never a breakpoint.
function createNativeFaultLatch({ meta, threads, read, releaseInput, persist }) {
  const identity = { pid: process.pid, process: crypto.randomUUID(), generation: 1 };
  const instances = new WeakMap();
  let armed = false, fault = null, nativeError = null, exports = null;
  let wake, terminated = false;
  const parked = new Promise(resolve => { wake = resolve; });
  const secondary = (phase, error) => fault.secondary.push({ phase, message: String(error.message || error) });
  const regs = e => Object.fromEntries(
    ['eip', 'esp', 'eax', 'ebx', 'ecx', 'edx', 'esi', 'edi', 'ebp', 'current_thread_id', 'last_run_halt']
      .map(name => [name, e['get_' + name]() >>> 0]));
  function check(cmd, token = false) {
    if (!cmd || !cmd.identity || Object.keys(identity).some(key => cmd.identity[key] !== identity[key]) ||
        (token && (!fault || cmd.token !== fault.token))) throw new Error('wrong process/generation/fault epoch');
  }
  return {
    isHeld: () => !!fault,
    status: () => clone({ identity, armed, failed: !!fault, terminated, fault }),
    arm(cmd) {
      check(cmd);
      if (armed || fault) throw new Error('native fault retention already armed');
      armed = true;
      return this.status();
    },
    capture(error, e, owner, path) {
      if (!armed) return false;
      if (fault) return true;
      // Install the failure before any diagnostic read, logging or persistence.
      // Keep the actual Error privately for the pending command's rejection.
      nativeError = error;
      exports = e;
      fault = { token: crypto.randomUUID(), identity: clone(identity), owner: clone(owner), path,
        at: new Date().toISOString(), error: { name: String(error.name), message: String(error.message), stack: String(error.stack) },
        registers: null, meta: null, threads: null, stack: { address: null, requestedLength: 128, capturedLength: 0, complete: false, hex: '' }, secondary: [] };
      if (!instances.has(e)) instances.set(e, crypto.randomUUID());
      fault.owner.instance = instances.get(e);
      for (const [phase, capture] of [
        ['registers', () => {
          const snapshot = regs(e);
          fault.owner.tid = fault.owner.nativeThreadId = snapshot.current_thread_id;
          return snapshot;
        }], ['meta', meta], ['threads', threads],
        ['stack', () => {
          const address = e.get_esp() >>> 0, requestedLength = 128, bytes = [];
          // Read one validated byte at a time: a failed translation must never
          // discard the valid prefix or expose bytes from the null sentinel.
          for (let i = 0; i < requestedLength; i++) {
            try {
              if (address + i >= 0x100000000) throw new Error('stack address overflow');
              const byte = read(e, address + i, 1);
              if (byte.length !== 1) throw new Error('short stack read');
              bytes.push(byte[0]);
            } catch (error) { secondary('stack', error); break; }
          }
          return { address, requestedLength, capturedLength: bytes.length,
            complete: bytes.length === requestedLength, hex: Buffer.from(bytes).toString('hex') };
        }],
      ]) {
        try { fault[phase] = clone(capture()); } catch (later) { secondary(phase, later); }
      }
      return true;
    },
    async wait() { if (fault) await parked; },
    inspect(cmd) {
      check(cmd, true);
      const segments = [];
      try {
        const spans = cmd.spans || [];
        if (!Array.isArray(spans) || spans.length > 64) throw new Error('invalid fault capture spans');
        let total = 0;
        for (const { address, length } of spans) {
          if (!Number.isInteger(address) || address < 0x10000 || !Number.isInteger(length) ||
              length < 1 || length > 1024 * 1024 || address + length > 0x100000000 ||
              (total += length) > 4 * 1024 * 1024) throw new Error('fault capture span bounds');
          segments.push({ address, hex: read(exports, address, length).toString('hex') });
        }
      } catch (error) { secondary('inspection', error); throw error; }
      return { ...this.status(), segments };
    },
    terminate(cmd) {
      check(cmd, true);
      if (terminated) return { terminated: true, duplicate: true };
      // A failed persistence must leave inspection and a later explicit
      // termination available, with the original native error still primary.
      try {
        const input = releaseInput();
        persist(cmd.path, { ...this.status(), inputReleased: true, input, terminationRequested: true });
      } catch (error) { secondary('termination', error); throw error; }
      terminated = true;
      wake();
      return { terminated: true, error: clone(fault.error) };
    },
    error: () => nativeError,
  };
}

module.exports = { createNativeFaultLatch, persistNativeFault };
