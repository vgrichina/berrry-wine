#!/usr/bin/env node
'use strict';
// Execute the actual resolver AST with modeled VFS/loader boundaries. No VM,
// compilation, or x86 execution. Native callback acceptance is a separate gate.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const parser = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname,
  '../tools/watx-src/compiler-parser.js'), 'utf8'), parser);
const source = fs.readFileSync(process.argv[2] ||
  path.join(__dirname, '../src/09c9-winhelp-ui.wat'), 'utf8');
const fn = parser.parseSource(source, 'help.wat')
  .find(n => n[1] === 'func' && n[2] === '$help_routine_resolve');
assert(fn);
class Returned { constructor(value) { this.value = value; } }
function fixture({ copyFails = false, loadFails = false, noEntry = false } = {}) {
  const g = { $exe_size_of_image: 0x7000, $PE_STAGING_SIZE: 0x100000,
    $PE_STAGING: 0x90000, $next_dll_path: 0, $last_loaded_dll_index: -1 };
  const memory = new Map([[104, 200], [108, 300], [116, 0]]);
  const strings = new Map([[200, 'c:\\ew-native.dll'], [300, 'Probe']]);
  const allocated = new Set(), freed = new Set(), rows = [], events = [];
  let next = 1000, locked = false;
  function alloc(text) {
    const p = next; next += 100;
    allocated.add(p);
    if (text !== undefined) strings.set(p, text);
    return p;
  }
  function free(p) {
    assert(allocated.has(p), `free must own allocation ${p}`);
    assert(!freed.has(p), `double free ${p}`);
    freed.add(p);
  }
  function invoke(record = 100) {
    const l = { $record: record };
    for (const n of fn.slice(3)) if (n[1] === 'local') l[n[2]] = 0;
    const seq = ns => { let value; for (const n of ns) value = ev(n); return value; };
    function ev(n) {
      const op = n[1], a = n.slice(2), v = i => ev(a[i]);
      switch (op) {
        case 'param': case 'result': case 'local': return;
        case 'local.get': return l[a[0]];
        case 'global.get': return g[a[0]];
        case 'local.set': l[a[0]] = v(1); return;
        case 'global.set':
          if (a[0] === '$next_dll_path') assert(locked, 'publish path under loader lock');
          g[a[0]] = v(1); return;
        case 'i32.const': return Number(a[0]);
        case 'i32.eqz': return Number(v(0) === 0);
        case 'i32.eq': return Number(v(0) === v(1));
        case 'i32.ne': return Number(v(0) !== v(1));
        case 'i32.lt_s': return Number((v(0) | 0) < (v(1) | 0));
        case 'i32.gt_u': return Number((v(0) >>> 0) > (v(1) >>> 0));
        case 'i32.or': return v(0) | v(1);
        case 'i32.load': case 'i32.store': {
          const off = typeof a[0] === 'string' ? Number(a.shift().split('=')[1]) : 0;
          const at = ev(a[0]) + off;
          if (op === 'i32.load') return memory.get(at) || 0;
          memory.set(at, ev(a[1])); return;
        }
        case 'if': return v(0) ? seq(a[1].slice(2)) : undefined;
        case 'drop': v(0); return;
        case 'return': throw new Returned(v(0));
        case 'memory.copy': a.forEach(ev); events.push('stage'); return;
        case 'call': {
          const args = a.slice(1).map(ev);
          switch (a[0]) {
            case '$g2w': return args[0];
            case '$strlen': return strings.get(args[0]).length;
            case '$heap_alloc': return alloc();
            case '$heap_free': free(args[0]); return;
            case '$help_dup_cstring':
              assert.equal(args[1], strings.get(args[0]).length);
              return copyFails ? 0 : alloc(strings.get(args[0]));
            case '$find_loaded_dll':
              // Qualified paths cannot fall back to the export basename.
              return rows.findIndex(row => strings.get(row.path) === strings.get(args[0]));
            case '$host_fs_create_file':
              assert.equal(strings.get(args[0]), strings.get(memory.get(record + 4)));
              return 9;
            case '$host_fs_get_file_size': return 20992;
            case '$host_fs_read_file': memory.set(args[3], args[2]); return 1;
            case '$host_fs_close_handle': return 1;
            case '$dll_load_lock_begin': locked = true; return;
            case '$next_dll_addr': assert(locked); return 0x10000000;
            case '$load_dll':
              assert(locked);
              g.$last_loaded_dll_index = loadFails ? -1 : rows.length;
              if (!loadFails) rows.push({ path: g.$next_dll_path });
              g.$next_dll_path = 0; locked = false;
              events.push('load');
              return loadFails ? 0 : 0x10001000;
            case '$mark_dll_row_initialized':
              assert(args[0] >= 0, 'never initialize a rejected load');
              events.push('initialize'); return;
            case '$resolve_name_export':
              assert(args[0] >= 0);
              assert.equal(strings.get(args[1]), 'Probe');
              events.push('resolve'); return noEntry ? 0 : 0x10002000 + args[0] * 0x10000;
            default: throw Error(`unmodeled boundary ${a[0]}`);
          }
        }
        default: throw Error(`unmodeled instruction ${op}`);
      }
    }
    try { return seq(fn.slice(3)); } catch (e) {
      if (e instanceof Returned) return e.value;
      throw e;
    }
  }
  return { invoke, rows, memory, strings, freed, allocated, g, events };
}
for (const kind of ['help-ordinary', 'help-nested', 'help-timeout']) {
  const f = fixture();
  assert.equal(f.invoke(), 0x10002000, `${kind}: full-path DLL must resolve before callback`);
  assert.notEqual(f.rows[0].path, 200, 'DLL path must not alias document-owned registration');
  assert.equal(f.strings.get(f.rows[0].path), 'c:\\ew-native.dll');
  assert(!f.freed.has(f.rows[0].path), 'published row retains its path');
  assert.equal(f.allocated.size - f.freed.size, 1, 'only persistent path survives');
  assert.equal(f.invoke(), 0x10002000, 'routine cache');
  f.memory.set(116, 0);
  assert.equal(f.invoke(), 0x10002000, 'registered path reuses loaded row');
  assert.equal(f.rows.length, 1, 'no duplicate loads across siblings');
  f.strings.set(400, 'd:\\other\\ew-native.dll');
  f.memory.set(504, 400); f.memory.set(508, 300);
  assert.equal(f.invoke(500), 0x10012000, 'different full path retains distinct identity');
  assert.equal(f.rows.length, 2);
}
for (const options of [{ copyFails: true }, { loadFails: true }]) {
  const f = fixture(options);
  assert.equal(f.invoke(), 0, 'failure remains failure');
  assert.equal(f.rows.length, 0);
  assert.equal(f.g.$next_dll_path, 0);
  assert.equal(f.allocated.size, f.freed.size, 'failed path has no orphan allocation');
  assert(!f.events.includes('resolve'));
  assert(!f.events.includes('initialize'));
  assert.equal(f.memory.get(104), 200, 'registration survives failure');
}
const absent = fixture({ noEntry: true });
assert.equal(absent.invoke(), 0, 'missing export remains failure');
assert.equal(absent.memory.get(116), 0);
console.log('PASS: three scenario resolver paths, cache/reuse/distinct identity, copy/load/export negatives');
