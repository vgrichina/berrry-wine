'use strict';
// Isolated-closure WAT fixtures: a partial module assembled from the production
// functions reachable from a test's roots.
//
//   closure({real, roots, seams, excluded}) -> {selected, traps}
//     `real` names source files (src/...) and/or single functions whose
//     production bodies are compiled as they are. Every other production
//     function the closure reaches becomes an exact-signature (unreachable)
//     trap, so a path outside the test's claim fails loudly instead of being
//     faked. `seams` are the test's own declared stand-ins.
//   supply(moduleText) -> WAT text
//     The production declarations the assembled text names but does not
//     declare itself: globals (and what their initializers name), (layout ...)
//     forms, and regions. Regions become region.declare-fixed blocks of their
//     production size, packed downward from `regionTop` in the fixture memory.
//
// Supplying declarations generically is what keeps these fixtures alive as
// production grows: a new global, layout or region read on an already-covered
// path is the same declaration production has, not a new hand-written stub.
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', '..', 'src');

// One balanced s-expression starting at `start`. Strings honor backslash
// escapes; `;;` line comments are skipped.
function form(s, start) {
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (c === ';' && s[i + 1] === ';') { const nl = s.indexOf('\n', i); if (nl < 0) break; i = nl; continue; }
    if (c === '"') {
      for (i++; i < s.length && s[i] !== '"'; i++) if (s[i] === '\\') i++;
      continue;
    }
    if (c === '(') depth++;
    else if (c === ')' && --depth === 0) return s.slice(start, i + 1);
  }
  throw new Error('unterminated form at ' + start);
}

// Matches of `re` that are not inside a `;;` comment on their line.
function* codeMatches(s, re) {
  for (const m of s.matchAll(re)) {
    const lineStart = s.lastIndexOf('\n', m.index) + 1;
    if (!s.slice(lineStart, m.index).includes(';;')) yield m;
  }
}

let cached = null;
function sourceIndex() {
  if (cached) return cached;
  const funcs = new Map(), fileOf = new Map(), globals = new Map(), layouts = new Map(), regions = new Map();
  for (const name of fs.readdirSync(SRC).filter(n => n.endsWith('.wat')).sort()) {
    const file = 'src/' + name, s = fs.readFileSync(path.join(SRC, name), 'utf8');
    for (const m of codeMatches(s, /\(func (\$[\w?]+)/g)) {
      if (funcs.has(m[1])) continue;
      funcs.set(m[1], form(s, m.index)); fileOf.set(m[1], file);
    }
    for (const m of codeMatches(s, /\(global (\$\w+)[\s)]/g)) if (!globals.has(m[1])) globals.set(m[1], form(s, m.index));
    for (const m of codeMatches(s, /\(layout ([A-Za-z_]\w*)\b/g)) if (!layouts.has(m[1])) layouts.set(m[1], form(s, m.index));
    for (const m of codeMatches(s, /\(region\.declare(?:-fixed|-derived)? (\$\w+)/g)) {
      if (regions.has(m[1])) continue;
      const f = form(s, m.index), num = k => { const x = f.match(new RegExp('\\(' + k + ' (0x[0-9A-Fa-f]+|\\d+)\\)')); return x ? Number(x[1]) : null; };
      regions.set(m[1], { size: num('size'), align: num('align') || 16 });
    }
  }
  return (cached = { funcs, fileOf, globals, layouts, regions });
}

const signatureOf = (name, body) =>
  body.slice(name.length + 6).replace(/^\s*\(export "[^"]*"\)/, '').match(/^(\s*\((?:param|result)[^)]*\))*/)[0];

function closure({ real, roots, seams = new Map(), excluded = new Set(),
  // Supplied by the fixture itself (imports or its own definitions).
  passthrough = ['$g2w', '$w2g', '$heap_alloc', '$heap_free', '$host_gpu_gl_call'] }) {
  const { funcs, fileOf } = sourceIndex();
  const realFiles = new Set(real.filter(r => r.startsWith('src/')));
  const realFuncs = new Set(real.filter(r => r.startsWith('$')));
  const selected = new Map(), traps = new Map();
  function visit(n) {
    if (selected.has(n) || traps.has(n) || seams.has(n) || passthrough.includes(n)) return;
    const s = funcs.get(n);
    if (!s && (n.startsWith('$handle_') || n.startsWith('$dispatch_api_table_page_'))) {
      const count = n === '$handle_fallback' ? 2 : n.startsWith('$dispatch_api_table_page_') ? 7 : 6;
      traps.set(n, `(func ${n} (param ${Array(count).fill('i32').join(' ')}) (unreachable))`); return;
    }
    if (!s) throw new Error('missing production signature ' + n);
    const isReal = realFuncs.has(n) || realFiles.has(fileOf.get(n));
    if (!isReal || excluded.has(n) || (n.startsWith('$handle_') && !roots.includes(n)) ||
        (n.startsWith('$dispatch_api_table_page_') && !roots.includes(n))) {
      traps.set(n, `(func ${n} ${signatureOf(n, s)} (unreachable))`); return;
    }
    selected.set(n, s);
    for (const m of s.matchAll(/\(call (\$[\w?]+)/g)) {
      try { visit(m[1]); } catch (e) { throw new Error(e.message + ' <- ' + n); }
    }
  }
  roots.forEach(n => { if (funcs.has(n)) visit(n); });
  return { selected, traps };
}

function supply(text, { regionTop = 0x3fd000, regionFloor = 0x100000 } = {}) {
  const { globals, layouts, regions } = sourceIndex();
  const declared = re => new Set([...text.matchAll(re)].map(m => m[1]));
  const ownGlobals = declared(/\(global (\$\w+)[\s)]/g);
  const ownLayouts = declared(/\(layout ([A-Za-z_]\w*)\b/g);
  const ownRegions = declared(/\(region\.declare(?:-fixed|-derived|-span)? (\$\w+)/g);
  const outGlobals = new Map(), outLayouts = new Map(), wantRegions = new Set();
  let pending = [text];
  while (pending.length) {
    const next = [];
    for (const t of pending) {
      for (const m of t.matchAll(/\(global\.(?:get|set) (\$\w+)\)?/g)) {
        const n = m[1];
        if (ownGlobals.has(n) || outGlobals.has(n)) continue;
        if (!globals.has(n)) throw new Error('fixture names unknown global ' + n);
        outGlobals.set(n, globals.get(n)); next.push(globals.get(n));
      }
      for (const [n, f] of layouts) {
        if (ownLayouts.has(n) || outLayouts.has(n)) continue;
        if (new RegExp('\\b' + n + '\\b').test(t)) { outLayouts.set(n, f); next.push(f); }
      }
      for (const m of t.matchAll(/\(region\.(?:addr|size|end|floor) (\$\w+)/g)) {
        if (!ownRegions.has(m[1]) && m[1] !== '$DIRECT_WINDOW') wantRegions.add(m[1]);
      }
    }
    pending = next;
  }
  // Regions: production size and alignment, placed below the fixture's own.
  const out = [];
  let top = regionTop;
  for (const n of [...wantRegions].sort()) {
    const r = regions.get(n);
    if (!r || !r.size) throw new Error('fixture names region ' + n + ' with no declared size');
    const base = Math.floor((top - r.size) / r.align) * r.align;
    if (base < regionFloor) throw new Error(`fixture region ${n} (0x${r.size.toString(16)}) does not fit above 0x${regionFloor.toString(16)}`);
    out.push(`(region.declare-fixed ${n} (base 0x${base.toString(16)}) (size 0x${r.size.toString(16)}) (align 0x${r.align.toString(16)}))`);
    top = base;
  }
  return [...out, ...outLayouts.values(), ...outGlobals.values()].join('\n');
}

module.exports = { form, sourceIndex, closure, supply };
