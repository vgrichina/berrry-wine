#!/usr/bin/env node
'use strict';

// Two build-speed changes that must not change a byte, checked against the
// definitions they replaced:
//
//   1. compile(..., { facts: true }) — the WATX pass-1 facts. Opt-in, read-only:
//      the binary with facts on is the binary with facts off, and the facts say
//      what the module actually contains (declarations as lowered, the export
//      surface with resolved targets and signatures, function/global index
//      spaces, data segments, regions as allocated).
//   2. tools/protected-writer-entries.js — the one-pass charCode scanner. Its
//      parse() must return the exact token tree of the regex tokenizer it
//      replaced, and protectClosure() must emit the exact text the old one did
//      for every file that carries an export (and leave every other file's text
//      alone, which the old one only padded with a trailing comment).
//      deriveProtectedClosure() must refuse an overlay that touches an
//      export-bearing form, and a protected closure mutated after the fact must
//      stop counting as protected.

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const watx = require('../tools/watx.js');
const pwe = require('../tools/protected-writer-entries.js');
const { compileClosure, prepareClosure, overlayClosure } = require('../tools/watx-closure.js');

let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks++; };
const eq = (a, b, msg) => { assert.deepStrictEqual(a, b, msg); checks++; };

// ── 1. facts ────────────────────────────────────────────────────────────────
const moduleSource = `
(memory 4 4)
(region.declare-fixed $TABLE (base 0x1000) (size 0x100) (owner "fixture:$t"))
(enum Kind (A 1) (B 2))
(layout Pair (field lo i32) (field hi u16) (field pad u8 2))
(layout-union Obj (tag kind Kind)
  (prefix (field handle i32) (field kind i32))
  (variant ObjA (tag-value A) (field a i32))
  (variant ObjB (tag-value B) (field b0 i32) (field b1 i32)))
(global $counter (mut i32) (i32.const 7))
(global $TABLE_BASE i32 (region.addr $TABLE 16))
(data (i32.const 0x2000) "hello")
(func $add (export "add") (param $x i32) (param $y i32) (result i32)
  (i32.add (local.get $x) (local.get $y)))
(func $bump (export "bump") (global.set $counter (i32.add (global.get $counter) (i32.const 1))))
(export "counter" (global $counter))
(export "memory" (memory 0))`;
const opts = { mode: 'production', standardWat: true, runtimeBuiltins: false, tailCalls: true };
const plain = watx.compile(moduleSource, new Map(), opts);
const withFacts = watx.compile(moduleSource, new Map(), { ...opts, facts: true });
ok(plain.success, plain.error);
ok(withFacts.success, withFacts.error);
eq(Buffer.from(withFacts.wasmBinary), Buffer.from(plain.wasmBinary), 'facts must not change the binary');
ok(plain.facts === undefined, 'facts are opt-in');
// Plain data all the way down: nothing a JSON round trip would drop or change.
(function plainData(v, where) {
  const tag = Object.prototype.toString.call(v);
  if (v === null || typeof v === 'string' || typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v))) return;
  ok(tag === '[object Array]' || tag === '[object Object]', `facts value at ${where} is ${tag}`);
  for (const [k, x] of Object.entries(v)) plainData(x, `${where}.${k}`);
})(withFacts.facts, 'facts');
// The compiler runs in its own vm realm; compare as data.
const f = JSON.parse(JSON.stringify(withFacts.facts));
const decl = (type, name) => f.declarations.find(d => d.type === type && d.name === name);
eq(decl('layout-lowered', 'Pair').fields.map(x => [x.name, x.offset, x.size]), [['lo', 0, 4], ['hi', 4, 2], ['pad', 6, 2]]);
eq(decl('layout-lowered', 'Pair').totalSize, 8);
eq(decl('enum-lowered', 'Kind').members, { A: 1, B: 2 });
const u = decl('union-lowered', 'Obj');
eq(u.variants.map(v => [v.name, v.tagValues]), [['ObjA', [1]], ['ObjB', [2]]]);
eq(u.tagField.offset, 4);
eq(decl('layout-lowered', 'ObjB').fields.find(x => x.name === 'b1').offset, 12);
const exp = Object.fromEntries(f.exports.map(e => [e.name, e]));
eq([exp.add.kind, exp.add.target, exp.add.params, exp.add.results], ['func', '$add', ['i32', 'i32'], ['i32']]);
eq([exp.bump.target, exp.bump.params, exp.bump.results], ['$bump', [], []]);
eq([exp.counter.kind, exp.counter.target], ['global', '$counter']);
eq(exp.memory.kind, 'memory');
// Export order is the export section's order.
const instance = new WebAssembly.Instance(new WebAssembly.Module(withFacts.wasmBinary));
eq(f.exports.map(e => e.name), Object.keys(instance.exports));
eq(f.functions.map(x => [x.name, x.index, x.paramNames]), [['$add', 0, ['$x', '$y']], ['$bump', 1, []]]);
const g = Object.fromEntries(f.globals.map(x => [x.name, x]));
eq(g.$counter.init, { kind: 'const', value: 7 });
eq(g.$TABLE_BASE.init, { kind: 'region', op: 'region.addr', region: '$TABLE', value: 0x1010 });
eq(instance.exports.counter.value, 7);
ok(f.data.some(d => d.offset === 0x2000 && d.size === 5), 'explicit data segment recorded');
eq(f.regions.regions.find(r => r.name === '$TABLE').base, 0x1000);
eq(f.memory.min, 4);

// ── 2. the protection scanner against the definitions it replaced ───────────
// The previous implementation, verbatim apart from formatting: a regex per
// character, a full token tree, every file parsed twice and rewritten.
function legacyParse(source) {
  const tokens = [];
  let i = 0;
  while (i < source.length) {
    if (/\s/.test(source[i])) { i++; continue; }
    if (source.startsWith(';;', i)) { const end = source.indexOf('\n', i); i = end < 0 ? source.length : end; continue; }
    if (source.startsWith('(;', i)) {
      let depth = 1; i += 2;
      while (i < source.length && depth) {
        if (source.startsWith('(;', i)) { depth++; i += 2; } else if (source.startsWith(';)', i)) { depth--; i += 2; } else i++;
      }
      if (depth) throw Error('unterminated WAT comment');
      continue;
    }
    const start = i;
    if ('()'.includes(source[i])) i++;
    else if (source[i] === '"') {
      i++;
      while (i < source.length && source[i] !== '"') { if (source[i] === '\\') i++; i++; }
      if (i === source.length) throw Error('unterminated WAT string');
      i++;
    } else while (i < source.length && !/[\s()]/.test(source[i])) i++;
    tokens.push({ atom: source.slice(start, i), start, end: i });
  }
  let cursor = 0;
  function node() {
    const token = tokens[cursor++];
    if (!token || token.atom === ')') throw Error('invalid WAT form');
    if (token.atom !== '(') return token;
    const items = [];
    while (cursor < tokens.length && tokens[cursor].atom !== ')') items.push(node());
    if (cursor === tokens.length) throw Error('unclosed WAT form');
    return { items, start: token.start, end: tokens[cursor++].end };
  }
  const forms = [];
  while (cursor < tokens.length) forms.push(node());
  return forms;
}
const head = n => n.items && n.items[0] && n.items[0].atom;
const atom = n => n && n.atom;
const DECL = new Set(['export', 'param', 'result', 'local', 'type']);
const RO = new Set(['global.get', 'local.get', 'i32.const', 'i64.const', 'f32.const', 'f64.const', 'i32.load',
  'i32.load8_u', 'i32.load8_s', 'i32.load16_u', 'i32.load16_s', 'i64.load', 'f32.load', 'f64.load', 'i32.add',
  'i32.sub', 'i32.mul', 'i32.and', 'i32.or', 'i32.xor', 'i32.shl', 'i32.shr_u', 'i32.shr_s', 'i32.eq', 'i32.ne',
  'i32.eqz', 'i32.lt_u', 'i32.le_u', 'i32.gt_u', 'i32.ge_u', 'select', 'i32.wrap_i64', 'i64.extend_i32_u',
  'region.addr', 'region.end', 'region.size']);
const pure = n => !n.items || (RO.has(head(n)) && n.items.slice(1).every(pure));
function legacyProtect(closure) {
  const vfs = new Map(closure.vfs), inventory = [], seen = new Set();
  const included = [...closure.source.matchAll(/\(include\s+"([^"]+)"\s*\)/g)].map(m => m[1]);
  const definitions = new Map(), external = [], normalization = new Map();
  for (const file of included) for (const form of legacyParse(vfs.get(file))) {
    if (head(form) === 'func' && atom(form.items[1])?.startsWith('$')) definitions.set(atom(form.items[1]), { file, form });
    if (head(form) === 'export' && head(form.items[2]) === 'func') external.push({ file, form });
  }
  const addEdit = (file, e) => { if (!normalization.has(file)) normalization.set(file, []); normalization.get(file).push(e); };
  for (const { file, form } of external) {
    const target = definitions.get(atom(form.items[2].items[1]));
    addEdit(file, { start: form.start, end: form.end, text: '' });
    addEdit(target.file, { start: target.form.items[1].end, end: target.form.items[1].end, text: ' (export ' + atom(form.items[1]) + ')' });
  }
  for (const [file, edits] of normalization) {
    let text = vfs.get(file);
    for (const e of edits.sort((a, b) => b.start - a.start)) text = text.slice(0, e.start) + e.text + text.slice(e.end);
    vfs.set(file, text);
  }
  let serial = 0;
  for (const file of included) {
    const source = vfs.get(file), edits = [], wrappers = [];
    for (const form of legacyParse(source)) {
      if (head(form) === 'export') { inventory.push({ file, name: 'memory', policy: 'external-memory-requires-exclusive-controller' }); continue; }
      if (head(form) !== 'func') continue;
      const inline = form.items.filter(n => head(n) === 'export');
      if (!inline.length) continue;
      const id = serial++, originalName = atom(form.items[1]);
      const target = originalName && originalName.startsWith('$') ? originalName : '$protected_impl_' + id;
      if (target !== originalName) edits.push({ start: form.items[0].end, end: form.items[0].end, text: ' ' + target });
      const params = [], results = [];
      for (const field of form.items) {
        if (head(field) === 'param') params.push(...field.items.slice(1).map(atom).filter(s => !s.startsWith('$')));
        if (head(field) === 'result') results.push(...field.items.slice(1).map(atom));
      }
      const body = form.items.slice(originalName && originalName.startsWith('$') ? 2 : 1).filter(n => !DECL.has(head(n)));
      const observer = body.length > 0 && body.every(n => n.items && pure(n));
      for (const e of inline) {
        const quoted = atom(e.items[1]), name = JSON.parse(quoted);
        seen.add(name);
        let policy = observer ? 'structural-read-only' : 'reject-before-entry';
        if (name === 'set_rep_store_step') policy = 'explicit-arm-disarm';
        edits.push({ start: e.start, end: e.end, text: '' });
        const signature = params.map(t => ' (param ' + t + ')').join('') + results.map(t => ' (result ' + t + ')').join('');
        const guard = policy === 'reject-before-entry' ? '(if (global.get $rep_store_step) (then (unreachable)))' : '';
        wrappers.push(`(func (export ${quoted})${signature}\n ${guard}\n (call ${target}${params.map((_, i) => ' (local.get ' + i + ')').join('')}))`);
        inventory.push({ file, name, target, params, results, policy });
      }
    }
    let out = source;
    for (const e of edits.sort((a, b) => b.start - a.start)) out = out.slice(0, e.start) + e.text + out.slice(e.end);
    out += '\n;; Protected external entry wrappers; internal calls retain their targets.\n' + wrappers.join('\n') + '\n';
    for (const key of [file, 'src/' + file, './' + file]) vfs.set(key, out);
  }
  return { vfs, inventory };
}
const TRAILER = '\n;; Protected external entry wrappers; internal calls retain their targets.\n\n';

// Tokenizer edge cases: nested block comments, comment markers inside strings
// and atoms, escaped quotes, a non-ASCII space, parens in strings and comments.
const tricky = [
  '(module (; a (; nested ;) comment ;) (func $a;;b (param i32)) ;; tail ( \n)',
  '(data (i32.const 0) "a ( \\" ;; (; b") (func $x (result i32) (i32.const 1))',
  '(func $f (export "f") (; (export "no") ;) "s)" (i32.const 0x1_0))\n;; (export "x")\n',
  '(a) (b (c (d))) atom-at-top (e "unicode   sep")',
];
for (const t of tricky) eq(pwe.parse(t), legacyParse(t), `parse(${JSON.stringify(t).slice(0, 40)})`);
for (const file of ['04-cache.wat', '13-exports.wat', '00-regions.wat']) {
  const text = fs.readFileSync(path.join(__dirname, '..', 'src', file), 'utf8');
  eq(pwe.parse(text), legacyParse(text), `parse(src/${file}) matches the legacy token tree`);
}
for (const bad of ['(a', ')', '(a "x', '(; open']) {
  let a, b;
  try { pwe.parse(bad); } catch (e) { a = e.message; }
  try { legacyParse(bad); } catch (e) { b = e.message; }
  eq(a, b, `same refusal for ${JSON.stringify(bad)}`);
}

const runtimeFiles = {
  'state.wat': '(global $rep_store_step (mut i32) (i32.const 0))\n(global $v (mut i32) (i32.const 1))\n',
  'api.wat': [
    ';; banner "with (parens)" and (export "decoy")',
    '(func (export "set_rep_store_step") (param i32) (global.set $rep_store_step (local.get 0)))',
    '(func $read (export "read") (result i32) (global.get $v)) (; (export "nope") ;)',
    '(func $write (param $x i32) (global.set $v (local.get $x)))',
    '(export "write" (func $write))',
    '(func (export "anon") (export "anon2") (param $p i32) (param i64) (result i32) (call $helper) (local.get 0))',
    '(func $helper)',
  ].join('\n'),
  'plain.wat': '(func $quiet (param i32) (drop (local.get 0)))\n(func $other)\n',
};
const runtime = { entry: 'src/main.watx', source: Object.keys(runtimeFiles).map(f => `(include "${f}")`).join('\n'), vfs: new Map() };
for (const [f, text] of Object.entries(runtimeFiles)) for (const k of [f, `src/${f}`, `./${f}`]) runtime.vfs.set(k, text);
const fresh = pwe.protectClosure(runtime), legacy = legacyProtect(runtime);
eq(fresh.protectedEntryInventory, legacy.inventory, 'same inventory and policies');
for (const f of Object.keys(runtimeFiles)) {
  const expect = legacy.vfs.get(f);
  if (expect.endsWith(TRAILER) && runtimeFiles[f] + TRAILER === expect) {
    ok(fresh.vfs.get(f) === runtime.vfs.get(f), `${f} has nothing to wrap and keeps its identical text`);
  } else {
    eq(fresh.vfs.get(f), expect, `${f} protected text is byte-identical to the legacy output`);
  }
}
const compiledFresh = compileClosure(fresh, { tailCalls: true });
const compiledAgain = compileClosure(runtime, { tailCalls: true });
ok(compiledFresh.success, compiledFresh.error);
eq(Buffer.from(compiledFresh.wasmBinary), Buffer.from(compiledAgain.wasmBinary), 'prepared closure compiles to the same bytes');
const e = new WebAssembly.Instance(new WebAssembly.Module(compiledFresh.wasmBinary)).exports;
e.set_rep_store_step(1);
assert.throws(() => e.write(5), WebAssembly.RuntimeError); checks++;
eq(e.read(), 1);

// Protection is identity plus an exact snapshot, never a copyable property.
ok(pwe.isProtectedClosure(fresh) && prepareClosure(fresh) === fresh, 'a sealed closure is reused as is');
ok(!pwe.isProtectedClosure({ ...fresh }), 'a copy is not protected');
const tampered = pwe.protectClosure(runtime);
tampered.vfs.set('api.wat', runtimeFiles['api.wat']);
ok(!pwe.isProtectedClosure(tampered), 'mutating the vfs after protection unseals it');
ok(prepareClosure(tampered) !== tampered, 'and compileClosure protects it again');

// An overlay on a protected closure may edit bodies, never an export-bearing form.
const bodyEdit = overlayClosure(fresh, vfs => {
  for (const k of ['plain.wat', 'src/plain.wat', './plain.wat']) vfs.set(k, vfs.get(k).replace('(func $other)', '(func $other (nop))'));
  return vfs;
});
ok(pwe.isProtectedClosure(bodyEdit), 'a body-only overlay stays protected');
ok(bodyEdit.vfs.get('api.wat') === fresh.vfs.get('api.wat'), 'untouched files keep their string identity');
assert.throws(() => overlayClosure(fresh, vfs => {
  vfs.set('api.wat', vfs.get('api.wat').replace('(then (unreachable))', '(then (nop))'));
  return vfs;
}), /export surface/); checks++;
assert.throws(() => overlayClosure(fresh, vfs => {
  vfs.set('plain.wat', vfs.get('plain.wat') + '\n(func (export "sneak"))');
  return vfs;
}), /export surface/); checks++;
assert.throws(() => overlayClosure(fresh, vfs => { vfs.set('new.wat', ''); return vfs; }), /added a source/); checks++;

console.log(`watx-compiler-facts: ${checks} checks passed`);
