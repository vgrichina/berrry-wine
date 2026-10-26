'use strict';

// OFFLINE opt-in transform. No compilation, instantiation or runner changes.
// Composes the accepted select hook; never modifies its input files/artifacts.
const { createHash } = require('node:crypto');
const select = require('./maelstrom-select-completion-hook.cjs');
const sha = b => createHash('sha256').update(b).digest('hex');
const PINS = Object.freeze({ ...select.PINS,
  'src/03-registers.wat': '79af81b863df64afd86e3ee885df99639e44d8876d2add77dc6011e487b1610d',
  'src/04-cache.wat': '42297da850a44dcaa41a6a94924eb1236b73a10c9b4dde4423802ea8d0806dbd',
  'src/07-decoder.wat': 'fec7b2413c972eca6ce666cd5300308047cdc08f7ca6a4542edfea98f02a3837',
  'src/02-thread-table.wat': 'e6b800c4df6b687bb7cf9769cacf85b3f5a6243dab04f6bc7999a826d68e2426',
  'src/07c-block-exec.wat': '5c4b4227b656ddcb919825c5942ce109bf6ea21b95b739a7bf5173d032e55e95',
  'src/07d-uop-engine.wat': 'cda6aabb3efd8e8f123887315c71747566c166721564e6a01e090224a6cf5fb3',
});
const UOP_PINS = Object.freeze({
  'src/07e-uop-compiler.wat': 'e8b1a88655d6cf6bf206ef30c5af0e1a710951cc20986d423202eb51784b7fd3',
});
const BINARY_PINS = Object.freeze({
  net: '46ccbb7e5982e2c15421af7dd4fa29b26841d9731c31a86cf9554c90be53af95',
  crt: '887eb5ce93edb7192ca3e9220f07f9ca0f94db02af5862ebcbdfcb852db99fd1',
  exe: '0eca5703e512d33c5e5a0bc1a27f14bd3aa4ecddded6e09b4d4019c2f27a15e5',
});
const FIELDS = Object.freeze(['status', 'event', 'token', 'thread', 'regs', 'pre', 'post',
  'selectRet', 'parks', 'result', 'nativeEntry', 'callBlock', 'sourceBlock', 'pc',
  'esp', 'eax', 'ebp', 'errno', 'caller', 'socketSet', 'timeout']);
// Separate from captured errno/caller fields. Zero means no completion diagnostic.
// Stable ABI: first failing predicate in the existing mne_complete guard order.
const REJECTION_REASONS = Object.freeze({ 1: 'code16', 2: 'block-exec', 3: 'uop',
  4: 'select-return', 5: 'phase', 6: 'completions', 7: 'fault', 8: 'active', 9: 'capped' });
const DIAGNOSTIC_FIELDS = Object.freeze(['rejectReason', 'rejectModes', 'rejectExpectedRet',
  'rejectObservedRet', 'rejectPhase', 'rejectCompletions', 'rejectFault', 'rejectActive', 'rejectCapped']);
// These VAs are hypotheses until verifyBinaries binds every consumed byte.
const NET_ANCHORS = Object.freeze({
  0x100012b0: '81ec1401000033c9538b9c241c0100005556', // locals + EBX/EBP/ESI
  0x100012ef: '57', // fourth saved register: EDI
  0x100012f2: '8b3d10200010',
  0x10001362: '8be8ffd783380474a2',
  0x1000139c: '8bc55e5d5b81c414010000c3',
});
// Original PE guest mapping, already required by the binary/loaded-image
// verifiers. These are not allocator-selected emulator memory region bases.
// Keep the return predicate and its host decoder on this same pinned mapping.
const NET_LAYOUT = Object.freeze({ preferredBase: 0x10000000,
  loadedBase: 0x7a2000, selectReturnVA: 0x10001362 });
const SELECT_RETURN = NET_LAYOUT.loadedBase + NET_LAYOUT.selectReturnVA - NET_LAYOUT.preferredBase;
function once(s, a, b) {
  if (s.split(a).length !== 2) throw Error('missing/ambiguous exact anchor: ' + a.slice(0, 80));
  return s.replace(a, b);
}
function pe(b) {
  if (!Buffer.isBuffer(b) || b.length < 0x100) throw Error('PE bytes required');
  const p = b.readUInt32LE(0x3c), o = p + 24;
  if (b.toString('hex', p, p + 4) !== '50450000' || b.readUInt16LE(o) !== 0x10b) throw Error('PE32 required');
  const base = b.readUInt32LE(o + 28), n = b.readUInt16LE(p + 6), size = b.readUInt16LE(p + 20);
  function offset(va, len) {
    const hits = [];
    for (let i = 0; i < n; i++) {
      const s = o + size + i * 40, rva = b.readUInt32LE(s + 12), rawSize = b.readUInt32LE(s + 16);
      const d = va - base - rva, raw = b.readUInt32LE(s + 20);
      if (d >= 0 && d + len <= rawSize && raw + d + len <= b.length) hits.push(raw + d);
    }
    if (hits.length !== 1) throw Error('missing/ambiguous PE span');
    return hits[0];
  }
  function check(va, hex) {
    const v = Buffer.from(hex, 'hex'), at = offset(va, v.length);
    if (!b.subarray(at, at + v.length).equals(v)) throw Error('native byte anchor ' + va.toString(16));
  }
  function string(rva) {
    const at = offset(base + rva, 1), end = b.indexOf(0, at);
    if (end < at || end - at > 128) throw Error('bounded import name');
    offset(base + rva, end - at + 1);
    return b.toString('ascii', at, end);
  }
  function u32(rva) { return b.readUInt32LE(offset(base + rva, 4)); }
  function imported(iat) {
    let rva = b.readUInt32LE(o + 104);
    for (let i = 0; i < 64; i++, rva += 20) {
      const name = u32(rva + 12); if (!name) break;
      const first = u32(rva + 16), lookup = u32(rva) || first, delta = iat - base - first;
      if (delta >= 0 && delta < 4096 && delta % 4 === 0) {
        const v = u32(lookup + delta);
        if (!v || v & 0x80000000) throw Error('named native import required');
        return [string(name), string(v + 2)];
      }
    }
    throw Error('native import absent');
  }
  return { base, offset, check, imported };
}
function verifyBinaries(binaries) {
  for (const [name, pin] of Object.entries(BINARY_PINS))
    if (!Buffer.isBuffer(binaries[name]) || sha(binaries[name]) !== pin) throw Error('binary pin: ' + name);
  const net = pe(binaries.net), crt = pe(binaries.crt), exe = pe(binaries.exe);
  if (net.base !== NET_LAYOUT.preferredBase || crt.base !== 0x78000000) throw Error('preferred base');
  for (const [va, hex] of Object.entries(NET_ANCHORS)) net.check(Number(va), hex);
  if (JSON.stringify(net.imported(0x10002010)) !== '["MSVCRT.dll","_errno"]') throw Error('authentic native errno import');
  crt.check(0x7800c430, 'e82274ffff83c008c3'); // _getptd(); add eax,8; ret
  exe.check(0x40e125, 'e8c253000083c40885c0756e');
  return Object.freeze({ successor: NET_LAYOUT.loadedBase + (0x10001366 - net.base),
    selectRet: SELECT_RETURN, frame: 0x114 + 4 * 4,
    crtEntryRva: 0x7800c430 - crt.base, crtTailRva: 0x7800c435 - crt.base,
    crtRetRva: 0x7800c438 - crt.base });
}
const c = n => `(i32.const ${n})`, g = n => `(global.get $mne_${n})`;
const set = (n, x) => `(global.set $mne_${n} ${x})`;
const m = n => `(global.get $msc_${n})`;
const reg = n => `(i32.load offset=${n} (global.get $reg_base))`;
const eq = (a, b) => `(i32.eq ${a} ${b})`, ne = (a, b) => `(i32.ne ${a} ${b})`;
const any = xs => xs.reduce((a, b) => `(i32.or ${a} ${b})`, c(0));
const reject = `${set('status', c(5))} (return)`;
const check = x => `(if ${x} (then ${reject}))`;
function storage(a, crtBase, uopNativeBoundaries = false) {
  const modeFlags = ['code16', 'block_exec_enabled', 'uop_enabled'].map(n => ne(`(global.get $${n})`, c(0)));
  const modeBits = any(modeFlags.map((flag, i) => `(i32.shl ${flag} ${c(i)})`));
  const completionChecks = [...modeFlags,
    ne(m('ret'), c(a.selectRet)), ne(m('phase'), c(3)), ne(m('completions'), c(1)),
    ne(m('fault'), c(0)), ne(m('active'), c(0)), ne(m('capped'), c(0))];
  // Preserve the original rejection ABI for every ineligible completion.
  // Only the exact otherwise-valid UOP=1 route can pass predicate 3.
  if (uopNativeBoundaries) completionChecks[2] = `(i32.and ${modeFlags[2]} ${any([
    ne('(global.get $uop_enabled)', c(1)), ...completionChecks.filter((_, i) => i !== 2)])})`;
  const completionReject = reason => [set('rejectReason', c(reason)), set('rejectModes', modeBits),
    set('rejectExpectedRet', c(a.selectRet)), set('rejectObservedRet', m('ret')),
    ...['phase', 'completions', 'fault', 'active', 'capped'].map(n =>
      set('reject' + n[0].toUpperCase() + n.slice(1), m(n))), reject].join('\n  ');
  const modes = any(['code16', 'block_exec_enabled'].map(n => ne(`(global.get $${n})`, c(0))).concat(
    uopNativeBoundaries ? [ne('(global.get $uop_enabled)', g('uopMode'))] : [modeFlags[2]]));
  const startModes = uopNativeBoundaries ? any([modeFlags[0], modeFlags[1],
    '(i32.gt_u (global.get $uop_enabled) (i32.const 1))']) : modes;
  const callPC = uopNativeBoundaries ? `(i32.and ${ne('(global.get $eip)', c(a.selectRet))}
    ${any([ne(g('uopMode'), c(1)), ne('(global.get $eip)', c(a.successor - 2))])})` : ne('(global.get $eip)', c(a.selectRet));
  const returnPC = uopNativeBoundaries ? `(i32.and ${ne('(local.get $source)', c(crtBase + a.crtTailRva))}
    ${any([ne(g('uopMode'), c(1)), ne('(local.get $source)', c(crtBase + a.crtRetRva))])})` : ne('(local.get $source)', c(crtBase + a.crtTailRva));
  const owner = any([ne('(global.get $current_thread_id)', g('thread')), ne('(global.get $reg_base)', g('regs'))]);
  const stale = any([ne(m('token'), g('token')), ne(m('phase'), c(3)), ne(m('completions'), c(1)),
    ne(m('active'), c(0)), ne(m('fault'), c(0)), ne(m('capped'), c(0)),
    ne(m('pre'), g('pre')), ne(m('post'), g('post')), ne(m('ret'), g('selectRet')),
    ne(m('result'), g('result')), ne(m('thread'), g('thread')), ne(m('regs'), g('regs'))]);
  const wa = ga => `(call $mne_wa ${ga} ${c(4)})`;
  return (uopNativeBoundaries ? `(global $mne_uopMode (mut i32) ${c(0)})\n` : '') +
    [...FIELDS, ...DIAGNOSTIC_FIELDS].map(n => `(global $mne_${n} (mut i32) ${c(0)})`).join('\n') + '\n' +
    [...FIELDS, ...DIAGNOSTIC_FIELDS].map(n => `(func (export "mne_${n}") (result i32) ${g(n)})`).join('\n') + `
;; Status: 0 inert, 1 awaiting select, 2 completed, 3 native call, 4 captured,
;; 5 rejected. No reset. Event 3 means completion -> authentic CALL -> RET.
(func (export "mne_start")
  (if ${ne(g('status'), c(0))} (then (return)))
  ${check(startModes)}
  ${check(any([ne(m('started'), c(0)), ne(m('token'), c(0))]))}
  ${uopNativeBoundaries ? set('uopMode', '(global.get $uop_enabled)') : ''}
  ${set('status', c(1))} (call $msc_begin_for_mne))
${uopNativeBoundaries ? `(func $mne_uop_switch (param $on i32)
  (if (i32.and (i32.and (i32.ge_u ${g('status')} ${c(1)})
                        (i32.le_u ${g('status')} ${c(3)}))
                ${ne('(local.get $on)', g('uopMode'))})
    (then ${set('status', c(5))})))` : ''}
;; Direct-window only. NEVER call g2w/gl32: their miss/lazy paths can write,
;; raise or execute callbacks. Unsupported mapping is a rejection, not errno 0.
(func $mne_wa (param $ga i32) (param $len i32) (result i32)
  (local $wa i32) (local $last i32)
  (if (i32.or (i32.lt_u (local.get $ga) ${c('0x10000')})
              (i32.gt_u (local.get $ga) (i32.sub ${c('0xffffffff')} (local.get $len))))
    (then (return ${c(-1)})))
  (local.set $wa (i32.add (i32.sub (local.get $ga) (global.get $image_base)) (global.get $GUEST_BASE)))
  (if (i32.or (i32.lt_u (local.get $wa) (global.get $GUEST_BASE))
              (i32.gt_u (local.get $wa) (i32.sub (region.end $DIRECT_WINDOW) (local.get $len))))
    (then (return ${c(-1)})))
  (local.set $last (i32.sub (i32.add (local.get $wa) (local.get $len)) ${c(1)}))
  (if (i32.ge_u (i32.shr_u (local.get $last) ${c(16)}) (memory.size))
    (then (return ${c(-1)})))
  (local.get $wa))
(func $mne_complete
  (if ${ne(g('status'), c(1))} (then (return)))
  ${uopNativeBoundaries ? check(ne('(global.get $uop_enabled)', g('uopMode'))) : ''}
  ;; Scalar-only first rejection; status guard makes this immutable after status 5.
  ${completionChecks.map((predicate, i) => `(if ${predicate} (then ${completionReject(i + 1)}))`).join('\n  ')}
  ${['token', 'thread', 'regs', 'pre', 'post', 'parks', 'result'].map(n => set(n, m(n))).join('\n  ')}
  ${set('selectRet', m('ret'))} ${set('event', c(1))} ${set('status', c(2))})
(func $mne_call (param $ret i32) (param $target i32) (param $reg i32)
  (if (i32.or (i32.lt_u ${g('status')} ${c(2)}) (i32.gt_u ${g('status')} ${c(3)})) (then (return)))
  (if ${owner} (then (return)))
  ;; A second owner CALL r while awaiting the native return is not this call.
  ${check(ne(g('status'), c(2)))}
  ${check(any([modes, stale, ne('(local.get $ret)', c(a.successor)),
    ne('(local.get $target)', c(crtBase + a.crtEntryRva)), ne('(local.get $reg)', c(7)),
    callPC, ne(reg(16), g('post')), ne(reg(20), g('result'))]))}
  ${set('nativeEntry', '(local.get $target)')} ${set('callBlock', '(global.get $eip)')}
  ${set('event', c(2))} ${set('status', c(3))})
(func $mne_return (param $source i32)
  (local $errno_wa i32) (local $caller_wa i32)
  (if (i32.or (i32.lt_u ${g('status')} ${c(2)}) (i32.gt_u ${g('status')} ${c(3)})) (then (return)))
  (if ${owner} (then (return)))
  ${check(any([modes, stale]))}
  ;; Nested CRT returns are permitted only below the invocation's post ESP.
  ;; Returning to/releasing this frame without the owned native call rejects.
  (if (i32.lt_u ${reg(16)} ${g('post')}) (then (return)))
  ${check(any([ne(g('status'), c(3)), ne('(global.get $eip)', c(a.successor)),
    returnPC, ne(reg(16), g('post')),
    ne(reg(20), g('result')), ne(reg(28), g('nativeEntry')),
    '(i32.gt_u ' + reg(16) + ' ' + c('0xfffffecf') + ')']))}
  (local.set $errno_wa ${wa(reg(0))})
  (local.set $caller_wa (call $mne_wa (i32.add ${reg(16)} ${c(a.frame)}) ${c(12)}))
  ${check(any([eq('(local.get $errno_wa)', c(-1)), eq('(local.get $caller_wa)', c(-1))]))}
  ${set('sourceBlock', '(local.get $source)')} ${set('pc', '(global.get $eip)')}
  ${set('esp', reg(16))} ${set('eax', reg(0))} ${set('ebp', reg(20))}
  ${set('errno', '(i32.load (local.get $errno_wa))')}
  ${set('caller', '(i32.load (local.get $caller_wa))')}
  ${set('socketSet', '(i32.load offset=4 (local.get $caller_wa))')}
  ${set('timeout', '(i32.load offset=8 (local.get $caller_wa))')}
  ${set('event', c(3))} ${set('status', c(4))})
`;
}
function transform(sources, options = {}) {
  if (options.enabled !== true) return sources; // Inert: no pins/options inspected.
  const uopNativeBoundaries = options.uopNativeBoundaries === true;
  const input = {};
  for (const [p, pin] of Object.entries({ ...PINS, ...(uopNativeBoundaries ? UOP_PINS : {}) })) {
    // Read once: accessors/proxies may return a different value on every read.
    // Validate and compose precisely this captured, immutable string.
    const source = sources[p];
    if (typeof source !== 'string' || sha(source) !== pin) throw Error('source pin: ' + p);
    input[p] = source;
  }
  const a = verifyBinaries(options.binaries);
  const base = options.crtLoadedBase;
  if (!Number.isInteger(base) || base < 0x10000 || base % 0x1000 || base > 0x7fff0000)
    throw Error('explicit future native CRT loaded base required');
  const out = { ...input, ...select.transform(input, { enabled: true }) };
  if (uopNativeBoundaries) {
    // UOP CALL is push+jump; RET is guarded pop+jump. They bypass th_call_r /
    // th_ret. Decline just these pinned instructions through uc_unsup BEFORE
    // lowering, so existing side exits execute real threaded CALL/RET. UOP
    // stays enabled; no flag, yield, register, stack or budget is modified.
    // Unconditional within this opt-in generated module, including warmup:
    // no previously compiled trace can conceal either observation boundary.
    const anchor = '(i32.store (local.get $R) (local.get $addr))';
    out['src/07e-uop-compiler.wat'] = once(input['src/07e-uop-compiler.wat'], anchor,
      anchor + `\n    (if (i32.or (i32.eq (local.get $addr) ${c(a.successor - 2)})
        (i32.eq (local.get $addr) ${c(base + a.crtRetRva)}))
      (then (call $uc_unsup (local.get $R)) (return)))`);
    const switchAnchor = '(global.set $uop_enabled (i32.ne (local.get $on) (i32.const 0)))';
    out['src/07d-uop-engine.wat'] = once(input['src/07d-uop-engine.wat'], switchAnchor,
      '(call $mne_uop_switch (i32.ne (local.get $on) (i32.const 0)))\n    ' + switchAnchor);
  }
  let w = out['src/09d-winsock.wat'];
  // Give the existing start export a callable internal name; behavior unchanged.
  w = once(w, '(func (export "msc_start")', '(func $msc_begin_for_mne (export "msc_start")');
  w = once(w, '(global.set $msc_phase (local.get $phase)))',
    '(global.set $msc_phase (local.get $phase))\n  (if (i32.eq (local.get $phase) (i32.const 3)) (then (call $mne_complete))))');
  out['src/09d-winsock.wat'] = w + '\n;; Opt-in native errno successor latch.\n' + storage(a, base, uopNativeBoundaries);
  let core = out['src/06b-core-handlers.wat'];
  const target = '(local.set $target (i32.load (i32.add (global.get $reg_base) (i32.shl (local.get $reg) (i32.const 2)))))';
  core = once(core, target, target + '\n    (call $mne_call (local.get $op) (local.get $target) (local.get $reg))');
  out['src/06b-core-handlers.wat'] = core;
  let alu = out['src/05-alu.wat'];
  const start = alu.indexOf('(func $th_ret (param $op i32)'), end = alu.indexOf('(func $th_ret_imm ', start);
  if (start < 0 || end < start) throw Error('plain RET bounds');
  let ret = alu.slice(start, end);
  ret = once(ret, '(call $th_ret_guard16)',
    '(local $mne_source i32)\n    (local.set $mne_source (global.get $eip))\n    (call $th_ret_guard16)');
  ret = once(ret, '(return_call $branch_end)',
    '(call $mne_return (local.get $mne_source))\n    (return_call $branch_end)');
  out['src/05-alu.wat'] = alu.slice(0, start) + ret + alu.slice(end);
  return out;
}
module.exports = { transform, verifyBinaries, PINS, UOP_PINS, BINARY_PINS, FIELDS, DIAGNOSTIC_FIELDS, REJECTION_REASONS, NET_ANCHORS, NET_LAYOUT, SELECT_RETURN, pe, once, storage };

if (require.main === module) {
  const fs = require('node:fs'), path = require('node:path');
  const [mode, configPath, output] = process.argv.slice(2);
  if (process.argv.length !== 5 || mode !== '--enable-exact-native-latch')
    throw Error('usage: --enable-exact-native-latch CONFIG.json NEW_FRAGMENT_DIRECTORY');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const sources = Object.fromEntries(Object.keys({ ...PINS, ...(config.uopNativeBoundaries === true ? UOP_PINS : {}) })
    .map(p => [p, fs.readFileSync(path.join(config.sourceRoot, p), 'utf8')]));
  const binaries = { net: fs.readFileSync(path.join(config.originalRoot, 'SDL_net.dll')),
    exe: fs.readFileSync(path.join(config.originalRoot, 'Maelstrom.exe')), crt: fs.readFileSync(config.crt) };
  const result = transform(sources, { enabled: true, binaries, crtLoadedBase: config.crtLoadedBase,
    uopNativeBoundaries: config.uopNativeBoundaries === true });
  fs.mkdirSync(output); // Fail if it exists; never overwrite accepted artifacts.
  for (const p of ['src/09b-dispatch.wat', 'src/09d-winsock.wat', 'src/05-alu.wat', 'src/06b-core-handlers.wat',
    ...(config.uopNativeBoundaries === true ? ['src/07d-uop-engine.wat', 'src/07e-uop-compiler.wat'] : [])])
    fs.writeFileSync(path.join(output, path.basename(p)), result[p], { flag: 'wx' });
}
