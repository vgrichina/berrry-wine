'use strict';

// Offline-qualified, opt-in adapter for the immutable THPS2 capture runner.
// Nothing here changes the game, emulator, handler, or guest stack.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const RUNNER_SHA256 = '4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809';
const EXPECTED = Object.freeze({ name: 'ExitProcess', ordinal: 3548, thread: 0,
  esp: 0x074ffbd8, returnPC: 0x004f03dc, status: 1,
  instructionVA: 0x004f03d6, instructionHex: 'ff15b0715000' });
const REGISTERS = ['eip', 'eax', 'ecx', 'edx', 'ebx', 'esp', 'ebp', 'esi', 'edi', 'image_base'];
const freeze = value => {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};
function uint(value, label) {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) throw Error(label);
  return value;
}

function readGuest(memory, translate, address, length) {
  uint(address, 'guest-address');
  const tag = Object.prototype.toString.call(memory);
  if (tag !== '[object ArrayBuffer]' && tag !== '[object SharedArrayBuffer]') throw Error('invalid-memory-buffer');
  if (!Number.isInteger(length) || length < 1 || length > 64 || address + length > 0x100000000)
    throw Error('guest-span');
  // Resolve every byte. Adjacent guest pages need not be adjacent WASM pages.
  const source = new Uint8Array(memory);
  const bytes = Buffer.alloc(length);
  for (let i = 0; i < length; i++) {
    const wa = translate(address + i);
    if (!Number.isInteger(wa) || wa <= 0xff || wa >= source.length) throw Error('invalid-guest-map');
    bytes[i] = source[wa];
  }
  return bytes;
}

function readLog(vfs, logPath, cap) {
  if (!(vfs?.files instanceof Map)) throw Error('invalid-vfs');
  const entry = vfs.files.get(logPath);
  if (!entry) throw Error('missing-log');
  // No lazy providers or accessors: reading a getter could materialize an
  // unbounded file before a cap check, or return a partial provider view.
  if (entry._provider) throw Error('nonresident-log');
  const descriptor = Object.getOwnPropertyDescriptor(entry, 'data');
  if (!descriptor || !('value' in descriptor) || !(descriptor.value instanceof Uint8Array))
    throw Error('nonresident-log');
  const data = descriptor.value;
  if (entry._size !== undefined && entry._size !== data.byteLength) throw Error('truncated-log');
  if (data.byteLength > cap) throw Error('oversized-log');
  return Buffer.from(data);
}

function createObserver({ logPath = 'c:\\thps2\\thpcerr.log', logCap = 65536,
  onCapture = () => {}, onFailure = () => {} } = {}) {
  if (!Number.isInteger(logCap) || logCap < 1 || logCap > 1048576) throw Error('invalid-log-cap');
  if (logPath !== 'c:\\thps2\\thpcerr.log') throw Error('unexpected-log-path');
  let entered = false, active = false, failed = null, captured = null, partial = null;
  function reject(reason) {
    if (!failed) {
      failed = freeze({ schema: 1, complete: false, reason: String(reason).slice(0, 1024), partial });
      onFailure(failed);
    }
    throw Error('THPS2 entry observer: ' + failed.reason);
  }
  function onApi(event) {
    if (active) return reject('reentrant');
    if (failed) return reject(failed.reason);
    // Other APIs do not cause reads. The selected ordinal must have the
    // selected name; every ExitProcess is checked, including early exits.
    if (event.name !== EXPECTED.name && event.ordinal !== EXPECTED.ordinal) return null;
    if (entered) return reject('multiple-exit');
    entered = true; active = true;
    try {
      for (const k of ['name', 'ordinal', 'thread']) {
        if (event[k] !== EXPECTED[k]) throw Error('wrong-' + k);
      }
      const registers = {};
      for (const k of REGISTERS) {
        const getter = event.exports?.['get_' + k];
        if (typeof getter !== 'function') throw Error('missing-register-' + k);
        const value = getter();
        if (!Number.isInteger(value) || value < -2147483648 || value > 0xffffffff)
          throw Error('invalid-register-' + k);
        registers[k] = value >>> 0;
      }
      if (registers.esp !== EXPECTED.esp) throw Error('wrong-esp');
      const stack = readGuest(event.memory, event.translate, registers.esp, 64);
      partial = freeze({ name: event.name, ordinal: event.ordinal, thread: event.thread,
        boundary: 'synchronous-host-log-before-handler', registers,
        stack64Hex: stack.toString('hex'), stack64SHA256: digest(stack) });
      if (stack.readUInt32LE(0) !== EXPECTED.returnPC) throw Error('wrong-return');
      if (stack.readUInt32LE(4) !== EXPECTED.status) throw Error('wrong-status');
      const instruction = readGuest(event.memory, event.translate, EXPECTED.instructionVA, 6);
      if (instruction.toString('hex') !== EXPECTED.instructionHex) throw Error('wrong-call-instruction');
      const log = readLog(event.vfs, logPath, logCap);
      captured = freeze({ ...partial, schema: 1,
        callIdentity: { returnPC: stack.readUInt32LE(0), status: stack.readUInt32LE(4),
          instructionVA: EXPECTED.instructionVA, instructionHex: instruction.toString('hex'),
          basis: 'entry-return-plus-live-code; eip-is-retained-without-CALL-PC-claim' },
        log: { path: logPath, bytes: log.length, cap: logCap, truncated: false,
          sha256: digest(log), base64: log.toString('base64') } });
      onCapture(captured);
      if (failed) return reject(failed.reason); // sink may have attempted reentry
      return captured;
    } catch (error) {
      return reject(error.message);
    } finally { active = false; }
  }
  function finish() {
    if (active) return reject('reentrant-finalize');
    if (failed) return reject(failed.reason);
    if (!captured) return reject('missing-exit-entry');
    return freeze({ schema: 1, complete: true, captures: 1,
      stack64SHA256: captured.stack64SHA256, logSHA256: captured.log.sha256 });
  }
  return Object.freeze({ onApi, reject, finish, observation: () => captured });
}

function createFileObserver(outputDirectory, options = {}) {
  if (typeof outputDirectory !== 'string' || !path.isAbsolute(outputDirectory)) throw Error('absolute-output-directory-required');
  // A fresh directory prevents accidentally mixing two invocations' evidence.
  fs.mkdirSync(outputDirectory);
  const write = (name, data) => fs.writeFileSync(path.join(outputDirectory, name), data, { flag: 'wx', mode: 0o600 });
  const json = (name, data) => write(name, JSON.stringify(data, null, 2) + '\n');
  const observer = createObserver({ ...options,
    onCapture(record) {
      write('entry-stack64.bin', Buffer.from(record.stack64Hex, 'hex'));
      write('thpcerr.log', Buffer.from(record.log.base64, 'base64'));
      const { base64, ...log } = record.log;
      json('entry.json', { ...record, log });
    },
    onFailure(record) {
      json('failure.json', record);
      if (record.partial && !fs.existsSync(path.join(outputDirectory, 'entry-stack64.bin')))
        write('entry-stack64.bin', Buffer.from(record.partial.stack64Hex, 'hex'));
    },
  });
  return Object.freeze({ ...observer, finalize() {
    try { const verdict = observer.finish(); json('verdict.json', verdict); return verdict; }
    catch (error) { json('verdict.json', { complete: false, error: error.message }); throw error; }
  } });
}

// Replace exact anchors only after verifying the entire authentic runner.
// The transform is meant for a NEW staged copy, never the immutable donor.
function transformRunner(source) {
  if (typeof source !== 'string' || digest(source) !== RUNNER_SHA256) throw Error('runner-identity-mismatch');
  const replacements = [
    ["const fs = require('fs');", `const fs = require('fs');
const thpsExitObserver = require('../tools/thps2-exit-entry-observer.cjs').createFileObserver(process.env.THPS2_EXIT_ENTRY_OUT);
process.once('exit', () => {
  try { thpsExitObserver.finalize(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
});`],
    ['    apiCount++;', `    apiCount++;
    thpsExitObserver.onApi({ name: t, ordinal: apiCount, thread: 0,
      exports: instance.exports, memory: memory.buffer, vfs: ctx.vfs,
      translate: addr => translateGuest(addr, instance.exports.get_image_base(), memory.buffer) });`],
    ['  apiLogOff = QUIET_API &&', '  apiLogOff = false && QUIET_API &&'],
    ["const WORKER_THREADS = hasFlag('threads');", `if (hasFlag('threads')) thpsExitObserver.reject('unsupported-native-worker-logging');
const WORKER_THREADS = hasFlag('threads');`],
    ['      onCall: (name) => {', `      onCall: (name) => {
        if (name === 'ExitProcess') thpsExitObserver.reject('unsupported-worker-exit-entry');`],
  ];
  for (const [before, after] of replacements) {
    if (source.split(before).length !== 2) throw Error('runner-anchor-mismatch');
    source = source.replace(before, after);
  }
  return { source, receipt: freeze({ originalSHA256: RUNNER_SHA256,
    transformedSHA256: digest(source), replacements: replacements.length,
    scope: 'main synchronous API entry only; worker ExitProcess rejected; native workers rejected',
    finalization: 'exit-event verifies retained data only; never rereads registers/VFS' }) };
}

module.exports = { EXPECTED, REGISTERS, RUNNER_SHA256, readGuest, readLog,
  createObserver, createFileObserver, transformRunner };
