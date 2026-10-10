#!/usr/bin/env node
'use strict';
// Visual Basic 1.0 (VBRUN100.DLL) p-code decoder.
//
//   node tools/vb-pcode.js handlers <op>... [--vbrun=DLL]   operand length/kind per handler
//   node tools/vb-pcode.js decode <file> <0xOFF> [count]    decode p-code at a file offset
//   node tools/vb-pcode.js decode <dump.log> <0xLINEAR> [count] --hexdump
//                                                           ...or in a run.js dump-mem log
//
// Locating a procedure: the EXE keeps p-code in blocks VBRUN copies into
// global segments at run time, not one-to-one with file offsets, so the
// reliable start point is the live p-code pointer (ES:SI inside a handler,
// via --break on a seg-2 handler) and a dump-mem of that segment.
//
// VBRUN100 interprets p-code direct-threaded: every handler ends with
//     es: lodsw        ; next opcode word from ES:SI
//     jmp ax
// so an opcode word *is* the offset of its handler in VBRUN100 segment 2, and
// the program in the EXE is a stream of those offsets with their operands. A
// handler's operand length is how far it advances SI (es: lodsb/lodsw, inc si,
// add si) before that final fetch; this walks each handler's code to measure
// it, following near jumps and calls and both sides of every branch. A handler
// that loads SI (mov/pop/lds si) changes the p-code pointer: a jump or return.
//
// Evidence and the TicTacDrop investigation this was built for:
// docs/re-notes/wep16-tictacdp.md.

const fs = require('fs');
const path = require('path');
const { parse } = require('./ne-dump');
const { disasmAt } = require('./disasm');

const ROOT = path.join(__dirname, '..');
const DEFAULT_VBRUN = path.join(ROOT, 'test', 'binaries', 'wep16', 'WEP4', 'VBRUN100.DLL');
const INTERP_SEG = 2;

function loadInterpreter(vbrunPath) {
  const { b, h } = parse(vbrunPath);
  const seg = h.segments[INTERP_SEG - 1];
  if (!seg) throw new Error(`${vbrunPath}: no segment ${INTERP_SEG}`);
  const code = b.subarray(seg.filePos, seg.filePos + seg.length);
  return { code, length: seg.length };
}

// One decoded instruction at `off`: { off, len, text }.
function insnAt(code, off) {
  const [line] = disasmAt(code, off, off, 1, null, { bits: 16 });
  if (!line) return null;
  const m = /^([0-9a-f]{8})\s+((?:[0-9a-f]{2} )+)\s*(.*)$/.exec(line);
  if (!m) return null;
  return { off, len: m[2].trim().split(' ').length, text: m[3].replace(/\s*;.*$/, '').trim() };
}

const target = (text) => { const m = /\b0x([0-9a-f]+)$/.exec(text); return m ? parseInt(m[1], 16) : null; };

// Walk every path from `entry`. Each path ends at the dispatch (recording the
// operand bytes it consumed), at an SI load (a p-code jump), at a far exit,
// or gives up (too long / undecodable). Returns a summary of all endings.
function analyzeHandler(interp, entry, limit = 600) {
  const { code, length } = interp;
  const out = { entry, operands: new Set(), jumpOperands: new Set(), siLoad: false, exits: false, unknown: false };
  const seen = new Set();
  // `saved` holds SI values pushed with `push si`: helpers borrow SI for
  // string work and restore it with `pop si`, which is not a p-code jump.
  const work = [{ pc: entry, si: 0, stack: [], saved: [], steps: 0 }];
  while (work.length) {
    const st = work.pop();
    const key = `${st.pc}:${st.si}:${st.stack.join(',')}:${st.saved.join(',')}:${st.borrow ? st.borrow.slot : ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (st.steps > limit || st.pc < 0 || st.pc >= length) { out.unknown = true; continue; }
    const ins = insnAt(code, st.pc);
    if (!ins) { out.unknown = true; continue; }
    const t = ins.text;
    const next = st.pc + ins.len;
    const go = (pc, si = st.si, stack = st.stack, saved = st.saved) =>
      work.push({ pc, si, stack, saved, steps: st.steps + 1 });
    // The dispatch: es: lodsw ; jmp ax.
    if (/^es: lodsw$/.test(t)) {
      const n = insnAt(code, next);
      if (n && n.text === 'jmp ax') { out.operands.add(st.si); continue; }
      go(next, st.si + 2); continue;
    }
    // Segment overrides do not change what an instruction does to SI.
    const u = t.replace(/^(es|cs|ss|ds): /, '');
    if (u === 'push si') { go(next, st.si, st.stack, [...st.saved, st.si]); continue; }
    if (u === 'pop si' && st.saved.length) {
      go(next, st.saved[st.saved.length - 1], st.stack, st.saved.slice(0, -1)); continue;
    }
    // Saving SI to memory hands it to other work (the call-frame setup does
    // this): SI arithmetic and loads mean nothing for the p-code until the
    // same slot is loaded back.
    let mm = /^mov (?:word )?\[(0x[0-9a-f]+)\], si$/.exec(u);
    if (mm && !st.borrow) { go(next, st.si, st.stack, st.saved); work[work.length - 1].borrow = { slot: mm[1], si: st.si }; continue; }
    if (st.borrow) {
      mm = /^mov si, (?:word )?\[(0x[0-9a-f]+)\]$/.exec(u);
      const keep = (pc) => { go(pc); work[work.length - 1].borrow = st.borrow; };
      if (mm && mm[1] === st.borrow.slot) { go(next, st.borrow.si); continue; }
      if (/^(es: )?lodsw$/.test(t) && insnAt(code, next)?.text === 'jmp ax') { out.unknown = true; continue; }
      if (/^ret\b/.test(u) && st.stack.length) {
        go(st.stack[st.stack.length - 1], st.si, st.stack.slice(0, -1)); work[work.length - 1].borrow = st.borrow; continue;
      }
      if (/^(retf|ret far|iret|jmp far)/.test(u) || (/^ret\b/.test(u))) { out.exits = true; continue; }
      if (/^jmp (short )?0x[0-9a-f]+$/.test(u)) { keep(target(u)); continue; }
      if (/^j[a-z]+ (short )?0x[0-9a-f]+$/.test(u)) { keep(target(u)); keep(next); continue; }
      if (/^call 0x[0-9a-f]+$/.test(u)) { go(target(u), st.si, [...st.stack, next]); work[work.length - 1].borrow = st.borrow; continue; }
      if (/^jmp /.test(u)) { out.unknown = true; continue; }
      keep(next); continue;
    }
    if (/^lodsb$/.test(u)) { go(next, st.si + 1); continue; }
    if (/^lodsw$/.test(u)) { go(next, st.si + 2); continue; }
    if (/^inc si$/.test(u)) { go(next, st.si + 1); continue; }
    if (/^dec si$/.test(u)) { go(next, st.si - 1); continue; }
    let m = /^(add|sub) (?:word )?si, (-?0x[0-9a-f]+|-?\d+)$/.exec(u);
    if (m) { const v = parseInt(m[2], m[2].includes('0x') ? 16 : 10); go(next, st.si + (m[1] === 'add' ? v : -v)); continue; }
    // Any other write to SI moves the p-code pointer: a jump, call or return.
    if (/^(mov si,|pop si|lds si,|les si,|lea si,|xchg (si, \w+|\w+, si)|(add|sub|adc|sbb|or|and|xor) (word )?si, )/.test(u)) {
      out.siLoad = true;
      // Bytes this path consumed before leaving; a load *from* [si] reads the
      // target word too, so the operand is that much longer.
      out.jumpOperands.add(st.si + (/si, \[si\]$/.test(u) ? 2 : 0));
      continue;
    }
    if (/^(retf|ret far|iret|jmp far|jmp \w+:|jmp (dword|far) )/.test(t)) { out.exits = true; continue; }
    if (/^ret\b/.test(t)) {
      if (!st.stack.length) { out.exits = true; continue; }
      go(st.stack[st.stack.length - 1], st.si, st.stack.slice(0, -1)); continue;
    }
    if (/^jmp (short )?0x[0-9a-f]+$/.test(t)) { go(target(t)); continue; }
    if (/^j[a-z]+ (short )?0x[0-9a-f]+$/.test(t) || /^loop\w* /.test(t) || /^jcxz /.test(t)) {
      go(target(t)); go(next); continue;
    }
    if (/^call 0x[0-9a-f]+$/.test(t)) { go(target(t), st.si, [...st.stack, next]); continue; }
    if (/^jmp /.test(t)) { out.unknown = true; continue; }   // other indirect jumps
    go(next);
  }
  return out;
}

// The operand length the decoder steps over: the fall-through (dispatch)
// length when one exists, else the bytes a jump-only handler consumed.
function describe(a) {
  const ops = [...a.operands].sort((x, y) => x - y);
  const jops = [...a.jumpOperands].sort((x, y) => x - y);
  const use = ops.length ? ops : jops;
  const kind = use.length ? (use.length === 1 ? `${use[0]}` : `var(${use.join('/')})`) : '-';
  const flags = [a.siLoad && 'jump', a.exits && 'exit', a.unknown && '?'].filter(Boolean).join(',');
  return { ops: use, kind, flags };
}

// Decode p-code words from buf at off. Handler analyses are cached in `cache`.
function decode(interp, buf, off, count, cache = new Map()) {
  const rows = [];
  let p = off;
  for (let i = 0; i < count && p + 2 <= buf.length; i++) {
    const op = buf.readUInt16LE(p);
    if (op >= interp.length) { rows.push({ off: p, op, bad: 'not a handler offset' }); break; }
    if (!cache.has(op)) cache.set(op, analyzeHandler(interp, op));
    const a = cache.get(op);
    const d = describe(a);
    if (!d.ops.length && !a.siLoad && !a.exits) { rows.push({ off: p, op, bad: 'no dispatch reached' }); break; }
    const len = d.ops.length ? d.ops[d.ops.length - 1] : 0;
    const operands = [];
    for (let k = 0; k + 2 <= len; k += 2) operands.push(buf.readUInt16LE(p + 2 + k));
    if (len % 2) operands.push(buf[p + 2 + len - 1]);
    rows.push({ off: p, op, len, operands, kind: d.kind, flags: d.flags });
    p += 2 + len;
  }
  return rows;
}

const hex = (n, w = 4) => n.toString(16).padStart(w, '0');

// A run.js `dump-mem`/`--dump` log ("  0xADDR  b0 b1 ..." lines) as one
// buffer addressed by linear address: returns { buf, base }.
function loadHexdump(file) {
  const bytes = new Map();
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = /^\s*0x([0-9a-f]+)\s+((?:[0-9a-f]{2} ){1,16})/.exec(line);
    if (!m) continue;
    const at = parseInt(m[1], 16);
    m[2].trim().split(' ').forEach((x, i) => bytes.set(at + i, parseInt(x, 16)));
  }
  if (!bytes.size) throw new Error(`${file}: no hexdump lines`);
  const base = Math.min(...bytes.keys());
  const buf = Buffer.alloc(Math.max(...bytes.keys()) - base + 1);
  for (const [a, v] of bytes) buf[a - base] = v;
  return { buf, base };
}

function main() {
  const argv = process.argv.slice(2);
  const opt = (name, def) => { const a = argv.find(x => x.startsWith(`--${name}=`)); return a ? a.split('=')[1] : def; };
  const args = argv.filter(x => !x.startsWith('--'));
  const interp = loadInterpreter(opt('vbrun', DEFAULT_VBRUN));
  const cmd = args[0];
  if (cmd === 'decode') {
    // A file, or with --hexdump a run.js dump-mem log addressed linearly.
    let buf, base = 0;
    if (argv.includes('--hexdump')) ({ buf, base } = loadHexdump(args[1]));
    else buf = fs.readFileSync(args[1]);
    const at = parseInt(args[2], 16) - base;
    const rows = decode(interp, buf, at, parseInt(args[3] || '40', 10));
    for (const r of rows) {
      if (r.bad) { console.log(`${hex(r.off + base, 6)}  ${hex(r.op)}  ?? ${r.bad}`); continue; }
      console.log(`${hex(r.off + base, 6)}  op_${hex(r.op)}  ${r.operands.map(v => hex(v)).join(' ').padEnd(20)} ; len ${r.kind}${r.flags ? ' ' + r.flags : ''}`);
    }
    return;
  }
  if (cmd === 'handlers') {
    const ops = args.slice(1).map(x => parseInt(x, 16));
    for (const op of ops) {
      const d = describe(analyzeHandler(interp, op));
      console.log(`op_${hex(op)}  operands ${d.kind}  ${d.flags}`);
    }
    return;
  }
  console.error('Usage: node tools/vb-pcode.js handlers <OP>... | decode <file> <0xOFF> [count] | decode <dump.log> <0xLINEAR> [count] --hexdump');
  process.exit(1);
}

if (require.main === module) main();
module.exports = { loadInterpreter, analyzeHandler, decode, describe };
