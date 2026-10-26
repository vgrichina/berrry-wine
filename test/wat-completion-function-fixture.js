'use strict';
// Restricted, deliberately uncompiled fixture interpreter. It executes byte-exact
// production functions with explicit dependencies; it is NOT canonical Wasm proof.
const fs = require('fs');
function extract(source, name) {
  const start = source.indexOf('(func $' + name + '\n') >= 0 ? source.indexOf('(func $' + name + '\n') : source.indexOf('(func $' + name + ' ');
  if (start < 0) throw Error('missing production function ' + name);
  let depth = 0, comment = false, quote = false;
  for (let p = start; p < source.length; p++) {
    const c = source[p];
    if (comment) { if (c === '\n') comment = false; continue; }
    if (!quote && c === ';' && source[p + 1] === ';') { comment = true; continue; }
    if (c === '"' && source[p - 1] !== '\\') quote = !quote;
    if (quote) continue;
    if (c === '(') depth++;
    if (c === ')' && --depth === 0) return source.slice(start, p + 1);
  }
  throw Error('unbalanced ' + name);
}
function parse(text) {
  const tokens = text.replace(/;;[^\n]*/g, '').match(/\(|\)|[^\s()]+/g);
  let p = 0;
  function one() {
    const t = tokens[p++];
    if (t !== '(') return t;
    const a = [];
    while (tokens[p] !== ')') { if (p >= tokens.length) throw Error('unterminated'); a.push(one()); }
    p++; return a;
  }
  const a = one(); if (p !== tokens.length) throw Error('trailing'); return a;
}
function machine(functions, globals, memory, imports) {
  const dv = new DataView(memory.buffer);
  const returned = Symbol('return');
  function call(name, args = []) {
    if (imports[name]) return imports[name](...args);
    const f = functions[name]; if (!f) throw Error('unprovided dependency ' + name);
    const locals = {};
    let i = 0;
    for (const n of f.slice(2)) {
      if (n[0] === 'param') locals[n[1]] = args[i++] | 0;
      if (n[0] === 'local') locals[n[1]] = 0;
    }
    function ev(n) {
      if (!Array.isArray(n)) throw Error('unexpected atom ' + n);
      const [op, ...a] = n;
      const v = i => ev(a[i]);
      switch (op) {
        case 'param': case 'local': case 'result': return;
        case 'then': case 'else': { let r; for (const x of a) r = ev(x); return r; }
        case 'i32.const': return Number(a[0]) | 0;
        case 'local.get': return locals[a[0]];
        case 'local.set': locals[a[0]] = v(1) | 0; return;
        case 'global.get': if (!(a[0] in globals)) throw Error('global ' + a[0]); return globals[a[0]];
        case 'global.set': globals[a[0]] = v(1) | 0; return;
        case 'call': return call(a[0], a.slice(1).map(ev));
        case 'return': throw { type: returned, value: a.length ? v(0) : undefined };
        case 'if': return v(0) ? ev(a[1]) : a[2] ? ev(a[2]) : undefined;
        case 'drop': v(0); return;
        case 'i32.load': {
          const offset = typeof a[0] === 'string' ? Number(a[0].split('=')[1]) : 0;
          return dv.getInt32(ev(a[a.length - 1]) + offset, true);
        }
        case 'i32.store': {
          const offset = typeof a[0] === 'string' ? Number(a[0].split('=')[1]) : 0;
          dv.setInt32(ev(a[a.length - 2]) + offset, ev(a[a.length - 1]), true); return;
        }
        case 'i32.add': return (v(0) + v(1)) | 0;
        case 'i32.sub': return (v(0) - v(1)) | 0;
        case 'i32.and': return v(0) & v(1);
        case 'i32.eqz': return +!v(0);
        case 'i32.eq': return +(v(0) === v(1));
        case 'i32.ne': return +(v(0) !== v(1));
        case 'i32.ge_s': return +(v(0) >= v(1));
        default: throw Error('unsupported exact-function instruction ' + op);
      }
    }
    try { let r; for (const n of f.slice(2)) r = ev(n); return r; }
    catch (e) { if (e.type === returned) return e.value; throw e; }
  }
  return { call };
}
module.exports = { extract, parse, machine };
