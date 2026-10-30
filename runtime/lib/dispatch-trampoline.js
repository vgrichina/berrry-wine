// The compatibility artifact's dispatch shape: a flat trampoline instead of
// nested calls. Applied to the WATX source closure whenever it is compiled
// with tailCalls:false -- by tools/build-compile-wat.js (the shipped
// build/wine-assembly.compat.wasm) and by lib/watx-launcher.js (the browser's
// source-compile fallback) -- so both produce the same module.
//
// WHY. Without wasm tail calls (iOS Safari before 18.2) the compiler lowers
// every `return_call*` to `call*; return`. One handler chain is $steps = 256
// BLOCKS, ~1000+ ops, so that shape is ~1000 nested wasm frames, each paying
// frame setup and a stack check, then unwinding all at once -- deep enough to
// overflow Node's default stack on Moorhuhn 2. The trampoline parks the next
// op in two globals and returns; one driver loop calls it. Measured 2026-09-22
// on real games, fixed work, user CPU (tools/build-dispatch-variant.js
// --variant=nested builds the old shape for this A/B):
//
//                   Moorhuhn 2   StarCraft   Diablo     (vs nested compat)
//   node 20 (V8)       -28%        -30%       -29%
//   bun 1.3 (JSC)      -50%        -49%       -50%
//
// and +12..+24% against the tail-call artifact, which stays the default
// wherever the engine has tail calls.
//
// THE EDIT, source overlay only (src/ is unchanged, the tail build never sees it):
//
//   04-cache.wat   (dispatch-next) tail:  return_call_indirect (op, fn)
//                                 becomes: $tramp_op = op; $tramp_fn = fn; return
//                  + $tramp_drive: loop { f = $tramp_fn; if f < 0: done;
//                                         $tramp_fn = -1; call_indirect (op, f) }
//   13-exports     each `(call $next)` in $run is followed by `(call $tramp_drive)`
//   07c-block-exec each fallback `call_indirect (type $handler_t)` likewise
//
// Those four sites are the ONLY non-tail entries into a handler chain (every
// other entry is a `return_call`, which compat lowers to call;return, so it
// costs at most one extra frame before the callee parks the next op and
// returns). $tramp_fn is -1 whenever no op is parked, so a chain that ends by
// plain `return` -- $steps exhausted, $th_bx_resume, a yield -- leaves the
// driver nothing to run, exactly as the nested-call shape unwinds.
//
// Every anchor is an exact string and must match the stated number of times;
// a moved source line is a hard error, never a silently different build.

(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WineDispatchTrampoline = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DRIVER = `
  ;; ---- compat dispatch trampoline (lib/dispatch-trampoline.js) ----
  (global $tramp_fn (mut i32) (i32.const -1))
  (global $tramp_op (mut i32) (i32.const 0))
  (func $tramp_drive
    (local $f i32)
    (loop $again
      (local.set $f (global.get $tramp_fn))
      (if (i32.ge_s (local.get $f) (i32.const 0))
        (then
          (global.set $tramp_fn (i32.const -1))
          (call_indirect (type $handler_t) (global.get $tramp_op) (local.get $f))
          (br $again)))))
`;

  const EDITS = [
    { file: '04-cache.wat', count: 1,
      from: '(return_call_indirect (type $handler_t) (local.get $nx_op) (local.get $nx_fn)))',
      to: '(global.set $tramp_op (local.get $nx_op))\n' +
          '    (global.set $tramp_fn (local.get $nx_fn))\n' +
          '    (return))' },
    { file: '04-cache.wat', count: 1,
      from: '  (func $next\n    (local $nx_fn i32) (local $nx_op i32)\n    (dispatch-next))\n',
      to: '  (func $next\n    (local $nx_fn i32) (local $nx_op i32)\n    (dispatch-next))\n' + DRIVER },
    { file: '13-exports.wat', count: 2,
      from: '(call $next)\n',
      to: '(call $next) (call $tramp_drive)\n' },
    { file: '07c-block-exec.wat', count: 2,
      from: '(call_indirect (type $handler_t)\n                (local.get $imm) (local.get $a))',
      to: '(call_indirect (type $handler_t)\n                (local.get $imm) (local.get $a))\n' +
          '              (call $tramp_drive)' },
  ];

  const FILES = Array.from(new Set(EDITS.map(e => e.file)));

  // One file's text with every edit for it applied. Throws on an anchor count
  // mismatch. A file with no edits comes back unchanged.
  function applyToText(file, text) {
    let out = text;
    for (const e of EDITS) {
      if (e.file !== file) continue;
      const n = out.split(e.from).length - 1;
      if (n !== e.count) {
        throw new Error(`dispatch-trampoline: ${e.file}: anchor matched ${n} time(s), ` +
          `expected ${e.count}: ${JSON.stringify(e.from)}`);
      }
      out = out.split(e.from).join(e.to);
    }
    return out;
  }

  // A compiler vfs Map keyed by the three spellings the closures use
  // ("NN.wat", "src/NN.wat", "./NN.wat"); rewritten in place, kept one text.
  function applyToVfs(vfs) {
    for (const file of FILES) {
      const text = vfs.get(file);
      if (text === undefined) throw new Error(`dispatch-trampoline: ${file} is not in the compile closure`);
      const next = applyToText(file, text);
      for (const key of [file, `src/${file}`, `./${file}`]) vfs.set(key, next);
    }
    return vfs;
  }

  return { EDITS, FILES, applyToText, applyToVfs };
});
