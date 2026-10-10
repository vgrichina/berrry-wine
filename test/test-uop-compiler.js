#!/usr/bin/env node
'use strict';
// The x86 -> micro-op lowering (src/07e-uop-compiler.wat) against the threaded
// interpreter, on hand-assembled loops.
//
// Every case runs twice on one instance, at two fresh code addresses: once
// with the tier off, once with it on (the loop gets hot after 256 entries and
// the rest of it runs as a program). Registers, EIP, the five observable
// flags and the whole working buffer must come out identical. A third arm
// installs the program before the first iteration, so the lowering also runs
// from the loop's very first entry (the entry flag state is whatever the setup
// left). A case that declines or never enters is a failure too: a lowering
// that bails on everything is trivially exact.

const path = require('path');
const ROOT = path.join(__dirname, '..');
const bench = require(path.join(ROOT, 'tools', 'bench-loops.js'));

// ---- a tiny assembler: bytes, {label}, {jcc, to}, {jmp, to} (rel8) ----
function asm(items) {
  const at = new Map();
  for (let pass = 0; pass < 2; pass++) {
    let pc = 0;
    const out = [];
    for (const it of items) {
      if (typeof it === 'number') { out.push(it); pc++; continue; }
      if (Array.isArray(it)) { out.push(...it); pc += it.length; continue; }
      if (it.label) { at.set(it.label, pc); continue; }
      const t = at.get(it.to) ?? pc;
      if (it.call) {
        const r = t - (pc + 5);
        out.push(0xE8, r & 0xFF, (r >>> 8) & 0xFF, (r >>> 16) & 0xFF, (r >>> 24) & 0xFF);
        pc += 5;
        continue;
      }
      if (it.far) {
        const r = t - (pc + 6);
        out.push(0x0F, 0x80 | it.jcc, r & 0xFF, (r >>> 8) & 0xFF, (r >>> 16) & 0xFF, (r >>> 24) & 0xFF);
        pc += 6;
        continue;
      }
      const rel = t - (pc + 2);
      out.push(it.jmp ? 0xEB : 0x70 | it.jcc, rel & 0xFF);
      pc += 2;
    }
    if (pass === 1) { out.labels = at; return out; }
  }
}
const J = (cc, to) => ({ jcc: cc, to });
const JMP = (to) => ({ jmp: true, to });
const JFAR = (cc, to) => ({ jcc: cc, to, far: true });
const L = (label) => ({ label });
const CALL = (to) => ({ call: true, to });
const d32 = (v) => [v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF];
const cc = { O: 0, NO: 1, B: 2, AE: 3, Z: 4, NZ: 5, BE: 6, A: 7, S: 8, NS: 9, L: 12, GE: 13, LE: 14, G: 15 };

const N = 3000;
const BATCH = +(process.env.UOP_BATCH || 37);
const CASES = [
  {
    // NFSIII demo 0x4c5f17..0x4c5f41, with data/local addresses supplied by
    // registers. Preserve the 2000-record limit and both original branches.
    name:'movsd-nfs-record-loop',regs:{},head:'scan',
    init:a=>({edx:a.buf+1999*8,ebp:a.buf+0x18010}),
    setup:(mem,g2w,a)=>{
      const v=new DataView(mem.buffer);
      mem.fill(0,g2w(a.buf),g2w(a.buf)+16000);
      mem.fill(0,g2w(a.buf+0x18000),g2w(a.buf+0x18020));
      for(let i=0;i<2000;i++){
        v.setUint32(g2w(a.buf+i*8),i<500?a.buf+0x19000+i*4:0,true);
        v.setUint32(g2w(a.buf+i*8+4),a.buf+0x19000+i*4,true);
      }
    },
    code:[0xFC,JMP('scan'),L('link'),[0x8B,0x3A],[0x85,0xFF],J(cc.Z,'next'),
      [0x8B,0x45,0xFC],[0x89,0x38],[0x8B,0x42,0x04],[0x89,0x45,0xFC],
      L('next'),[0x83,0xEA,0x08],0x43,[0x81,0xFB,...d32(2000)],J(cc.GE,'exit'),
      L('scan'),[0x83,0x7D,0xF8,0],J(cc.NZ,'link'),[0x8D,0x7D,0xF8],[0x89,0xD6],
      0xA5,0xA5,JMP('next'),L('exit'),0xC3],
  },
  ...[
    {name:'movsd-forward',direction:0,source:0,dest:0x10000},
    {name:'movsd-backward',direction:1,source:4*N,dest:0x10000+4*N},
    {name:'movsd-overlap-forward',direction:0,source:0,dest:1},
    {name:'movsd-overlap-backward',direction:1,source:4*N+1,dest:4*N},
    // Unaligned dwords repeatedly cross page boundaries and leave windows.
    {name:'movsd-page-seams',direction:0,source:4094,dest:0x10000+4093},
  ].map(({name,direction,source,dest})=>({
    name,regs:{ecx:N},head:'l',
    init:a=>({esi:a.buf+source,edi:a.buf+dest}),
    // CMP's operand registers are overwritten by MOVSD before SETB observes
    // its flags. DEC preserves that CF. STD runs after precompilation, proving
    // the compiled program does not freeze DF from compilation time.
    code:[direction?0xFD:0xFC,L('l'),[0x39,0xFE],0xA5,[0x0F,0x92,0xC0],0x49,J(cc.NZ,'l'),0xFC,0xC3],
  })),
  // REP MOVS / REP STOS as one COPY / FILL op (07e kind 30, 07d 82/83). The
  // count is EBX masked, so it runs 0..mask elements (zero included) and the
  // pointers walk across page seams and window ends; overlap-* put the
  // destination a few bytes inside the source on the side the copy moves
  // toward, which only element order gets right (the slow arm). The stos
  // cases step EAX so dword/word values are mostly not one repeated byte.
  ...[
    {name:'rep-movsb',op:[0xF3,0xA4],mask:63},
    {name:'rep-movsw',op:[0x66,0xF3,0xA5],mask:31},
    {name:'rep-movsw-f3-66',op:[0xF3,0x66,0xA5],mask:31},
    {name:'rep-movsd',op:[0xF3,0xA5],mask:31},
    {name:'rep-movsd-back',op:[0xF3,0xA5],mask:31,df:1,init:a=>({esi:a.buf+0xF000,edi:a.buf+0x1F000})},
    {name:'rep-movsb-back',op:[0xF3,0xA4],mask:63,df:1,init:a=>({esi:a.buf+0xF000,edi:a.buf+0x1F000})},
    {name:'rep-movsb-overlap',op:[0xF3,0xA4],mask:63,init:a=>({esi:a.buf+0x100,edi:a.buf+0x103})},
    {name:'rep-movsd-overlap',op:[0xF3,0xA5],mask:31,init:a=>({esi:a.buf+0x100,edi:a.buf+0x106})},
    {name:'rep-movsd-overlap-b',op:[0xF3,0xA5],mask:31,df:1,init:a=>({esi:a.buf+0xF000,edi:a.buf+0xEFFA})},
    {name:'rep-stosb',op:[0xF3,0xAA],mask:63},
    {name:'rep-stosw',op:[0x66,0xF3,0xAB],mask:31},
    {name:'rep-stosd',op:[0xF3,0xAB],mask:31},
    {name:'rep-stosd-back',op:[0xF3,0xAB],mask:31,df:1,init:a=>({edi:a.buf+0x1F000})},
    {name:'rep-stosd-uniform',op:[0xF3,0xAB],mask:31,step:0,init:()=>({eax:0x3C3C3C3C})},
  ].map(({name,op,mask,df,init,step=0x01030507})=>({
    name,regs:{ebp:600},head:'l',init,
    code:[df?0xFD:0xFC,L('l'),[0x89,0xD9],[0x83,0xE1,mask],op,[0x83,0xC3,0x07],
          [0x05,...d32(step)],0x4D,J(cc.NZ,'l'),0xFC,0xC3],
  })),
  // --no-uop-rep: the same loop declines (and threaded code runs it).
  {name:'rep-gate-off',regs:{ebp:600},head:'l',declines:true,norep:true,
   code:[0xFC,L('l'),[0x89,0xD9],[0x83,0xE1,31],[0xF3,0xA5],[0x83,0xC3,0x07],0x4D,J(cc.NZ,'l'),0xC3]},
  // A segment override or REPNE keeps its threaded semantics: declined.
  {name:'rep-seg-declines',regs:{ebp:600},head:'l',declines:true,
   code:[0xFC,L('l'),[0x89,0xD9],[0x83,0xE1,31],[0x26,0xF3,0xA5],[0x83,0xC3,0x07],0x4D,J(cc.NZ,'l'),0xC3]},
  {
    name: 'lut8', regs: { ecx: N },
    code: [L('l'), [0x0F, 0xB6, 0x06], [0x8A, 0x04, 0x03], [0x88, 0x07], 0x46, 0x47, 0x49, J(cc.NZ, 'l'), 0xC3],
  },
  {
    // poke: a key byte early, so both paths are taken (and threaded code has
    // split its blocks at both) long before the batches are compared.
    name: 'colorkey', regs: { ecx: N },
    poke: (mem, src) => { mem[src + 3] = 0xFF; },
    code: [L('l'), [0x8A, 0x06], [0x3C, 0xFF], J(cc.Z, 's'), [0x88, 0x07], L('s'), 0x46, 0x47, 0x49, J(cc.NZ, 'l'), 0xC3],
  },
  {
    name: 'sum16-cmp-jb', regs: { ecx: 0, ebp: N, eax: 5 },
    code: [L('l'), [0x0F, 0xB7, 0x14, 0x4E], [0x01, 0xD0], 0x41, [0x39, 0xE9], J(cc.B, 'l'), 0xC3],
  },
  {
    name: 'signed-diamond', regs: { ecx: N },
    code: [L('l'), [0x8B, 0x16], [0x83, 0xEA, 0x64], J(cc.L, 'n'), [0x01, 0xD0], JMP('x'),
           L('n'), [0x29, 0xD0], L('x'), [0x83, 0xC6, 0x04], 0x49, J(cc.NZ, 'l'), 0xC3],
  },
  {
    name: 'shift-imul-8bit', regs: { ecx: N, edx: 0x12345 },
    code: [L('l'), [0x8B, 0x06], [0xC1, 0xE8, 0x03], [0x6B, 0xC0, 0x07], [0x30, 0xE0],
           [0x25, 0xFF, 0xFF, 0x00, 0x00], [0x01, 0x07], [0xD1, 0xE2], [0x83, 0xC6, 0x04],
           [0x83, 0xC7, 0x04], [0x83, 0xE9, 0x01], J(cc.NZ, 'l'), 0xC3],
  },
  {
    // dec leaves CF alone: the exit flags carry the add's carry.
    name: 'incdec-keeps-cf', regs: { ecx: N, eax: 0xFFFF0000 },
    code: [L('l'), [0x03, 0x06], 0x43, [0x83, 0xC6, 0x04], 0x49, J(cc.NZ, 'l'), 0xC3],
  },
  {
    // add sets CF, inc keeps it, jb/jae reads it: the CF-through-inc path.
    name: 'cf-across-inc', regs: { ecx: N, eax: 0x7FFFFFF0 },
    code: [L('l'), [0x03, 0x06], 0x43, J(cc.AE, 'k'), 0x47, L('k'), [0x83, 0xC6, 0x04], 0x49, J(cc.NZ, 'l'), 0xC3],
  },
  {
    // leaves the loop through a taken branch on a test.
    name: 'test-exit', regs: { ecx: N }, find: true,
    code: [L('l'), [0xF6, 0x06, 0x80], J(cc.NZ, 'f'), 0x46, 0x49, J(cc.NZ, 'l'), 0xC3, L('f'), 0xC3],
  },
  {
    name: 'word-neg-not', regs: { edi: 'end16' },
    code: [L('l'), [0x66, 0x8B, 0x06], [0x66, 0xF7, 0xD8], [0x66, 0xF7, 0xD2], [0x66, 0x01, 0xC2],
           [0x83, 0xC6, 0x02], [0x39, 0xFE], J(cc.NZ, 'l'), 0xC3],
  },
  {
    name: 'dec-jg', regs: { ecx: N },
    code: [L('l'), [0x03, 0x06], [0x83, 0xC6, 0x04], 0x49, J(cc.G, 'l'), 0xC3],
  },
  {
    name: 'abs-cdq-sar', regs: { edi: 'end32' },
    code: [L('l'), [0x8B, 0x06], [0xC1, 0xF8, 0x02], 0x99, [0x31, 0xD0], [0x29, 0xD0], [0x01, 0xC3],
           [0x83, 0xC6, 0x04], [0x39, 0xFE], J(cc.B, 'l'), 0xC3],
  },
  {
    name: 'byte-rmw', regs: { ecx: N },
    code: [L('l'), [0x8A, 0x06], [0x00, 0xD8], [0xFE, 0x07], [0x28, 0x07], 0x46, 0x47, 0x49, J(cc.NZ, 'l'), 0xC3],
  },
  {
    // flags at exit come from a cmp whose operand register changes later.
    name: 'cmp-then-clobber', regs: { ecx: N },
    code: [L('l'), [0x8B, 0x06], [0x39, 0xD0], J(cc.A, 'k'), [0x89, 0xC2], L('k'), [0x83, 0xC6, 0x04],
           [0x8D, 0x04, 0x49], 0x49, J(cc.NZ, 'l'), 0xC3],
  },
  {
    // mov to/from an absolute address (A0-A3, with and without 66): an
    // accumulator kept in memory, a byte copied, a word stored.
    name: 'moffs-accum', regs: { ecx: N },
    code: (a) => {
      const D = a.buf + 0x10100;
      return [L('l'), [0xA1, ...d32(D)], [0x03, 0x06], [0xA3, ...d32(D)],
              [0xA0, ...d32(a.buf + 0x200)], [0xA2, ...d32(D + 8)], [0x66, 0xA3, ...d32(D + 12)],
              [0x66, 0xA1, ...d32(D + 4)], [0x01, 0xC3],
              [0x83, 0xC6, 0x04], 0x49, J(cc.NZ, 'l'), 0xC3];
    },
  },
  {
    // rol/ror by an immediate and by 1, at 32, 16 and 8 bits, with CF read
    // by jb after ror and SF after an 8-bit rol (both taken about half the
    // time, so threaded code has split its blocks at both targets early),
    // and `cmp al,0x10 / ror eax,0x10 / jz` -- Indeo 4's VLC reader, where
    // the jz tests the cmp because a rotate leaves ZF/SF/PF alone. The
    // compiler declines rotates (its flag record cannot carry preserved
    // flags), so this pins that it declines and that the tier-on run still
    // matches threaded code.
    name: 'rotate-imm', regs: { ecx: N }, declines: true,
    code: [L('l'), [0x8B, 0x06], [0xC1, 0xC0, 0x05], [0x01, 0xC3], [0xC0, 0xCA, 0x03], [0xD1, 0xC8],
           J(cc.B, 'k'), 0x45, L('k'), [0x66, 0xC1, 0xC2, 0x07], [0xC0, 0xC7, 0x03], J(cc.S, 'm'), 0x47, L('m'),
           [0x3C, 0x10], [0xC1, 0xC8, 0x10], J(cc.Z, 'n'), 0x43, L('n'),
           [0x01, 0xC2], [0x83, 0xC6, 0x04], 0x49, J(cc.NZ, 'l'), 0xC3],
  },
  {
    // shl/shr/sar by CL with a random count: 0 (flags untouched) and, at
    // 8/16 bits, counts >= the width both deopt; CF and ZF are consumed.
    name: 'shift-cl-raw', regs: { ebp: N },
    code: [L('l'), [0x8B, 0x06], [0x8A, 0x4E, 0x04], [0xD3, 0xE0], J(cc.B, 'k'), 0x43, L('k'),
           [0xD3, 0xEA], [0x01, 0xC2], [0xD2, 0xFF], J(cc.Z, 'z'), 0x47, L('z'),
           [0x66, 0xD3, 0xE2], J(cc.AE, 'y'), 0x43, L('y'), [0xD3, 0x26], [0xD3, 0x3E],
           [0x83, 0xC6, 0x04], 0x4D, J(cc.NZ, 'l'), 0xC3],
  },
  {
    // 32-bit only: count 0 keeps the incoming flags, read by the jb after.
    name: 'shift-cl-32', regs: { ebp: N },
    code: [L('l'), [0x8B, 0x06], [0x8A, 0x4E, 0x04], [0x39, 0xD0], [0xD3, 0xE0], J(cc.B, 'k'), 0x43, L('k'),
           [0xD3, 0xFA], J(cc.Z, 'z'), 0x47, L('z'), [0x01, 0xC2], [0xD3, 0x2E],
           [0x83, 0xC6, 0x04], 0x4D, J(cc.NZ, 'l'), 0xC3],
  },
  {
    // the same with the count in 0..7, so the lowered path is the common one.
    name: 'shift-cl-small', regs: { ebp: N },
    code: [L('l'), [0x8B, 0x06], [0x8A, 0x4E, 0x04], [0x80, 0xE1, 0x07], [0xD3, 0xE8], J(cc.B, 'k'), 0x43, L('k'),
           [0xD2, 0xE2], J(cc.AE, 'j'), 0x47, L('j'), [0xD3, 0xF8], [0x01, 0xC2], [0xD3, 0x26],
           [0x83, 0xC6, 0x04], 0x4D, J(cc.NZ, 'l'), 0xC3],
  },
  {
    // setcc after a 32-bit cmp (its B operand overwritten between two reads),
    // an 8-bit cmp, a test, a sub and an inc, into low and high byte registers
    // and memory; setp/seto/setb-after-inc go through the record.
    name: 'setcc-forms', regs: { ecx: N },
    code: [L('l'), [0x8B, 0x06], [0x8B, 0x56, 0x04], [0x39, 0xD0],
           [0x0F, 0x92, 0xC3], [0x0F, 0x9E, 0xC7], [0x0F, 0x9F, 0x07], [0x0F, 0x95, 0xC2], [0x0F, 0x97, 0xC6],
           [0x01, 0xD8], [0x38, 0xD0], [0x0F, 0x9C, 0xC4], [0x0F, 0x93, 0x47, 0x01],
           [0x85, 0xD0], [0x0F, 0x98, 0xC3], [0x0F, 0x9D, 0xC7], [0x0F, 0x97, 0xC2], [0x0F, 0x9E, 0xC6],
           [0x0F, 0x92, 0x47, 0x02], [0x0F, 0x9A, 0xC4],
           [0x01, 0xD3], [0x29, 0xC3], [0x0F, 0x98, 0xC0], [0x0F, 0x94, 0x47, 0x03], [0x0F, 0x90, 0xC2],
           0x43, [0x0F, 0x95, 0xC4], [0x0F, 0x92, 0xC6],
           [0x01, 0xC5], [0x01, 0xD5], [0x83, 0xC6, 0x04], [0x83, 0xC7, 0x04], 0x49, J(cc.NZ, 'l'), 0xC3],
  },
  {
    // sbb r,r (the sbb eax,eax idiom), r/m,r, r,imm8, r,m, m,r, m,imm32,
    // eax,imm32, and sbb ebx,-1 whose b+CF wraps when CF is set (the
    // handlers' flag_a 0 / flag_b 1 fix-up), with CF and SF^OF read after.
    name: 'sbb-forms', regs: { ecx: N },
    code: [L('l'), [0x8B, 0x06], [0x8B, 0x56, 0x04], [0x39, 0xD0], [0x1B, 0xC0], [0x19, 0xD3],
           [0x83, 0xDD, 0x05], [0x1B, 0x56, 0x08], [0x19, 0x07], [0x81, 0x1F, ...d32(0x12345678)],
           [0x1D, ...d32(0x7FFFFFFF)], J(cc.B, 'k'), 0x43, L('k'), [0x83, 0xDB, 0xFF], J(cc.L, 'm'), 0x45, L('m'),
           [0x01, 0xC5], [0x83, 0xC6, 0x04], [0x83, 0xC7, 0x04], 0x49, J(cc.NZ, 'l'), 0xC3],
  },
  {
    // adc, the same forms: adc r,r (13 C0), r/m,r (11 D3), r,imm8 (83 /2),
    // r,m (13 /r), m,r (11 /r, a read-modify-write), m,imm32 (81 /2),
    // eax,imm32 (15), and adc ebx,-1 whose b+CF wraps when CF is set -- the
    // handlers' raw-mode record (flag_op 8, CF 1, OF 0) -- with CF and SF^OF
    // read after. Carry in is 0 and 1 about equally (the cmp on random data).
    name: 'adc-forms', regs: { ecx: N },
    code: [L('l'), [0x8B, 0x06], [0x8B, 0x56, 0x04], [0x39, 0xD0], [0x13, 0xC0], [0x11, 0xD3],
           [0x83, 0xD5, 0x05], [0x13, 0x56, 0x08], [0x11, 0x07], [0x81, 0x17, ...d32(0x92345678)],
           [0x15, ...d32(0x7FFFFFFF)], J(cc.B, 'k'), 0x43, L('k'), [0x83, 0xD3, 0xFF], J(cc.L, 'm'), 0x45, L('m'),
           [0x01, 0xC5], [0x83, 0xC6, 0x04], [0x83, 0xC7, 0x04], 0x49, J(cc.NZ, 'l'), 0xC3],
  },
  {
    // adc then sbb into memory with CF read straight off the first one (the
    // state 'G' path), OF read by jo, and the exit flags from an adc.
    name: 'adc-sbb-chain', regs: { ecx: N, eax: 0x9E3779B9 },
    code: [L('l'), [0x13, 0x06], [0x19, 0x07], J(cc.O, 'k'), 0x43, L('k'), [0x11, 0x47, 0x04],
           [0x83, 0xC6, 0x04], [0x83, 0xC7, 0x04], 0x49, J(cc.NZ, 'l'), [0x13, 0xC3], 0xC3],
  },
  {
    // jgl.dll's scaled blitter tail (SimGolf, 0x10018108): a 16.16 source
    // step, the carry out of the 16-bit fraction add taken by adc from an
    // absolute address, and ebx = count<<16 | step counted down by jns.
    name: 'adc-scale-blit', regs: { ebx: (1500 << 16) | 0xA3D7, edx: 0x1234 },
    setup: (mem, g2w, a) => { new DataView(mem.buffer).setUint32(g2w(a.buf + 0x1F000), 1, true); },
    code: (a) => [L('l'), [0x8A, 0x06], [0x88, 0x07], [0x66, 0x01, 0xDA], [0x13, 0x35, ...d32(a.buf + 0x1F000)],
                  [0x83, 0xC7, 0x02], [0x81, 0xEB, ...d32(0x10000)], J(cc.NS, 'l'), 0xC3],
  },
  // ---- the stack (07e kinds 21-24) ----
  {
    // push r / imm32 / imm8 / esp, read back through [esp+N], popped into
    // other registers: every value and the final ESP must agree.
    name: 'push-pop-forms', regs: { ecx: N },
    code: [L('l'), 0x56, [0x68, ...d32(0x12345678)], [0x6A, 0xFD], 0x54, [0x8B, 0x44, 0x24, 0x08],
           [0x01, 0xC3], 0x58, [0x29, 0xC3], 0x5A, [0x01, 0xD3], 0x58, [0x31, 0xC3], 0x5D, [0x01, 0xEB],
           [0x83, 0xC6, 0x04], 0x49, J(cc.NZ, 'l'), 0xC3],
  },
  {
    // pushad / popad (07e kind 31): the slots are written in x86 order with
    // the ESP slot holding ESP as it was, a slot changed in between comes back
    // in its register, and popad skips the ESP slot however it was rewritten.
    // (Caesar III's tile blit is wrapped in exactly this pair.)
    name: 'push-pop-all', regs: { ecx: N, eax: 0x11111111, ebx: 0x22222222, edx: 0x33333333, ebp: 0x55555555, edi: 0x77777777 },
    code: [L('l'), 0x60, [0x01, 0x74, 0x24, 0x1C], [0x01, 0x4C, 0x24, 0x10], [0x8B, 0x54, 0x24, 0x0C],
           [0x29, 0xE2], [0x01, 0x54, 0x24, 0x14], [0xC7, 0x44, 0x24, 0x0C, ...d32(0xDEAD)],
           [0x8B, 0x7C, 0x24, 0x00], [0x01, 0x7C, 0x24, 0x08], 0x61,
           [0x83, 0xC6, 0x04], 0x49, J(cc.NZ, 'l'), 0xC3],
  },
  // ---- mov-pair runs as one MCOPY (07e $uc_try_mcopy, 07d 85; §21.4) ----
  ...[
    {
      // Caesar III's tile-blit rows: mov eax,[esi+k] / mov [edi+edx+d],eax,
      // k and d stepping by 4, add edx,ecx between rows. EAX must come out
      // holding the last dword of the row, as the last load leaves it.
      name: 'mcopy-rows', regs: { ebp: 600, ecx: 16 },
      code: [L('l'), ...[0, 4, 8].map((k) => [[0x8B, 0x46, k], [0x89, 0x44, 0x17, 0x08 + k]]).flat(),
             [0x01, 0xCA], ...[12, 16, 20, 24, 28].map((k) => [[0x8B, 0x46, k], [0x89, 0x44, 0x17, 0x20 + k]]).flat(),
             [0x83, 0xC6, 0x20], 0x4D, J(cc.NZ, 'l'), 0xC3],
      want: { mcopyRuns: '>0' },
    },
    {
      // dest one dword above src through one base: only the element order
      // of the pairs (the slow arm) smears [esi] up the row.
      name: 'mcopy-overlap', regs: { ebp: 600 },
      code: [L('l'), [0x8B, 0x06], [0x89, 0x46, 0x04], [0x8B, 0x46, 0x04], [0x89, 0x46, 0x08],
             [0x8B, 0x46, 0x08], [0x89, 0x46, 0x0C], [0x83, 0xC6, 0x0D], 0x4D, J(cc.NZ, 'l'), 0xC3],
      want: { mcopyRuns: '>0', mcopySlow: '>0' },
    },
    {
      // unaligned rows walking across page seams on both sides
      name: 'mcopy-page-seams', regs: { ebp: 600 },
      init: (a) => ({ esi: a.buf + 4090, edi: a.buf + 0x10000 + 4093 }),
      code: [L('l'), ...[0, 4, 8, 12, 16, 20, 24, 28].map((k) => [[0x8B, 0x5E, k], [0x89, 0x5F, k]]).flat(),
             [0x83, 0xC6, 0x20], [0x83, 0xC7, 0x24], 0x4D, J(cc.NZ, 'l'), 0xC3],
      want: { mcopyRuns: '>0' },
    },
    {
      // not a run: the register is the next source's base, and a pair whose
      // disps do not step by 4 ends the run (two runs of 2, and singles)
      name: 'mcopy-breaks', regs: { ebp: 600 },
      code: [L('l'), [0x8B, 0x06], [0x89, 0x07], [0x8B, 0x46, 0x04], [0x89, 0x47, 0x04],
             [0x8B, 0x46, 0x0C], [0x89, 0x47, 0x08], [0x8B, 0x46, 0x10], [0x89, 0x47, 0x0C],
             [0x8B, 0x5E, 0x10], [0x89, 0x5F, 0x14], [0x83, 0xC6, 0x08], [0x83, 0xC7, 0x10], 0x4D, J(cc.NZ, 'l'), 0xC3],
      want: { mcopyRuns: '>0' },
    },
  ],
  {
    // a leaf call with an argument: the callee's ret goes back into the loop.
    name: 'call-leaf', regs: { ecx: N },
    code: [L('l'), 0x51, CALL('f'), [0x83, 0xC4, 0x04], [0x01, 0xC3], [0x83, 0xC6, 0x04], 0x49,
           J(cc.NZ, 'l'), 0xC3,
           L('f'), [0x8B, 0x44, 0x24, 0x04], [0x03, 0x06], 0xC3],
  },
  {
    // stdcall (ret 8), a prologue/epilogue, and flags set in the callee and
    // read after it returns.
    name: 'call-stdcall', regs: { ecx: N },
    code: [L('l'), 0x56, 0x51, CALL('f'), J(cc.S, 'k'), 0x43, L('k'), [0x01, 0xC3], [0x83, 0xC6, 0x04], 0x49,
           J(cc.NZ, 'l'), 0xC3,
           // eax = [arg1] ^ (arg2 << 31): the sign alternates with ecx, so
           // threaded code takes both sides of the js before the install.
           L('f'), 0x55, [0x89, 0xE5], [0x8B, 0x45, 0x0C], [0x8B, 0x00], [0x8B, 0x55, 0x08], [0xC1, 0xE2, 0x1F],
           [0x31, 0xD0], 0x5D, [0xC2, 0x08, 0x00]],
  },
  {
    // one helper called from two sites: its ret has two candidates.
    name: 'call-two-sites', regs: { ecx: N },
    code: [L('l'), [0x8B, 0x06], CALL('f'), [0x01, 0xC3], [0x8B, 0x46, 0x04], CALL('f'), [0x31, 0xC3],
           [0x83, 0xC6, 0x04], 0x49, J(cc.NZ, 'l'), 0xC3,
           L('f'), [0xC1, 0xE0, 0x03], [0x83, 0xC0, 0x07], 0xC3],
  },
  {
    // a nested call, the inner callee reached from inside the outer one.
    name: 'call-nested', regs: { ecx: N },
    code: [L('l'), [0x8B, 0x06], CALL('f'), [0x01, 0xC3], [0x83, 0xC6, 0x04], 0x49, J(cc.NZ, 'l'), 0xC3,
           L('f'), 0x50, CALL('g'), 0x5A, [0x01, 0xD0], 0xC3,
           L('g'), [0xD1, 0xE0], 0x40, 0xC3],
  },
  {
    // A rare call into a callee too big to scan (620 nops): following the
    // call hits the scan limit, so the head is compiled again with the call
    // as the region's edge -- the loop that compiled before calls were
    // followed must still compile.
    name: 'call-big-callee', regs: { ecx: N },
    code: [L('l'), [0x03, 0x06], [0x83, 0xC6, 0x04], [0xF6, 0xC1, 0x3F], J(cc.NZ, 's'), CALL('f'), L('s'), 0x49,
           J(cc.NZ, 'l'), 0xC3, L('f'), new Array(620).fill(0x90), 0xC3],
  },
  {
    // the callee returns 2 bytes past its return address (skipping an inc)
    // every other iteration: that ret's pop never matches its candidate, so
    // it must deopt to the threaded ret each time it differs.
    // The bumped return lands on ret+2, an entry threaded code splits at and
    // the compiler cannot know statically (the ret's check misses and exits
    // there), so the block-clock charge is history-dependent like a fold's;
    // state and the branch clock must still match.
    name: 'ret-mismatch', regs: { ecx: N }, dynamicEntry: true,
    code: [L('l'), [0x8B, 0x06], CALL('f'), [0x43, 0x43], 0x47, [0x83, 0xC6, 0x04], 0x49, J(cc.NZ, 'l'), 0xC3,
           L('f'), [0xA8, 0x01], J(cc.Z, 'r'), [0x83, 0x04, 0x24, 0x02], L('r'), 0xC3],
  },
];

// ---- --uop-muldiv (07e kinds 25/26, 07d MULW/SETMULF/DIVW) ----
// The flags a mul leaves are $set_flags_mul's record: CF=OF from the upper
// half, ZF/SF from EAX through whatever sign shift the previous producer left
// (an 8-bit add here, so SF reads bit 7 exactly as threaded code does).
// A raw SEH frame (no scope table, so 11-seh calls the handler for real)
// catches #DE and skips the 2-byte div: every divide that faults must leave
// the program at that div, and threaded code raises it there.
const SEH_ON = [[0x64, 0x8B, 0x1D, 0, 0, 0, 0], [0x6A, 0xFF], [0x6A, 0x00], CALL('seh_after'),
  // handler(rec, frame, ctx, disp): ctx->Eip += 2; ExceptionContinueExecution
  [0x8B, 0x44, 0x24, 0x0C], [0x83, 0x80, 0xB8, 0x00, 0x00, 0x00, 0x02], [0x31, 0xC0], 0xC3,
  L('seh_after'), 0x53, [0x64, 0x89, 0x25, 0, 0, 0, 0]];
const SEH_OFF = [[0x8B, 0x04, 0x24], [0x64, 0xA3, 0, 0, 0, 0], [0x83, 0xC4, 0x10]];
CASES.push(
  {
    // mul r/m32 with mixed upper halves (a byte times a dword), CF read by
    // jb and setb (inc preserves CF), OF by seto; imul reg and imul eax (the operand is EAX
    // itself); SF/ZF after an 8-bit shift sign; a mul whose flags are dead.
    name: 'muldiv-mul', regs: { ecx: N }, muldiv: true,
    code: [L('l'), [0x0F, 0xB6, 0x06], [0x00, 0xD3], [0xF7, 0x66, 0x04], J(cc.B, 'k'), 0x47, L('k'),
           [0x0F, 0x92, 0xC2], [0x01, 0xD5], [0x01, 0xC3], [0x0F, 0xBE, 0x46, 0x08], [0xF7, 0x6E, 0x0C], [0x0F, 0x90, 0xC2],
           [0x0F, 0x98, 0xC6], [0x01, 0xD5], [0x8B, 0x46, 0x10], [0xF7, 0xEB], [0x0F, 0x94, 0xC2],
           [0x01, 0xD3], [0x31, 0xC5], [0x8B, 0x46, 0x14], [0xF7, 0xE8], [0x8B, 0x46, 0x18], [0xF7, 0xE5],
           [0x01, 0xC3], [0x83, 0xC6, 0x04], 0x49, J(cc.NZ, 'l'), 0xC3],
  },
  {
    // div/idiv that never fault: unsigned by a register and by memory,
    // signed after cdq (negative quotients and remainders), and a cmp whose
    // flags cross all four divides to the jb (div leaves the flags alone);
    // the results accumulate through lea, which keeps them too.
    name: 'muldiv-div', regs: { ecx: N }, muldiv: true,
    code: [L('l'), [0x8B, 0x5E, 0x04], [0x83, 0xCB, 0x01], [0x39, 0xCD], [0x8B, 0x06], [0xBA, 0, 0, 0, 0],
           [0xF7, 0xF3], [0x8D, 0x2C, 0x28], [0x8D, 0x2C, 0x2A], [0xBA, 0, 0, 0, 0], [0xF7, 0x76, 0x08],
           [0x8D, 0x3C, 0x38], [0x8B, 0x46, 0x0C], 0x99, [0xF7, 0xFB], [0x8D, 0x2C, 0x2A], [0x8D, 0x3C, 0x38],
           [0x8B, 0x46, 0x14], 0x99, [0xF7, 0x7E, 0x10], [0x8D, 0x2C, 0x2A], [0x8D, 0x3C, 0x38],
           J(cc.B, 'k'), 0x45, L('k'), [0x83, 0xC6, 0x04], 0x49, J(cc.NZ, 'l'), 0xC3],
  },
  {
    // Every #DE a divide can raise, inside the loop: div by zero (a byte
    // masked to 0-7), div overflow (EDX >= divisor), idiv of the 32-bit
    // INT_MIN by -1, 0, 1 or 2, and idiv of EDX:EAX = 0x80000000:0 (the
    // 64-bit INT_MIN, which i64.div_s would trap on) by the same.
    // The handler resumes at div+2, an entry threaded code splits a block at
    // and the program does not charge (dynamicEntry, like ret-mismatch).
    name: 'muldiv-div-exits', regs: { ecx: 600 }, muldiv: true, head: 'l', dynamicEntry: true, want: { divExits: '>0' },
    // Threaded code reports a fault at the start of the block it is in
    // ($eip is the block entry), so each divide that can fault is made to
    // begin a block (a jo to the next instruction) for the handler's Eip += 2
    // to land after it in both tiers.
    code: [...SEH_ON, L('l'), [0x8B, 0x06], [0x31, 0xD2], [0x0F, 0xB6, 0x5E, 0x04], [0x83, 0xE3, 0x07], J(cc.O, 'd0'), L('d0'), [0xF7, 0xF3],
           [0x01, 0xC5], [0x01, 0xD5], [0x8B, 0x06], [0x8B, 0x56, 0x08], [0x83, 0xE2, 0x0F], [0x8B, 0x5E, 0x0C],
           [0x83, 0xE3, 0x1F], J(cc.O, 'd1'), L('d1'), [0xF7, 0xF3], [0x31, 0xC5], [0x31, 0xD5], [0xB8, 0x00, 0x00, 0x00, 0x80], 0x99,
           [0x0F, 0xB6, 0x5E, 0x05], [0x83, 0xE3, 0x03], 0x4B, J(cc.O, 'd2'), L('d2'), [0xF7, 0xFB], [0x01, 0xC5], [0x01, 0xD5],
           [0x31, 0xC0], [0xBA, 0x00, 0x00, 0x00, 0x80], J(cc.O, 'd3'), L('d3'), [0xF7, 0xFB], [0x01, 0xC5], [0x01, 0xD5],
           [0x83, 0xC6, 0x04], 0x49, J(cc.NZ, 'l'), ...SEH_OFF, 0xC3],
  },
);

// ---- --uop-icall / --uop-iat (07e FF /2 as kind 23, 07d ICG) ----
// A callee's address is only known once the code is placed, so each is put
// right after a CALL, which pushes it; the pop takes it. The "vtable" is a
// stack slot addressed through EBP (ESP-based r/m is refused), the IAT slot
// is in the scratch page, out of the hashed buffer. Code addresses differ per
// run, so every register that held one is cleared before the ret.
const CALLEE1 = [[0x03, 0x1E], [0x8D, 0x1C, 0x9B], 0xC3];            // add ebx,[esi]; lea ebx,[ebx*4+ebx]
const CALLEE2 = [[0x2B, 0x1E], [0x8D, 0x1C, 0x5B], 0xC3];            // sub ebx,[esi]; lea ebx,[ebx*2+ebx]
const ICALL_VT = [CALL('s1'), ...CALLEE1, L('s1'), [0x89, 0xE5],       // mov ebp,esp: [ebp] = &callee1
  L('l'), [0xFF, 0x55, 0x00], [0x83, 0xC6, 0x04], 0x49, J(cc.NZ, 'l'),   // call [ebp+0]
  0x58, [0x31, 0xC0], [0x31, 0xED], 0xC3];
const IAT_SLOT = (a) => a.spec + 0x800;
CASES.push(
  { name: 'icall-vtable', regs: { ecx: N }, icall: true, hotOnly: true, head: 'l', want: { icPass: '>0', icFail: 0 }, code: ICALL_VT },
  // the same loop with the flag off: FF /2 cuts it, and says so
  { name: 'icall-off', regs: { ecx: N }, head: 'l', declines: true, code: ICALL_VT },
  {
    // call reg, the register loaded once outside the loop (the add first:
    // the hot-count slot is eip>>2, and the head and the return landing
    // must not share one)
    name: 'icall-reg', regs: { ecx: N }, icall: true, hotOnly: true, head: 'l', want: { icPass: '>0', icFail: 0 },
    code: [CALL('s1'), ...CALLEE1, L('s1'), 0x58,
           L('l'), [0x83, 0xC6, 0x04], [0xFF, 0xD0], 0x49, J(cc.NZ, 'l'), [0x31, 0xC0], 0xC3],
  },
  {
    // the slot alternates between two callees: the guard fails every other
    // trip and the call runs threaded, to whichever callee the slot holds
    name: 'icall-mismatch', regs: { ecx: N }, icall: true, hotOnly: true, head: 'l', dynamicEntry: true, want: { icFail: '>0' },
    code: [CALL('s1'), ...CALLEE1, L('s1'), 0x58, CALL('s2'), ...CALLEE2, L('s2'), 0x5A, 0x50, [0x89, 0xE5],
           L('l'), 0x92, [0x89, 0x45, 0x00], [0xFF, 0x55, 0x00], [0x83, 0xC6, 0x04], 0x49, J(cc.NZ, 'l'),
           0x58, [0x31, 0xC0], [0x31, 0xD2], [0x31, 0xED], 0xC3],
  },
  {
    // the same alternating slot with the megamorphic rule at 4 fails: the
    // site is marked, the program failing there is killed on its way out,
    // and the head recompiles leaving the call to threaded code (section 23)
    name: 'icall-mega', regs: { ecx: N }, icall: true, icgMega: 4, hotOnly: true, head: 'l', dynamicEntry: true,
    want: { icFail: '>0', megaSites: '>0', megaKills: '>0', megaRef: '>0' },
    code: [CALL('s1'), ...CALLEE1, L('s1'), 0x58, CALL('s2'), ...CALLEE2, L('s2'), 0x5A, 0x50, [0x89, 0xE5],
           L('l'), 0x92, [0x89, 0x45, 0x00], [0xFF, 0x55, 0x00], [0x83, 0xC6, 0x04], 0x49, J(cc.NZ, 'l'),
           0x58, [0x31, 0xC0], [0x31, 0xD2], [0x31, 0xED], 0xC3],
  },
  {
    // and with the rule off: every guard is kept, however often it fails
    name: 'icall-poly', regs: { ecx: N }, icall: true, icgMega: 0, hotOnly: true, head: 'l', dynamicEntry: true,
    want: { icFail: '>0', megaSites: 0, megaKills: 0, megaRef: 0 },
    code: [CALL('s1'), ...CALLEE1, L('s1'), 0x58, CALL('s2'), ...CALLEE2, L('s2'), 0x5A, 0x50, [0x89, 0xE5],
           L('l'), 0x92, [0x89, 0x45, 0x00], [0xFF, 0x55, 0x00], [0x83, 0xC6, 0x04], 0x49, J(cc.NZ, 'l'),
           0x58, [0x31, 0xC0], [0x31, 0xD2], [0x31, 0xED], 0xC3],
  },
  {
    // the slot is rewritten once, from inside the loop, halfway through: the
    // guard the program was compiled with passes for the first half and
    // fails on every trip after, each failure running the call threaded to
    // the new callee (no side effect of the call happens before the guard)
    name: 'icall-rewrite', regs: { ecx: N }, icall: true, hotOnly: true, head: 'l', dynamicEntry: true,
    want: { icPass: '>0', icFail: '>0' },
    code: [CALL('s1'), ...CALLEE1, L('s1'), 0x58, CALL('s2'), ...CALLEE2, L('s2'), 0x5A, 0x50, [0x89, 0xE5],
           L('l'), [0x81, 0xF9, ...d32(N >> 1)], J(cc.NZ, 'k'), [0x89, 0x55, 0x00], L('k'),
           [0xFF, 0x55, 0x00], [0x83, 0xC6, 0x04], 0x49, J(cc.NZ, 'l'),
           0x58, [0x31, 0xC0], [0x31, 0xD2], [0x31, 0xED], 0xC3],
  },
  {
    // a C++ virtual call, `mov edx,[obj] / call [edx]`, over two objects of
    // two classes: the object (and so its vptr) swaps every 128 trips, so
    // the guarded target is right in long runs and wrong in others, and the
    // guard reads the vtable slot through the vptr each time
    name: 'icall-vptr-swap', regs: { ecx: N }, icall: true, hotOnly: true, head: 'l', dynamicEntry: true,
    want: { icPass: '>0', icFail: '>0' },
    code: [CALL('s1'), ...CALLEE1, L('s1'), 0x58, CALL('s2'), ...CALLEE2, L('s2'), 0x5A,
           0x52, [0x89, 0xE2], 0x50, [0x89, 0xE0],          // vt2 = {&c2}, vt1 = {&c1}
           0x52, [0x89, 0xE2], 0x50, [0x89, 0xE0],          // obj2 = {&vt2}, obj1 = {&vt1}
           0x52, 0x50, [0x89, 0xE5],                         // [ebp] = &obj1, [ebp+4] = &obj2
           L('l'), [0x89, 0xC8], [0xC1, 0xE8, 0x07], [0x83, 0xE0, 0x04], [0x8B, 0x44, 0x05, 0x00],
           [0x8B, 0x10], [0xFF, 0x12], [0x83, 0xC6, 0x04], 0x49, J(cc.NZ, 'l'),
           [0x83, 0xC4, 0x18], [0x31, 0xC0], [0x31, 0xD2], [0x31, 0xED], 0xC3],
  },
);
// --uop-iat: call [abs], the import-table form
CASES.push(
  {
    // call [abs] through an import slot holding a guest function
    name: 'iat-call', regs: { ecx: N }, iat: true, hotOnly: true, head: 'l', want: { iatPass: '>0', iatFail: 0 },
    code: (a) => [CALL('s1'), ...CALLEE1, L('s1'), 0x58, [0xA3, ...d32(IAT_SLOT(a))],
           L('l'), [0xFF, 0x15, ...d32(IAT_SLOT(a))], [0x83, 0xC6, 0x04], 0x49, J(cc.NZ, 'l'),
           [0x31, 0xC0], [0xA3, ...d32(IAT_SLOT(a))], 0xC3],
  },
  {
    // an import slot holding an API thunk, on a path never taken: the call
    // is refused (the thunk zone stays with the threaded code) and the loop
    // around it still compiles, with that path an exit
    name: 'iat-thunk', regs: { ecx: N }, iat: true, hotOnly: true, head: 'l', want: { icRej: '>0', iatSites: 0 },
    code: (a) => [[0xC7, 0x05, ...d32(IAT_SLOT(a)), ...d32(a.thunk)],
           L('l'), [0x83, 0xC6, 0x04], [0x03, 0x1E], [0x83, 0xF9, 0xFF], J(cc.Z, 'bad'), 0x49, J(cc.NZ, 'l'),
           [0xC7, 0x05, ...d32(IAT_SLOT(a)), 0, 0, 0, 0], 0xC3,
           L('bad'), [0xFF, 0x15, ...d32(IAT_SLOT(a))], 0xC3],
  },
);

// ---- --uop-trace-heads (07e $uc_form_trace) ----
// A head with no back edge: the loop around it runs an instruction the tier
// does not lower (bsr), so no head in it has a loop to compile, and without
// traces every one declines no-backedge. Each case runs with trace heads on in
// the hot and pre arms; `head` names the label the pre arm compiles at. `lf`
// marks a label as the logical-frame step ($th_logical_frame): the marker
// block must run threaded every time, so its count must match threaded code's.
const TRACE_F = [L('f'), [0x8B, 0x16], [0x01, 0xD3], [0x89, 0xD0], [0xC1, 0xE8, 0x05], [0x31, 0xC3],
  [0x81, 0xFA, ...d32(0x40000000)], J(cc.L, 'n'), [0x83, 0xF3, 0x55], JMP('x'), L('n'), [0x83, 0xEB, 0x03],
  L('x'), [0x83, 0xC6, 0x04], 0xC3];
const TRACE_MAIN = [L('main'), CALL('f'), [0x0F, 0xBD, 0xD3], 0x49, J(cc.NZ, 'main'), 0xC3];
CASES.push(
  { name: 'trace-callee', regs: { ecx: N }, trace: true, head: 'f', code: [JMP('main'), ...TRACE_F, ...TRACE_MAIN] },
  { name: 'trace-main', regs: { ecx: N }, trace: true, head: 'main', code: [JMP('main'), ...TRACE_F, ...TRACE_MAIN] },
  {
    // a call and its ret inside the trace (g's ret has f's call as candidate)
    name: 'trace-callchain', regs: { ecx: N }, trace: true, head: 'f',
    code: [JMP('main'), L('f'), 0x53, [0x8B, 0x1E], CALL('g'), [0x01, 0xD8], 0x5B, [0x83, 0xC6, 0x04], [0x01, 0xC3], 0xC3,
           L('g'), [0x89, 0xDA], [0xC1, 0xE2, 0x03], [0x31, 0xD0], [0x03, 0x46, 0x08], 0xC3, ...TRACE_MAIN],
  },
  { name: 'trace-logical', regs: { ecx: N }, trace: true, head: 'f', lf: 'x', lfEvery: true, code: [JMP('main'), ...TRACE_F, ...TRACE_MAIN] },
  {
    // control: a LOOP whose exit falls through into the marker block
    name: 'loop-logical', regs: { ecx: N }, head: 'top', lf: 'x',
    code: [L('top'), [0x8B, 0x16], [0x01, 0xD3], [0x83, 0xC6, 0x04], [0x81, 0xFA, ...d32(0x40000000)], J(cc.L, 'n'),
           0x49, J(cc.NZ, 'top'), 0xC3, L('n'), [0x83, 0xEB, 0x03], L('x'), [0x83, 0xF3, 0x55], 0x49, J(cc.NZ, 'top'), 0xC3],
  },
);

// ---- --aggressive-stack (07e $uc_sp_block) ----
// Each runs with the tier's aggressive stack elision on (hot and pre arms)
// against plain threaded code, and `sp` pins what the one pre-arm compile
// must count ($uop_cstat 6+i, SP_NAMES): the elision has to happen where it
// may and must not where it may not, or exactness proves nothing.
const SP_NAMES = ['pushes', 'matched', 'elided', 'plain', 'rescued', 'resc-other', 'resc-fwd-ld', 'resc-fwd-st',
  'fwd-ld', 'fwd-st', '-', 'k-unknown', 'k-ebp', 'k-partial', 'k-esp', 'k-release', 'k-callret', 'k-full',
  'unmatched', 'spills'];
const PAD = (n) => new Array(n).fill(0x90);
const AGGR_CASES = [
  {
    // rule 1, exact: reads of both open slots are forwarded from the temps
    name: 'sp-fwd-load', regs: { ecx: N }, aggr: { elided: 2, 'fwd-ld': 2, 'resc-fwd-ld': 2, 'k-unknown': 0 },
    code: [L('l'), [0x8B, 0x06], 0x50, 0x53, [0x8B, 0x54, 0x24, 0x04], [0x03, 0x14, 0x24], 0x5B, 0x58,
           [0x01, 0xD3], [0x83, 0xC6, 0x04], 0x49, J(cc.NZ, 'l'), 0xC3],
  },
  {
    // rule 1/3, no overlap: a read and a write of locals beside the slot
    name: 'sp-nonoverlap', regs: { ecx: N }, head: 18, aggr: { elided: 1, 'resc-other': 1, 'fwd-ld': 0 },
    code: [[0x83, 0xEC, 0x08], [0xC7, 0x04, 0x24, ...d32(5)], [0xC7, 0x44, 0x24, 0x04, ...d32(7)],
           L('l'), 0x56, [0x8B, 0x54, 0x24, 0x04], [0x01, 0xCA], [0x89, 0x54, 0x24, 0x08], 0x5F, [0x03, 0x1F],
           [0x01, 0xD3], [0x83, 0xC6, 0x04], 0x49, J(cc.NZ, 'l'), [0x83, 0xC4, 0x08], 0xC3],
  },
  {
    // rule 3, exact: mov [esp], edx overwrites the pushed value in the temp,
    // the read after it and the pop both see the new value
    name: 'sp-fwd-store', regs: { ecx: N }, aggr: { elided: 1, 'fwd-st': 1, 'fwd-ld': 1 },
    code: [L('l'), [0x8B, 0x06], [0x89, 0xCA], 0x50, [0x89, 0x14, 0x24], [0x03, 0x04, 0x24], 0x5A,
           [0x31, 0xC3], [0x01, 0xD3], [0x83, 0xC6, 0x04], 0x49, J(cc.NZ, 'l'), 0xC3],
  },
  {
    // partial overlap (movzx a byte of the slot) and a read-modify-write
    // (add [esp], ecx): both pushes materialize
    name: 'sp-partial-rmw', regs: { ecx: N }, aggr: { matched: 2, elided: 0, 'k-partial': 2 },
    code: [L('l'), [0x8B, 0x06], 0x50, [0x0F, 0xB6, 0x54, 0x24, 0x01], 0x58, [0x01, 0xD3],
           0x52, [0x01, 0x0C, 0x24], 0x5A, [0x01, 0xD3], [0x01, 0xC3],
           [0x83, 0xC6, 0x04], 0x49, J(cc.NZ, 'l'), 0xC3],
  },
  {
    // rule 2: a load and a store through registers that could point
    // anywhere materialize the open push, and so does an escaped address
    // written through (lea edx,[esp]; mov [edx],ecx: the pop must see ecx)
    name: 'sp-unknown-escape', regs: { ecx: N }, aggr: { matched: 3, elided: 0, 'k-unknown': 3 },
    code: [L('l'), [0x8B, 0x06], 0x50, [0x03, 0x1E], 0x58, 0x50, [0x89, 0x1F], 0x5A, [0x01, 0xD3],
           0x50, [0x8D, 0x14, 0x24], [0x89, 0x0A], 0x58, [0x01, 0xC3],
           [0x83, 0xC6, 0x04], [0x83, 0xC7, 0x04], 0x49, J(cc.NZ, 'l'), 0xC3],
  },
  {
    // add esp releases the top slot (no pop can take it), the one under it
    // still pairs; `mov esp, edx` (ESP written, same value) materializes the
    // open push, and its pop then has nothing to match
    name: 'sp-release-espw', regs: { ecx: N }, aggr: { elided: 1, unmatched: 1, 'k-esp': 0 },
    code: [L('l'), [0x8B, 0x06], 0x50, 0x52, [0x83, 0xC4, 0x04], 0x5A, [0x01, 0xD3],
           0x50, [0x89, 0xE2], [0x89, 0xD4], 0x58, [0x01, 0xC3],
           [0x83, 0xC6, 0x04], 0x49, J(cc.NZ, 'l'), 0xC3],
  },
  {
    // EBP from `mov ebp, esp` in the same block: [ebp+8] (the argument) is
    // another slot, [ebp-4] is exactly `push edi`'s -- forwarded store, then
    // a forwarded read through [esp]; push ebp / pop ebp pair around it all
    name: 'sp-ebp-frame', regs: { ecx: N }, aggr: { elided: 2, 'fwd-st': 1, 'fwd-ld': 1, 'k-ebp': 0 },
    code: [L('l'), 0x56, CALL('f'), [0x83, 0xC4, 0x04], [0x01, 0xC3], [0x01, 0xFB], [0x83, 0xC6, 0x04], 0x49,
           J(cc.NZ, 'l'), 0xC3,
           L('f'), 0x55, [0x89, 0xE5], 0x57, [0x8B, 0x7D, 0x08], [0x8D, 0x04, 0x7F], [0x89, 0x45, 0xFC],
           [0x8B, 0x04, 0x24], 0x5F, 0x5D, 0xC3],
  },
  {
    // a page seam between push and pop: with the budget gone the seam's
    // stub leaves to threaded code there, which reads both slots from
    // memory -- so the stub must spill the temps first
    name: 'sp-seam-spill', regs: { ecx: N }, pages: 2, aggr: { elided: 2, 'spills@0': 4, 'spills@1': 0 },
    code: [PAD(0xFF8), L('l'), [0x8B, 0x06], 0x50, 0x53, [0x8B, 0x54, 0x24, 0x04], [0x03, 0x14, 0x24], 0x5B, 0x58,
           [0x01, 0xD3], [0x83, 0xC6, 0x04], 0x49, J(cc.NZ, 'l'), 0xC3],
    head: 0xFF8,
  },
];
// the exact tier's stack cases again, with the aggressive tier on
for (const c of CASES.filter((x) => /^(push-pop|call-|ret-)/.test(x.name))) AGGR_CASES.push({ ...c, name: c.name + '+A', aggr: {} });
CASES.push(...AGGR_CASES);

// Real code: Heroes III's clipped RLE sprite row blitter (h3demo.exe
// 0x4708a6..0x4709a2, docs/re-notes), fed random sprites. It is the first
// program whose lowering diverged in a real run, so it stays as a fuzz case.
// Frame: [esp+10] sprite (its [+44] = data base), [+18] clip-left, [+20] width,
// [+24] row-offset cursor, [+28] rows, [+2c] run colour, [+3c] pitch,
// [+40] palette (16-bit entries at +1c), [+44] dest, [+48] "skip fills".
// A run is (colour, count-1); colour == the key byte at [0x5fa1a0] means a
// literal run whose indices follow it.
const H3_EXE = path.join(ROOT, 'test/binaries/candidates/heroes-3-demo-installer/installed-extracted/Program_Files/h3demo.exe');
function h3Cases() {
  const fs = require('fs');
  if (!fs.existsSync(H3_EXE)) return [];
  const pe = require(path.join(ROOT, 'lib', 'pe.js')).readPE(H3_EXE);
  const lo = 0x4708a6, hi = 0x4709a2;
  const code = [...pe.buf.subarray(pe.va2off(lo), pe.va2off(hi))];
  code.push(0x83, 0xC4, 0x60, 0xC3);                 // add esp,0x60 ; ret
  const out = [];
  // Its palette loop alone (head at +2, after `mov ecx,esi`). LUT_RUN's u16
  // form used to fold it, and short counts here checked that fold's clock
  // against the unfolded loop; the fold is retired to the uop tier
  // (docs/uop-tier-design.md section 18), so now the tier must match the
  // threaded run on it like any other case, at a count long enough to get hot.
  for (const cnt of [3000]) {
    out.push({
      name: `h3-lut-${cnt}`, regs: { esi: cnt, ecx: 0 }, head: 2, bytes: [...pe.buf.subarray(pe.va2off(0x470925), pe.va2off(0x47093b)), 0xC3],
      setup(mem, g2w, a) {
        const dv = new DataView(mem.buffer);
        for (let k = 0; k < 256; k++) dv.setUint16(g2w(a.buf + 0x8000 + 0x1c + 2 * k), k * 3, true);
      },
      init: (a) => ({ eax: a.buf, ebp: a.buf + 0x8000, edi: a.buf + 0x10000 }),
    });
  }
  // COPY_RUN's byte form, which MW3/MCM routes enable with --copy-superops.
  for (const cnt of [1, 5, 37, 38, 300]) {
    out.push({
      name: `copy-run-${cnt}`, regs: { ecx: cnt }, foldCheck: 'loop_copy',
      bytes: [0x8A, 0x06, 0x88, 0x07, 0x46, 0x47, 0x49, 0x75, 0xF7, 0xC3],
    });
  }
  for (let n = 0; n < (+process.env.UOP_H3_N || 12); n++) {
    let x = (n + 1) * 0x9E3779B1 >>> 0;
    const rnd = (m) => { x = (Math.imul(x ^ (x >>> 15), 0x2C1B3C6D) + 0x6D2B79F5) >>> 0; return x % m; };
    const key = 0xFF - rnd(2) * 0x7F, W = 8 + rnd(120), clip = rnd(40), rows = 4 + rnd(40);
    const skipFill = rnd(3) === 0 ? 1 : 0;
    const seed0 = x;
    out.push({
      name: `h3-rle-${n}`, regs: {}, frame: 0x60, bytes: code, mayStayCold: true, folds: true,
      setup(mem, g2w, a) {
        x = seed0;
        const dv = new DataView(mem.buffer);
        const w32 = (ga, v) => dv.setUint32(g2w(ga), v >>> 0, true);
        const B = a.buf, sprite = B + 0x100, data = B + 0x1000, pal = B + 0x8000, dst = B + 0x10000;
        mem[g2w(0x5fa1a0)] = key;
        w32(sprite + 0x44, data);
        let off = 0;
        for (let r = 0; r < rows; r++) {
          w32(B + 4 * r, off);
          for (let len = 0; len < clip + W + 1;) {
            const lit = rnd(3) === 0;
            const cnt = 1 + rnd(lit ? 12 : 30);
            let col = rnd(256); if (!lit && col === key) col ^= 1;
            mem[g2w(data + off++)] = lit ? key : col;
            mem[g2w(data + off++)] = cnt - 1;
            if (lit) for (let k = 0; k < cnt; k++) mem[g2w(data + off++)] = rnd(256);
            len += cnt;
          }
        }
        for (let k = 0; k < 256; k++) dv.setUint16(g2w(pal + 0x1c + 2 * k), Math.imul(k, 0x9E37) & 0xFFFF, true);
        const sp = a.stackTop - 0x60;
        for (let k = 0; k < 0x60; k += 4) w32(sp + k, 0);
        w32(sp + 0x10, sprite); w32(sp + 0x18, clip); w32(sp + 0x20, W); w32(sp + 0x24, B);
        w32(sp + 0x28, rows); w32(sp + 0x3c, 2 * W + 6); w32(sp + 0x40, pal);
        w32(sp + 0x44, dst); dv.setUint8(g2w(sp + 0x48), skipFill);
      },
    });
  }
  return out;
}
CASES.push(...h3Cases());

// ---- MMX (07e kind 27) ----
// Every MMX form 07-decoder lowers to 06c, compiled by the tier and compared
// with threaded code: registers, flags, memory and all eight MMn (runCase
// seeds the MMX file and main() compares it). esi walks the random source,
// edi the destination; results leave through a store and a movd into a GPR.
const MM = {
  rr: (op, d, s) => [0x0F, op, 0xC0 | (d << 3) | s],
  esi: (op, r, disp) => [0x0F, op, 0x40 | (r << 3) | 6, disp & 0xFF],           // [esi+disp8]
  edi: (op, r, disp) => [0x0F, op, 0x80 | (r << 3) | 7, ...d32(disp)],          // [edi+disp32]
  grp: (op, ext, r, imm) => [0x0F, op, 0xC0 | (ext << 3) | r, imm & 0xFF],      // 71-73 /ext ib
};
const MMX_TAIL = [MM.edi(0x7F, 0, 0), MM.rr(0x7E, 1, 0), [0x01, 0xC3],            // movq [edi],mm0; movd eax,mm1; add ebx,eax
  [0x83, 0xC6, 0x08], [0x83, 0xC7, 0x08], 0x49, J(cc.NZ, 'l'), 0xC3];
// Each op twice: mm0 op= mm1 (register form), mm1 op= [esi+16] (memory form).
const mmxOps = (ops) => [L('l'), MM.esi(0x6F, 0, 0), MM.esi(0x6F, 1, 8),
  ...ops.flatMap((op) => [MM.rr(op, 0, 1), MM.esi(op, 1, 16)]), ...MMX_TAIL];
const MMX_GROUPS = {
  'mmx-addsub': [0xFC, 0xFD, 0xFE, 0xD4, 0xF8, 0xF9, 0xFA, 0xFB],
  'mmx-sat': [0xEC, 0xED, 0xE8, 0xE9, 0xDC, 0xDD, 0xD8, 0xD9],
  'mmx-logic-cmp': [0xDB, 0xDF, 0xEB, 0xEF, 0x74, 0x75, 0x76, 0x64, 0x65, 0x66],
  'mmx-unpack-pack': [0x60, 0x61, 0x62, 0x68, 0x69, 0x6A, 0x63, 0x67, 0x6B],
  'mmx-mul-minmax': [0xD5, 0xE5, 0xE4, 0xF5, 0xDA, 0xDE, 0xEA, 0xEE, 0xE0, 0xE3],
};
for (const [name, ops] of Object.entries(MMX_GROUPS)) CASES.push({ name, regs: { ecx: N }, code: mmxOps(ops) });
// Shift by a register count (edx & 63, so in and out of every lane width's
// range) and by a memory count the loop itself stored with movq.
const MMX_SHIFT_REG = [0xD1, 0xD2, 0xD3, 0xE1, 0xE2, 0xF1, 0xF2, 0xF3];
// (A case body stays under the rel8 back edge, so the lists are split.)
for (const [k, ops] of [MMX_SHIFT_REG.slice(0, 4), MMX_SHIFT_REG.slice(4)].entries()) {
  CASES.push({
    name: `mmx-shift-count${k}`, regs: { ecx: N },
    code: [L('l'), MM.esi(0x6F, 1, 8), [0x89, 0xCA], [0x83, 0xE2, 0x3F], MM.rr(0x6E, 2, 2),
      MM.edi(0x7F, 2, 0x4000), MM.edi(ops[0], 1, 0x4000), MM.esi(ops[1], 1, 24),
      ...ops.flatMap((op) => [MM.esi(0x6F, 0, 0), MM.rr(op, 0, 2), MM.rr(0xEB, 1, 0)]),
      ...MMX_TAIL],
  });
}
// 71/72/73 immediates: psrl /2, psra /4, psll /6, counts in range, at the
// lane width, and far past it (psra saturates to the sign).
const MMX_SHIFT_IMM = [[0x71, 2, 3], [0x71, 4, 5], [0x71, 6, 15], [0x71, 2, 16], [0x71, 4, 200],
  [0x72, 2, 7], [0x72, 4, 31], [0x72, 6, 32], [0x72, 4, 33], [0x73, 2, 12], [0x73, 6, 40], [0x73, 2, 64], [0x73, 6, 255]];
for (const [k, list] of [MMX_SHIFT_IMM.slice(0, 7), MMX_SHIFT_IMM.slice(7)].entries()) {
  CASES.push({
    name: `mmx-shift-imm${k}`, regs: { ecx: N },
    code: [L('l'), MM.esi(0x6F, 0, 0), MM.esi(0x6F, 1, 8),
      ...list.flatMap(([op, ext, n]) => [MM.grp(op, ext, 0, n), MM.rr(0xFC, 1, 0), MM.esi(0x6F, 0, 0)]),
      ...MMX_TAIL],
  });
}
// The moves: movd both ways with a register and memory, movq mm,mm (6F and
// the 7F register form), movq stores, movntq, and misaligned 8-byte loads
// and stores that cross a page every 512 iterations (a straddling access
// deopts to threaded code for that instruction).
CASES.push({
  name: 'mmx-moves', regs: { ecx: N },
  code: [L('l'), MM.esi(0x6F, 0, 3), MM.esi(0x6E, 3, 4), MM.rr(0x6E, 2, 1), MM.rr(0x6F, 4, 0), MM.rr(0x7F, 5, 3),
    MM.rr(0xFE, 4, 2), MM.rr(0xFD, 5, 4), MM.edi(0x7E, 5, 0x8000), MM.edi(0xE7, 4, 0xA000), MM.edi(0x7F, 5, 5),
    MM.rr(0x7E, 4, 2), [0x31, 0xD5], MM.rr(0x6F, 1, 5), ...MMX_TAIL],
});
// ESP as a general register, the SoftDrv span-loop shape: ESP saved to an
// absolute cell, reloaded inside the loop as the end bound, compared against
// esi, and restored before ret.
const MMX_SAVE = (a) => a.buf + 0x1F000;
CASES.push({
  name: 'mmx-esp-bound', regs: { ecx: 0 }, head: 'l',
  setup: (mem, g2w, a) => new DataView(mem.buffer).setUint32(g2w(MMX_SAVE(a) + 4), a.buf + 8 * N, true),
  code: (a) => [[0x89, 0x25, ...d32(MMX_SAVE(a))],
    L('l'), [0x8B, 0x25, ...d32(MMX_SAVE(a) + 4)], MM.esi(0x6F, 0, 0), MM.esi(0xFC, 0, 8), MM.edi(0x7F, 0, 0),
    MM.rr(0x7E, 0, 0), [0x01, 0xC1], [0x83, 0xC6, 0x08], [0x83, 0xC7, 0x08], [0x39, 0xE6], J(cc.B, 'l'),
    [0x8B, 0x25, ...d32(MMX_SAVE(a))], 0xC3],
});
// The whole smackw32 Huffman symbol reader (StarCraft, 0x1000ee40), as the
// trace head it is there: refill the bit buffer mm0 from [esi] or not
// (cmp al,0x20 / ja), look the low 12 bits up, shift the buffer by the code
// length, then walk the tree one bit at a time (movd ebp,mm0 / psrlq mm0,1 /
// shr ebp,1 / jb). The tables are built so every walk stays in the buffer.
const SMK = (a) => ({ v: a.buf + 0x1F000, tbl: a.buf + 0x14000, base: a.buf + 0x18000 });
const smkSetup = (mem, g2w, a) => {
  const s = SMK(a);
  const dv = new DataView(mem.buffer);
  let x = 0x2468ACE;
  const rnd = (n) => { x = (Math.imul(x, 1103515245) + 12345) | 0; return ((x >>> 8) & 0xFFFFFF) % n; };
  for (let k = 0; k < 4096; k++) dv.setUint32(g2w(s.tbl + 4 * k), ((rnd(0x3000 / 4) * 4) << 8) | (1 + rnd(12)), true);
  for (let k = 0; k < 0x7000 / 4; k++) {
    const eq = k < 0x6800 / 4 && rnd(2);
    dv.setUint32(g2w(s.base + 4 * k), (rnd(16) << 16) | (eq ? 0x7777 : (0x7778 + rnd(0x8000))), true);
  }
  dv.setUint32(g2w(s.v), 0x15, true);            // bits left (al)
  dv.setUint32(g2w(s.v + 4), 0x7777, true);      // the tree's "internal node" word (bx)
  dv.setUint32(g2w(s.v + 8), s.tbl, true);
  dv.setUint32(g2w(s.v + 12), s.base, true);
};
const smkReader = (a) => {
  const s = SMK(a);
  const lookup = [[0x81, 0xE2, 0xFF, 0x0F, 0x00, 0x00], [0x8B, 0x0C, 0x91], [0x0F, 0x6E, 0xC9], [0x2A, 0xC1],
    [0x0F, 0xDB, 0xCD], [0xC1, 0xE9, 0x08], [0x0F, 0xD3, 0xC1], [0x03, 0x0D, ...d32(s.v + 12)], [0x8B, 0x11],
    [0x66, 0x3B, 0xDA], JFAR(cc.NZ, 'E')];
  return [[0xB8, 0x1F, 0, 0, 0], [0x0F, 0x6E, 0xE8],
    L('main'), CALL('f'), [0x0F, 0xBD, 0xD3], 0x4F, J(cc.NZ, 'main'), 0xC3,
    L('f'), [0xA0, ...d32(s.v)], [0x8B, 0x1D, ...d32(s.v + 4)], [0x3C, 0x20], J(cc.A, 'B'),
    [0x8A, 0xC8], [0x0F, 0x6F, 0x16], [0xFE, 0xC9], [0x83, 0xC6, 0x04], [0x0F, 0x6E, 0xC9], [0x0F, 0xDB, 0xCD],
    [0x0F, 0xF3, 0xD1], [0x8B, 0x0D, ...d32(s.v + 8)], [0x0F, 0xEB, 0xD0], [0x0F, 0x6F, 0xC2], [0x0F, 0x7E, 0xD2],
    [0x81, 0xE2, 0xFF, 0x0F, 0x00, 0x00], [0x04, 0x20], ...lookup.slice(1), JMP('C'),
    L('B'), [0x0F, 0x7E, 0xC2], [0x8B, 0x0D, ...d32(s.v + 8)], ...lookup,
    L('C'), [0xC1, 0xEA, 0x0D], [0xFE, 0xC8], [0x81, 0xE2, 0xF8, 0xFF, 0x0F, 0x00], [0x0F, 0x7E, 0xC5],
    [0x0F, 0x73, 0xD0, 0x01], [0xC1, 0xED, 0x01], J(cc.B, 'S'), [0xBA, 0x04, 0, 0, 0],
    L('S'), [0x03, 0xCA], [0x8B, 0x11], [0x66, 0x3B, 0xDA], J(cc.Z, 'C'),
    L('E'), [0xA2, ...d32(s.v)], [0x8B, 0xC2], [0x31, 0x05, ...d32(s.v + 16)], 0xC3];
};
// Label C is the Smacker one-bit Huffman descent that threaded code used to
// fold into one $th_smk_tree_walk (retired, docs/uop-tier-design.md section
// 18). The trace now compiles the descent; it must stay exact against the
// threaded tier running it instruction by instruction.
CASES.push({ name: 'mmx-smk-trace', regs: { edi: N }, trace: true, head: 'f', setup: smkSetup, code: smkReader });
// pmovmskb is not lowered: the loop must decline and still be exact. And
// the whole family off (--no-uop-mmx) declines the ordinary ALU loop.
CASES.push({ name: 'mmx-pmovmskb', regs: { ecx: N }, declines: true,
  code: [L('l'), MM.esi(0x6F, 0, 0), MM.rr(0xD7, 0, 0), [0x01, 0xC3], [0x83, 0xC6, 0x08], 0x49, J(cc.NZ, 'l'), 0xC3] });
// Collapse's particle blend (Collapse3.exe 0x4287f4..0x428824), its EMMS
// included: the tier used to decline the whole loop over the EMMS.
CASES.push({
  name: 'mmx-blend', regs: { ecx: N },
  code: [L('l'), MM.esi(0x6F, 2, 0), MM.edi(0x6E, 7, 0), MM.rr(0xEF, 5, 5), MM.rr(0x60, 7, 5), MM.rr(0xF9, 2, 7),
    MM.esi(0x6E, 3, 8), MM.grp(0x71, 2, 3, 1), MM.rr(0x61, 3, 3), MM.rr(0x62, 3, 3), MM.rr(0xD5, 2, 3),
    MM.grp(0x71, 4, 2, 7), MM.rr(0xFD, 2, 7), MM.rr(0x67, 2, 5), MM.edi(0x7E, 2, 0x8000),
    [0x0F, 0x77], ...MMX_TAIL],
});
CASES.push({ name: 'mmx-gate-off', regs: { ecx: N }, declines: true, nommx: true, code: mmxOps(MMX_GROUPS['mmx-addsub']) });

// Scan limit: the loop is small, but a never-taken exit leads 4KB away into
// 700 supported instructions, so the flood from the head overflows MAX_SCAN
// at the full span. The compiler must halve the span and keep the loop, the
// far code becoming a side exit (SoftDrv's unrolled rasterizer shape).
CASES.push({ name: 'span-shrink', regs: { ecx: N },
  code: [L('l'), [0x8B, 0x06], [0x01, 0xC3], [0x83, 0xC6, 0x04], [0x81, 0xF9, ...d32(0x7FFFFFFF)], JFAR(cc.Z, 'far'),
         0x49, J(cc.NZ, 'l'), 0xC3, new Array(0x1000).fill(0xCC), L('far'), new Array(700).fill(0x42), 0xC3] });

const REGS = ['eax', 'ecx', 'edx', 'ebx', 'ebp', 'esi', 'edi'];

function seed(mem, g2w, a) {
  let x = 0x1234567;
  const src = g2w(a.buf);
  for (let k = 0; k < 0x10000; k++) {
    x = (Math.imul(x, 1103515245) + 12345) | 0;
    mem[src + k] = (x >>> 16) & 0xFF;
  }
  mem[src + 2000] = 0x80 | mem[src + 2000];
  for (let k = 0; k < 1999; k++) mem[src + k] &= 0x7F;
  mem.fill(0x11, g2w(a.buf + 0x10000), g2w(a.buf + 0x10000) + 0x10000);
  const lut = g2w(a.lut);
  for (let k = 0; k < 256; k++) mem[lut + k] = (k * 7 + 3) & 0xFF;
}

function hash(mem, g2w, a) {
  let h = 0x811C9DC5;
  const s = g2w(a.buf);
  for (let k = 0; k < 0x20000; k++) h = Math.imul(h ^ mem[s + k], 16777619);
  return h >>> 0;
}

function runCase(inst, c, a, codeAddr, mode) {
  const { e, mem, g2w } = inst;
  seed(mem, g2w, a);
  if (c.poke) c.poke(mem, g2w(a.buf));
  const bytes = c.bytes || asm(typeof c.code === 'function' ? c.code(a) : c.code);
  mem.set(bytes, g2w(codeAddr));
  const labelAt = (x) => (typeof x === 'string' ? bytes.labels.get(x) : x || 0);
  // Explicit either way: trace heads are the instance default now, and a
  // loop case must keep testing the loop tier alone.
  e.set_uop_trace_heads(c.trace && mode !== 'off' ? 1 : 0);
  if (c.lf) e.set_logical_frame(codeAddr + labelAt(c.lf), 0);
  const lf0 = e.get_logical_frame_count();
  if (c.setup) c.setup(mem, g2w, a);
  const init = { eax: 0, ecx: 0, edx: 0, ebx: 0, ebp: 0, esi: a.buf, edi: a.buf + 0x10000 };
  if (c.init) Object.assign(init, c.init(a));
  for (const [k, v] of Object.entries(c.regs)) {
    init[k] = v === 'end16' ? a.buf + 2 * N : v === 'end32' ? a.buf + 4 * N : v;
  }
  if (c.name === 'lut8') init.ebx = a.lut;
  for (const r of REGS) e['set_' + r](init[r] >>> 0);
  // A known MMX file on entry, the same for every mode.
  if (e.set_mmx) for (let k = 0; k < 8; k++) e.set_mmx(k, BigInt.asIntN(64, 0x0123456789ABCDEFn * BigInt(k + 1)));
  if (c.nommx) e.set_uop_mmx(0);
  if (c.norep) e.set_uop_rep(0);
  // A known flag state on entry: a sub that sets CF.
  e.set_uop(mode === 'off' ? 0 : 1);
  if (c.aggr) e.set_aggressive_stack(mode === 'off' ? 0 : 1);
  const feats = ['muldiv', 'icall', 'iat'].filter((f) => c[f]);
  for (const f of feats) e['set_uop_' + f](mode === 'off' ? 0 : 1);
  // c.icgMega: the megamorphic-site threshold for this case (07d
  // $uop_icg_mega), put back to the default after
  if (c.icgMega !== undefined) e.set_uop_icg_mega(c.icgMega);
  const unfeat = () => {
    for (const f of feats) e['set_uop_' + f](0);
    if (c.icgMega !== undefined) e.set_uop_icg_mega(32);
  };
  const before = { installs: e.uop_stats(2), enters: e.uop_stats(4), blocks: e.uop_stats(5), traces: e.uop_cstat(26) };
  // uop_stats counters, then (negative) uop_cstat ones: sites kept, FF /2 refused
  // (100+: uop_bulk_stats -- COPY/FILL slow arms and deopts)
  const CTR = { divExits: 16, icPass: 17, icFail: 18, iatPass: 19, iatFail: 20, icSites: -28, iatSites: -29, icRej: -30,
                megaSites: 21, megaKills: 22, megaRef: -31,
                bulkSlow: 100, bulkDeopt: 101, mcopyRuns: 200, mcopySlow: 300, mcopyDeopt: 301 };
  const ctrOf = (i) => (i < 0 ? e.uop_cstat(-i) : i >= 300 ? e.uop_mcopy_stats(i - 300)
    : i >= 200 ? e.uop_mcopy_cstat(i - 200) : i >= 100 ? e.uop_bulk_stats(i - 100) : e.uop_stats(i));
  const ctr0 = Object.fromEntries(Object.entries(CTR).map(([k, i]) => [k, ctrOf(i)]));
  let sp = null;
  if (mode === 'pre') {
    const head = codeAddr + labelAt(c.head);
    const declines = WAT_REASONS.map((_, k) => k && e.uop_decline_count(k));
    const d0 = e.uop_cstat(1);
    const s0 = SP_NAMES.map((_, k) => e.uop_cstat(6 + k));
    const pc = e.uop_compile(head);
    if (!pc) {
      if (c.aggr) e.set_aggressive_stack(0);
      if (c.nommx) e.set_uop_mmx(1);
      if (c.norep) e.set_uop_rep(1);
      unfeat();
      if (c.trace) e.set_uop_trace_heads(0);
      if (c.lf) e.set_logical_frame(0, 0);
      const why = WAT_REASONS.findIndex((_, k) => k && e.uop_decline_count(k) !== declines[k]);
      return { err: 'pre-compile declined: ' + (e.uop_cstat(1) > d0 ? WAT_REASONS[why] : 'limit') };
    }
    sp = {};
    SP_NAMES.forEach((n, k) => { sp[n] = e.uop_cstat(6 + k) - s0[k]; });
    e.uop_install(head, pc);
  }
  // Small batches, recording where each one stops: the tier must end every
  // batch on the same guest instruction as threaded code (the guest clock is
  // batches), not merely reach the same final state.
  e.set_esp(a.stackTop - (c.frame || 0));
  new DataView(e.memory.buffer).setUint32(g2w(a.stackTop), 0, true);
  e.set_eip(codeAddr);
  const stops = [];
  let ok = false;
  for (let k = 0; k < 20000; k++) {
    e.run(BATCH);
    const eip = e.get_eip() >>> 0;
    if (process.env.UOP_STOPS) console.log(mode, k, (eip - codeAddr).toString(16), 'blocks', e.get_last_run_blocks(), 'ecx', e.get_ecx());
    if (eip === 0) { ok = true; break; }
    // A stop outside this case's code (a continuation thunk, e.g. the SEH
    // handler's return) is absolute: each run's code lives in its own slot.
    const rel = eip - codeAddr;
    stops.push(rel >= 0 && rel < 0x10000 ? '+0x' + rel.toString(16) : '@0x' + eip.toString(16));
  }
  const st = {
    ok, eip: e.get_eip() >>> 0, stops: stops.join(','), nstops: stops.length, flags: e.uop_flags(), mem: hash(mem, g2w, a),
    regs: REGS.map((r) => e['get_' + r]() >>> 0),
    mmx: e.get_mmx ? [0, 1, 2, 3, 4, 5, 6, 7].map((k) => BigInt.asUintN(64, e.get_mmx(k)).toString(16)).join(',') : '',
    installs: e.uop_stats(2) - before.installs, enters: e.uop_stats(4) - before.enters,
    blocks: e.uop_stats(5) - before.blocks, sp, lf: e.get_logical_frame_count() - lf0,
    traces: e.uop_cstat(26) - before.traces,
    ctr: Object.fromEntries(Object.entries(CTR).map(([k, i]) => [k, ctrOf(i) - ctr0[k]])),
  };
  e.set_uop(0);
  if (c.aggr) e.set_aggressive_stack(0);
  if (c.nommx) e.set_uop_mmx(1);
  if (c.norep) e.set_uop_rep(1);
  unfeat();
  if (c.trace) e.set_uop_trace_heads(0);
  if (c.lf) e.set_logical_frame(0, 0);
  return st;
}


function callAt(inst, a, addr, regs) {
  const { e, g2w } = inst;
  for (const r of REGS) e['set_' + r]((regs[r] ?? 0) >>> 0);
  e.set_esp(a.stackTop);
  new DataView(e.memory.buffer).setUint32(g2w(a.stackTop), 0, true);
  e.set_eip(addr);
  for (let k = 0; k < 20000; k++) {
    e.run(BATCH);
    if ((e.get_eip() >>> 0) === 0) return true;
  }
  return false;
}

// Windows outlive a run (07d): a program re-entered with nothing changed keeps
// the windows its last run proved, and anything that could make one wrong in
// between re-poisons them. Here a page turns into code under a store window
// the program already proved: its next store there must leave the program and
// go through threaded code, which retires the decoded block it overwrote. A
// kept window would let the store straight through and R would still answer
// its old immediate -- as would a store window that never checked for code.
function movsdSparseCase(inst,a,nextCode){
  const {e,g2w}=inst,errs=[];
  const source=0x26000000,dest=0x26200000;
  for(const [i,address] of [source,source+4096,dest,dest+4096].entries()){
    if((e.test_virtual_map_commit(address,4096)>>>0)!==address)return ['sparse commit failed'];
    // Force physically separated backing for adjacent guest pages.
    if((e.test_virtual_map_commit(0x28000000+i*0x100000,4096)>>>0)!==(0x28000000+i*0x100000))
      return ['filler commit failed'];
  }
  if(g2w(source+4096)===g2w(source)+4096||g2w(dest+4096)===g2w(dest)+4096)
    return ['fixture did not create noncontiguous backing'];
  const mem=new Uint8Array(e.memory.buffer);
  const seed=()=>{for(let i=0;i<8192;i++){mem[g2w(source+i)]=(i*17+3)&255;mem[g2w(dest+i)]=0xCC;}};
  const bytes=()=>Uint8Array.from({length:8192},(_,i)=>mem[g2w(dest+i)]);
  for(const backward of [false,true]){
    const code=nextCode();mem.set(asm([backward?0xFD:0xFC,L('l'),0xA5,0x49,J(cc.NZ,'l'),0xFC,0xC3]),g2w(code));
    const offset=backward?4105:4093,regs={esi:source+offset,edi:dest+offset,ecx:4};
    e.set_uop(0);seed();if(!callAt(inst,a,code,regs))errs.push('threaded sparse copy did not return');
    const expected=bytes(),expectedFlags=e.uop_flags();
    e.set_uop(1);seed();const pc=e.uop_compile(code+1);
    if(!pc){errs.push('sparse MOVSD loop declined');continue;}
    e.uop_install(code+1,pc);const enters=e.uop_stats(4);
    if(!callAt(inst,a,code,regs))errs.push('compiled sparse copy did not return');
    if(e.uop_stats(4)===enters)errs.push('sparse program never entered');
    if(!bytes().every((v,i)=>v===expected[i]))errs.push('sparse page seam bytes differ');
    const delta=backward?-16:16;
    if((e.get_esi()>>>0)!==source+offset+delta||(e.get_edi()>>>0)!==dest+offset+delta)
      errs.push('sparse pointer advancement differs');
    if(e.uop_flags()!==expectedFlags)errs.push('sparse flags differ');
  }
  e.set_uop(0);return errs;
}

function movsdCodeCase(inst,a,nextCode){
  const {e,mem,g2w}=inst,errs=[],copy=nextCode(),target=nextCode();
  mem.set(asm([0xFC,L('l'),0xA5,0x49,J(cc.NZ,'l'),0xC3]),g2w(copy));
  mem.set(asm([L('l'),[0xB8,...d32(0x11111111)],0x49,J(cc.NZ,'l'),0xC3]),g2w(target));
  new DataView(mem.buffer).setUint32(g2w(a.buf),0x22222222,true);
  e.set_uop(1);
  try{
    const pc=e.uop_compile(copy+1);if(!pc)return ['MOVSD writer declined'];e.uop_install(copy+1,pc);
    // CLD and the first MOVSD decode as one threaded block. Take the back
    // edge to enter the installed head and establish its write window.
    const warmEnters=e.uop_stats(4);
    callAt(inst,a,copy,{esi:a.buf,edi:target+0x800,ecx:2});
    if(e.uop_stats(4)===warmEnters)errs.push('writer warmup did not enter compiled path');
    callAt(inst,a,target,{ecx:2});
    if((e.get_eax()>>>0)!==0x11111111)errs.push('initial target result');
    const targetPC=e.uop_compile(target);if(!targetPC)return ['rewrite target declined'];e.uop_install(target,targetPC);
    const kills=e.uop_stats(3),enters=e.uop_stats(4);
    // DF is already clear. Enter the compiled head directly: starting at
    // CLD with one iteration would never take a branch to that head.
    callAt(inst,a,copy+1,{esi:a.buf,edi:target+1,ecx:1});
    if(e.uop_stats(4)===enters)errs.push('writer did not enter compiled path');
    if(e.uop_stats(3)<=kills)errs.push('MOVSD did not invalidate target program');
    if((e.get_esi()>>>0)!==a.buf+4||(e.get_edi()>>>0)!==target+5)
      errs.push('code-write fallback advanced pointers incorrectly');
    callAt(inst,a,target,{ecx:2});
    if((e.get_eax()>>>0)!==0x22222222)errs.push('stale decoded target after MOVSD');
  }finally{e.set_uop(0);}
  return errs;
}

// An MCOPY whose destination turns into decoded code (the MOVSD case above,
// for 85): its store window was proved over data during the warmup, the page
// then holds a compiled program, and the next MCOPY there must leave for
// threaded code before writing, which retires the program it overwrote. This
// is also what the COPY/FILL/MCOPY store-window marking in $uc_encode_write
// exists for: proved read-only, the window never asked about code.
function mcopyCodeCase(inst,a,nextCode){
  const {e,mem,g2w}=inst,errs=[],copy=nextCode(),target=nextCode();
  mem.set(asm([L('l'),[0x8B,0x06],[0x89,0x07],[0x8B,0x46,0x04],[0x89,0x47,0x04],0x49,J(cc.NZ,'l'),0xC3]),g2w(copy));
  const tb=asm([L('l'),[0xB8,...d32(0x11111111)],0x49,J(cc.NZ,'l'),0xC3]);
  mem.set(tb,g2w(target));
  const dv=new DataView(mem.buffer);
  dv.setUint32(g2w(a.buf),0x22222222,true);
  // the second dword rewrites dec/jnz/ret with themselves
  dv.setUint32(g2w(a.buf+4),tb[5]|tb[6]<<8|tb[7]<<16|tb[8]<<24,true);
  e.set_uop(1);
  try{
    const r0=e.uop_mcopy_cstat(0);
    const pc=e.uop_compile(copy);if(!pc)return ['MCOPY writer declined'];e.uop_install(copy,pc);
    if(e.uop_mcopy_cstat(0)===r0)errs.push('writer not lowered to MCOPY');
    const warmEnters=e.uop_stats(4);
    callAt(inst,a,copy,{esi:a.buf,edi:target+0x800,ecx:2});
    if(e.uop_stats(4)===warmEnters)errs.push('writer warmup did not enter compiled path');
    callAt(inst,a,target,{ecx:2});
    if((e.get_eax()>>>0)!==0x11111111)errs.push('initial target result');
    const targetPC=e.uop_compile(target);if(!targetPC)return ['rewrite target declined'];e.uop_install(target,targetPC);
    const kills=e.uop_stats(3),enters=e.uop_stats(4),dq=e.uop_mcopy_stats(1);
    callAt(inst,a,copy,{esi:a.buf,edi:target+1,ecx:1});
    if(e.uop_stats(4)===enters)errs.push('writer did not enter compiled path');
    if(e.uop_stats(3)<=kills)errs.push('MCOPY did not invalidate target program');
    if(e.uop_mcopy_stats(1)===dq)errs.push('MCOPY did not deopt at the code page');
    if((e.get_eax()>>>0)!==(dv.getUint32(g2w(a.buf+4),true)>>>0))errs.push('code-write fallback left EAX wrong');
    callAt(inst,a,target,{ecx:2});
    if((e.get_eax()>>>0)!==0x22222222)errs.push('stale decoded target after MCOPY');
  }finally{e.set_uop(0);}
  return errs;
}

// REP MOVS/STOS against an explicit element-by-element model in JS -- not
// against 05b, which the threaded arm and the COPY/FILL slow arm now share.
// Each config runs `l: rep op; dec ebp; jnz l` with EBP=2 (so the second
// rep has ECX=0), once threaded and once entering a program compiled at l.
const REP_FORMS = [
  { n: 'movsb', op: [0xF3, 0xA4], w: 1, movs: true }, { n: 'movsw', op: [0x66, 0xF3, 0xA5], w: 2, movs: true },
  { n: 'movsd', op: [0xF3, 0xA5], w: 4, movs: true }, { n: 'stosb', op: [0xF3, 0xAA], w: 1 },
  { n: 'stosw', op: [0xF3, 0x66, 0xAB], w: 2 }, { n: 'stosd', op: [0xF3, 0xAB], w: 4 },
];
function repModel(m, r, f, df) {
  // m: bytes of a.buf.., r: {esi,edi,ecx,eax} offsets from a.buf
  const step = df ? -f.w : f.w;
  while (r.ecx) {
    // the whole element is read before any of it is written
    const el = Array.from({ length: f.w }, (_, b) => (f.movs ? m[r.esi + b] : (r.eax >>> (8 * b)) & 0xFF));
    for (let b = 0; b < f.w; b++) m[r.edi + b] = el[b];
    r.edi += step; if (f.movs) r.esi += step; r.ecx--;
  }
}
function repOracleCase(inst, a, nextCode) {
  const { e, g2w } = inst, errs = [];
  const mem = () => new Uint8Array(e.memory.buffer);
  const configs = [];
  for (const f of REP_FORMS) for (const df of [0, 1]) {
    // disjoint, destination ahead-overlapping, destination behind-overlapping,
    // exact alias, a zero count, one element, and a run across a page seam
    configs.push([f, df, 0x1000, 0x9000, 40], [f, df, 0x2000, 0x2000 + (df ? -3 : 3), 57],
                 [f, df, 0x3000, 0x3000 + (df ? 5 : -5), 33], [f, df, 0x4000, 0x4000, 9],
                 [f, df, 0x5000, 0x6000, 0], [f, df, 0x5000, 0x6000, 1], [f, df, 0x7FF0, 0xAFF3, 900]);
  }
  e.set_uop_trace_heads(0);
  // DF is set by a separate call, so the program can be entered at its
  // head -- the first rep included -- with the direction already in place.
  const dfCode = nextCode();
  mem().set([0xFC, 0xC3, 0, 0, 0xFD, 0xC3], g2w(dfCode));
  for (const [f, df, so, dofs, count] of configs) {
    const code = nextCode();
    mem().set(asm([L('l'), f.op, 0x4D, J(cc.NZ, 'l'), 0xFC, 0xC3]), g2w(code));
    const head = code;
    const regs = { esi: a.buf + so, edi: a.buf + dofs, ecx: count, eax: 0xA1B2C3D4, ebp: 2 };
    const fill = () => { const m = mem(), s = g2w(a.buf); for (let k = 0; k < 0x10000; k++) m[s + k] = (k * 29 + 7) & 0xFF; };
    fill();
    const model = Uint8Array.from(mem().subarray(g2w(a.buf), g2w(a.buf) + 0x10000));
    const r = { esi: so, edi: dofs, ecx: count, eax: regs.eax };
    repModel(model, r, f, df);
    for (const arm of ['threaded', 'compiled']) {
      fill();
      e.set_uop(arm === 'compiled' ? 1 : 0);
      let enters = 0;
      if (arm === 'compiled') {
        const pc = e.uop_compile(head);
        if (!pc) { errs.push(`${f.n} df=${df} declined`); e.set_uop(0); continue; }
        e.uop_install(head, pc);
        enters = e.uop_stats(4);
      }
      // Start at the head: the program is entered from the first instruction.
      callAt(inst, a, dfCode + (df ? 4 : 0), {});
      if (!callAt(inst, a, head, regs)) errs.push(`${arm} ${f.n} did not return`);
      const tag = `${arm} ${f.n} df=${df} src+${so.toString(16)} dst+${dofs.toString(16)} n=${count}`;
      if (arm === 'compiled' && e.uop_stats(4) === enters) errs.push(`${tag}: never entered`);
      const m = mem(), s = g2w(a.buf);
      let bad = -1;
      for (let k = 0; k < 0x10000; k++) if (m[s + k] !== model[k]) { bad = k; break; }
      if (bad >= 0) errs.push(`${tag}: byte +0x${bad.toString(16)} ${m[s + bad]} vs model ${model[bad]}`);
      const want = { esi: a.buf + (f.movs ? r.esi : so), edi: a.buf + r.edi, ecx: 0 };
      for (const [k, v] of Object.entries(want)) if ((e['get_' + k]() >>> 0) !== (v >>> 0)) errs.push(`${tag}: ${k} ${(e['get_' + k]() >>> 0).toString(16)} vs ${(v >>> 0).toString(16)}`);
      e.set_uop(0);
    }
  }
  return errs;
}

// Sparse guest pages whose backing is not adjacent: the extent cannot be one
// window, so COPY/FILL take the slow arm through 05b's per-page translation.
// Checked against threaded code on the same fixture, both directions.
function repSparseCase(inst, a, nextCode) {
  const { e, g2w } = inst, errs = [];
  const source = 0x26400000, dest = 0x26600000;
  for (const [i, address] of [source, source + 4096, dest, dest + 4096].entries()) {
    if ((e.test_virtual_map_commit(address, 4096) >>> 0) !== address) return ['sparse commit failed'];
    if ((e.test_virtual_map_commit(0x28400000 + i * 0x100000, 4096) >>> 0) !== (0x28400000 + i * 0x100000))
      return ['filler commit failed'];
  }
  if (g2w(source + 4096) === g2w(source) + 4096 || g2w(dest + 4096) === g2w(dest) + 4096)
    return ['fixture did not create noncontiguous backing'];
  const mem = () => new Uint8Array(e.memory.buffer);
  const seed = () => { const m = mem(); for (let i = 0; i < 8192; i++) { m[g2w(source + i)] = (i * 17 + 3) & 255; m[g2w(dest + i)] = 0xCC; } };
  const bytes = () => { const m = mem(); return Uint8Array.from({ length: 8192 }, (_, i) => m[g2w(dest + i)]); };
  e.set_uop_trace_heads(0);
  for (const f of REP_FORMS) for (const backward of [false, true]) {
    const code = nextCode();
    // l: mov ecx,ebx ; rep op ; dec ebp ; jnz l
    mem().set(asm([backward ? 0xFD : 0xFC, L('l'), [0x89, 0xD9], f.op, 0x4D, J(cc.NZ, 'l'), 0xFC, 0xC3]), g2w(code));
    const offset = backward ? 4105 : 4077;
    const regs = { esi: source + offset, edi: dest + offset, ebx: 5, ebp: 3, eax: 0x5A6B7C8D };
    e.set_uop(0); seed();
    if (!callAt(inst, a, code, regs)) errs.push(`threaded sparse ${f.n} did not return`);
    const expected = bytes(), er = ['esi', 'edi', 'ecx'].map((r) => e['get_' + r]() >>> 0);
    e.set_uop(1); seed();
    const pc = e.uop_compile(code + 1);
    if (!pc) { errs.push(`sparse ${f.n} declined`); continue; }
    e.uop_install(code + 1, pc);
    const enters = e.uop_stats(4), slow = e.uop_bulk_stats(0);
    if (!callAt(inst, a, code, regs)) errs.push(`compiled sparse ${f.n} did not return`);
    const tag = `sparse ${f.n}${backward ? ' back' : ''}`;
    if (e.uop_stats(4) === enters) errs.push(`${tag}: never entered`);
    if (e.uop_bulk_stats(0) === slow) errs.push(`${tag}: slow arm never ran`);
    const got = bytes();
    if (!got.every((v, i) => v === expected[i])) errs.push(`${tag}: bytes differ`);
    const gr = ['esi', 'edi', 'ecx'].map((r) => e['get_' + r]() >>> 0);
    if (gr.join() !== er.join()) errs.push(`${tag}: regs ${gr.map((x) => x.toString(16))} vs ${er.map((x) => x.toString(16))}`);
  }
  e.set_uop(0);
  return errs;
}

// A compiled rep stos over a page holding a compiled program: the store
// window refuses a code page, so the op leaves to threaded code before
// writing anything, and threaded rep retires the decoded target.
function repCodeWriteCase(inst, a, nextCode) {
  const { e, mem, g2w } = inst, errs = [], writer = nextCode(), target = nextCode();
  mem.set(asm([L('l'), [0xF3, 0xAA], 0x4D, J(cc.NZ, 'l'), 0xC3]), g2w(writer));
  mem.set(asm([L('l'), [0xB8, ...d32(0x11111111)], 0x49, J(cc.NZ, 'l'), 0xC3]), g2w(target));
  e.set_uop(1);
  try {
    callAt(inst, a, target, { ecx: 2 });
    const targetPC = e.uop_compile(target); if (!targetPC) return ['rewrite target declined'];
    e.uop_install(target, targetPC);
    const pc = e.uop_compile(writer); if (!pc) return ['rep stos writer declined'];
    e.uop_install(writer, pc);
    const kills = e.uop_stats(3), enters = e.uop_stats(4), deopts = e.uop_bulk_stats(1);
    callAt(inst, a, writer, { edi: target + 1, ecx: 4, eax: 0x22, ebp: 1 });
    if (e.uop_stats(4) === enters) errs.push('writer did not enter compiled path');
    if (e.uop_bulk_stats(1) === deopts) errs.push('FILL over code did not leave to threaded code');
    if (e.uop_stats(3) <= kills) errs.push('rep stos did not invalidate target program');
    if ((e.get_edi() >>> 0) !== target + 5 || (e.get_ecx() >>> 0) !== 0) errs.push('code-write fallback registers wrong');
    callAt(inst, a, target, { ecx: 2 });
    if ((e.get_eax() >>> 0) !== 0x22222222) errs.push(`stale decoded target after rep stos (eax=${(e.get_eax() >>> 0).toString(16)})`);
  } finally { e.set_uop(0); }
  return errs;
}

// Quake II's PCX/WAL run expander, verbatim from ref_soft.dll+0x1000580c (108
// bytes): the loop the retired PCX_RUN fold (H462) used to replace. Its fill
// is `rep stosd` + `rep stosb`, so the uop tier compiles it only through the
// FILL lowering -- with set_uop_rep(0) it must decline. Threaded is the oracle:
// the destination bytes, every register, the flags and the spilled cursor must
// agree, over run lengths 0 / 1 / 3 / 5 / 63 and with DF set.
const PCX_BODY = Uint8Array.from(Buffer.from(
  '33c08a02428bc88954241081e1c000000080f9c075108bc833c08a0283e13f42' +
  '89542410eb05b9010000008bf14985f67e2c8d3c2b8ad88d71018afb8bce8bc3' +
  '8bd1c1e010668bc38b5c2418c1e902f3ab8bca83e10303eef3aa8b5424108b4c' +
  '241433c0668b41083be87e94', 'hex'));
function pcxBodyCase(inst, a, nextCode) {
  const { e, g2w } = inst, errs = [];
  const mem = () => new Uint8Array(e.memory.buffer);
  const dv = () => new DataView(e.memory.buffer);
  const src = a.buf + 0x1000, dst = a.buf + 0x2000, hdr = a.buf + 0x3000, base = dst + 0x100;
  const dfCode = nextCode();
  mem().set([0xFC, 0xC3, 0, 0, 0xFD, 0xC3], g2w(dfCode));
  const streams = [
    ['mixed', [0x41, 0xc5, 0x22, 0xc0, 0x33, 0xc3, 0x44, 0x55, 0xc7, 0x66], 16, 0],
    ['max-run', [0xff, 0x11, 0xff, 0x22], 100, 0],
    ['zero-runs', Array.from({ length: 64 }, (_, i) => (i & 1) ? 0x00 : 0xc0), 4, 0],
    ['long', Array.from({ length: 400 }, (_, i) => (i & 1) ? (i * 7) & 0xFF : 0xC0 | ((i * 13) % 64)), 3000, 0],
    ['df', [0xc5, 0x22, 0x41], 4, 1],
  ];
  e.set_uop_trace_heads(0);
  try {
    for (const [name, tokens, limit, df] of streams) {
      const code = nextCode();
      mem().set(PCX_BODY, g2w(code)); mem()[g2w(code) + PCX_BODY.length] = 0xC3;
      const setup = () => {
        const m = mem();
        m.fill(0x77, g2w(dst), g2w(dst) + 0x1000);
        m.fill(0, g2w(src), g2w(src) + 0x400);
        m.set(tokens, g2w(src));
        dv().setUint32(g2w(hdr + 8), limit, true);
        dv().setUint32(g2w(a.stackTop + 0x10), src, true);
        dv().setUint32(g2w(a.stackTop + 0x14), hdr, true);
        dv().setUint32(g2w(a.stackTop + 0x18), base, true);
        callAt(inst, a, dfCode + (df ? 4 : 0), {});
      };
      const regs = { edx: src, ebx: base, ebp: 0, eax: 0x11223344, ecx: 0x55667788, esi: 0x99aabbcc, edi: 0xddeeff00 };
      const snap = () => ({
        dst: Array.from(mem().subarray(g2w(dst), g2w(dst) + 0x1000)),
        regs: REGS.map((r) => (e['get_' + r]() >>> 0).toString(16)).join(','),
        flags: e.uop_flags(), spill: dv().getUint32(g2w(a.stackTop + 0x10), true),
      });
      e.set_uop(0); setup();
      if (!callAt(inst, a, code, regs)) { errs.push(`${name}: threaded did not return`); continue; }
      const want = snap();
      // rep=0: the program side-exits at each rep (the pre-COPY/FILL shape);
      // rep=1: the fills stay inside it, so it is entered far fewer times.
      const entersBy = {};
      for (const rep of [0, 1]) {
        e.set_uop(1); e.set_uop_rep(rep);
        const pc = e.uop_compile(code);
        if (!pc) { errs.push(`${name} rep=${rep}: declined`); continue; }
        e.uop_install(code, pc);
        setup();
        const enters = e.uop_stats(4);
        if (!callAt(inst, a, code, regs)) errs.push(`${name} rep=${rep}: compiled did not return`);
        entersBy[rep] = e.uop_stats(4) - enters;
        if (!entersBy[rep]) errs.push(`${name} rep=${rep}: never entered`);
        const got = snap();
        const bad = got.dst.findIndex((v, i) => v !== want.dst[i]);
        if (bad >= 0) errs.push(`${name} rep=${rep}: dst+0x${bad.toString(16)} ${got.dst[bad]} vs ${want.dst[bad]}`);
        if (got.regs !== want.regs) errs.push(`${name} rep=${rep}: regs ${got.regs} vs ${want.regs}`);
        if (got.flags !== want.flags) errs.push(`${name} rep=${rep}: flags differ`);
        if (got.spill !== want.spill) errs.push(`${name} rep=${rep}: spilled cursor differs`);
        e.set_uop(0);
      }
      if (name === 'long' && !(entersBy[1] * 4 < entersBy[0]))
        errs.push(`long: rep lowering did not keep the fills in the program (enters ${entersBy[1]} vs ${entersBy[0]})`);
    }
  } finally { e.set_uop(0); e.set_uop_rep(1); callAt(inst, a, dfCode, {}); }
  return errs;
}

// --uop-trace-heads=MIN,MAX (set_uop_trace_limits): a trace is formed only
// between the two bounds, counted in x86 instructions. The head is K
// straight-line `add ebx,edx` and a jmp -- no branch before the jmp, so a
// trace cut at MAX has nothing to trim back to and declines whole (Caesar
// III's unrolled blits, docs/uop-tier-design.md §20). MAX is clamped to
// $UC_MAX_LOOP (400): asking for more silently means 400. Run under
// --branch-clock, as the shipping tier is: the instruction clock also refuses
// any one block over 200 instructions on a page (decline `long-block`).
function traceLimitsCase(inst, a, nextCode) {
  const { e, mem, g2w } = inst;
  const errs = [];
  // The jmp is the trace's one exit (a ret is not: it has no in-region call
  // to return to, so the trim would drop it and everything before it).
  const straight = (k) => {
    const at = nextCode();
    mem.set(asm([...new Array(k).fill([0x01, 0xD3]), JMP('x'), L('x'), 0xC3]), g2w(at));
    return at;
  };
  const tries = [
    // [min, max, K, compiles?]
    [8, 160, 200, false],   // the default cap cuts the run with no branch to keep
    [8, 320, 200, true],
    [8, 1000, 390, true],   // clamped to 400, still room
    [8, 1000, 450, false],  // clamped to 400: 450 does not fit
    [8, 160, 5, false],     // under the minimum
    [4, 160, 5, true],
  ];
  // With straight-line cut exits (§21.3, the default) the same runs compile:
  // the trace keeps its first MAX instructions and leaves to the next one.
  const cutTries = [
    [8, 160, 200, true],
    [8, 1000, 450, true],
    [8, 160, 5, false],
    [4, 160, 5, true],
  ];
  e.set_uop(1);
  e.set_uop_trace_heads(1);
  e.set_branch_clock(1);
  try {
    e.set_uop_trace_cut(0);
    for (const [mn, mx, k, want] of tries) {
      e.set_uop_trace_limits(mn, mx);
      const pc = e.uop_compile(straight(k));
      if (!!pc !== want) errs.push(`no-cut limits ${mn},${mx} K=${k}: ${pc ? 'compiled' : 'declined'}, want ${want ? 'compiled' : 'declined'}`);
    }
    e.set_uop_trace_cut(1);
    for (const [mn, mx, k, want] of cutTries) {
      e.set_uop_trace_limits(mn, mx);
      const pc = e.uop_compile(straight(k));
      if (!!pc !== want) errs.push(`cut limits ${mn},${mx} K=${k}: ${pc ? 'compiled' : 'declined'}, want ${want ? 'compiled' : 'declined'}`);
    }
    // Run one: 200 adds under the 160 cap. The first program cuts at add
    // #161, the head there compiles as the rest, and ebx must come out as
    // threaded code leaves it. Both programs are entered, and the budget
    // spent is the one jmp (the cut is free on the branch clock).
    e.set_uop_trace_limits(8, 160);
    const at = straight(200);
    const pc1 = e.uop_compile(at), pc2 = e.uop_compile(at + 2 * 160);
    if (!pc1 || !pc2) errs.push(`cut chain: ${pc1 ? '' : 'head '}${pc2 ? '' : 'continuation '}declined`);
    else {
      e.uop_install(at, pc1); e.uop_install(at + 2 * 160, pc2);
      const en0 = e.uop_stats(4), bl0 = e.uop_stats(5);
      if (!callAt(inst, a, at, { ebx: 5, edx: 7 })) errs.push('cut chain did not return');
      if ((e.get_ebx() >>> 0) !== 5 + 200 * 7) errs.push(`cut chain: ebx ${e.get_ebx() >>> 0}, want ${5 + 200 * 7}`);
      if (e.uop_stats(4) - en0 !== 2) errs.push(`cut chain: ${e.uop_stats(4) - en0} enters, want 2`);
      if (e.uop_stats(5) - bl0 !== 1) errs.push(`cut chain: ${e.uop_stats(5) - bl0} blocks spent in programs, want 1`);
    }
  } finally {
    e.set_uop_trace_cut(1);
    e.set_uop_trace_limits(8, 160);
    e.set_branch_clock(0);
    e.set_uop_trace_heads(0);
    e.set_uop(0);
  }
  if (!errs.length) console.log('trace-limits       ok');
  return errs;
}

// The poor rule vs straight-line traces (docs/uop-tier-design.md §21.1).
// Under --branch-clock a trace that is K straight instructions and one jmp
// spends 1 block per entry, which the blocks-only rule (retire below 2 per
// entry after 256 entries) always retires. A trace is also credited the x86
// instructions its exit retired (07e $uc_exit_work -> 84 WORK), and lives
// while it averages $UOP_POOR_WORK (16) of them: K=40 must survive, K=10 must
// still be retired, and set_uop_poor_work(huge) must bring back the old rule.
function tracePoorWorkCase(inst, a, nextCode) {
  const { e, mem, g2w } = inst;
  const errs = [];
  const straight = (k) => {
    const at = nextCode();
    mem.set(asm([...new Array(k).fill([0x01, 0xD3]), JMP('x'), L('x'), 0xC3]), g2w(at));
    return at;
  };
  const tries = [
    // [K, poor-work floor, retired?]
    [40, 16, false],
    [10, 16, true],
    [40, 0x40000000, true],
  ];
  e.set_uop(1);
  e.set_uop_trace_heads(1);
  e.set_branch_clock(1);
  const notes = [];
  try {
    for (const [k, floor, want] of tries) {
      e.set_uop_poor_work(floor);
      const at = straight(k);
      const pc = e.uop_compile(at);
      if (!pc) { errs.push(`K=${k}: declined`); continue; }
      e.uop_install(at, pc);
      const poor0 = e.uop_stats(7), en0 = e.uop_stats(4);
      for (let i = 0; i < 300; i++) {
        if (!callAt(inst, a, at, { ebx: 0, edx: 3 + i })) { errs.push(`K=${k}: did not return`); break; }
        if ((e.get_ebx() >>> 0) !== ((k * (3 + i)) >>> 0)) { errs.push(`K=${k}: ebx ${(e.get_ebx() >>> 0)} want ${k * (3 + i)}`); break; }
      }
      const enters = e.uop_stats(4) - en0, retired = e.uop_stats(7) !== poor0;
      if (enters < 256) errs.push(`K=${k}: entered only ${enters} times`);
      if (retired !== want) errs.push(`K=${k} floor=${floor}: ${retired ? 'retired' : 'kept'}, want ${want ? 'retired' : 'kept'} (enters=${enters})`);
      notes.push(`K=${k}/${floor > 1000 ? 'off' : floor}:${retired ? 'retired' : 'kept'}`);
    }
  } finally {
    e.set_uop_poor_work(16);
    e.set_branch_clock(0);
    e.set_uop_trace_heads(0);
    e.set_uop(0);
  }
  if (!errs.length) console.log(`trace-poor-work    ok (${notes.join(' ')})`);
  return errs;
}

function windowCase(inst, a, nextCode) {
  const { e, mem, g2w } = inst;
  const P = nextCode(), Lc = nextCode();
  mem.set([0xB8, 0x11, 0x11, 0x11, 0x11, 0xC3], g2w(P));                 // mov eax,0x11111111 ; ret
  mem.set(asm([L('l'), [0x88, 0x07], 0x47, 0x49, J(cc.NZ, 'l'), 0xC3]), g2w(Lc)); // mov [edi],al; inc edi; dec ecx; jnz; ret
  e.set_uop(1);
  const errs = [];
  try {
    const pc = e.uop_compile(Lc);
    if (!pc) return ['store loop declined'];
    e.uop_install(Lc, pc);
    const kept0 = e.uop_stats(9), reset0 = e.uop_stats(10), enters0 = e.uop_stats(4);
    for (let i = 0; i < 8; i++) {
      if (!callAt(inst, a, Lc, { ecx: 64, edi: P + 0x800, eax: 0x40 + i })) errs.push('store loop did not return');
    }
    const kept = e.uop_stats(9) - kept0, enters = e.uop_stats(4) - enters0;
    if (!enters) errs.push('never entered');
    if (!kept) errs.push(`no entry kept its windows (enters=${enters} resets=${e.uop_stats(10) - reset0})`);
    if (mem[g2w(P + 0x800 + 63)] !== 0x47) errs.push('store loop wrote the wrong bytes');
    callAt(inst, a, P, {});
    if ((e.get_eax() >>> 0) !== 0x11111111) errs.push(`R before: eax ${(e.get_eax() >>> 0).toString(16)}`);
    const reset1 = e.uop_stats(10), enters1 = e.uop_stats(4);
    callAt(inst, a, Lc, { ecx: 4, edi: P + 1, eax: 0x22 });
    if (e.uop_stats(4) === enters1) errs.push('rewrite never entered the program');
    if (e.uop_stats(10) === reset1) errs.push('page turned to code but the windows were kept');
    callAt(inst, a, P, {});
    if ((e.get_eax() >>> 0) !== 0x22222222) errs.push(`R after rewrite: eax ${(e.get_eax() >>> 0).toString(16)} (stale decoded block)`);
    // Keep storing into that code page: every entry now exits at the head
    // having spent no block, which is pure overhead, so the program must be
    // retired as poor rather than entered forever (StarCraft's 0x4b4417).
    const poor0 = e.uop_stats(7);
    let calls = 0;
    for (; calls < 600 && e.uop_stats(7) === poor0; calls++) {
      callAt(inst, a, Lc, { ecx: 1, edi: P + 1, eax: 0x30 + (calls & 7) });
    }
    if (e.uop_stats(7) === poor0) errs.push('a program that never gets past its head was never retired');
    const enters2 = e.uop_stats(4);
    callAt(inst, a, Lc, { ecx: 1, edi: P + 1, eax: 0x33 });
    if (e.uop_stats(4) !== enters2) errs.push('retired program still entered');
    if (mem[g2w(P + 1)] !== 0x33) errs.push('threaded store after retirement lost');
    if (!errs.length) console.log(`window-keep        ok (enters=${enters} kept=${kept}, retired after ${calls} head exits)`);
  } finally {
    e.set_uop(0);
  }
  return errs;
}

// The code-write filter in front of $uop_code_write (07d). A store to a page
// that has held code reaches the uop tier; the filter must let through every
// store that overlaps a live program's bytes (kill) and may skip the rest.
// uop_stats: 3 kills, 11 filter skips, 12 scans, 13 rebuilds.
function codeWriteCase(inst, a, nextCode) {
  const { e, mem, g2w } = inst;
  const C = nextCode(), W = nextCode(), Lc = nextCode(), Lk = nextCode();
  mem.set([0xC3], g2w(C));                                                  // ret: makes C a code page
  mem.set([0x88, 0x07, 0xC3], g2w(W));                                      // mov [edi],al ; ret
  const loop = asm([L('l'), [0x88, 0x07], 0x47, 0x49, J(cc.NZ, 'l'), 0xC3]);
  mem.set(loop, g2w(Lc));
  mem.set(loop, g2w(Lk));
  const errs = [];
  const st = (k) => e.uop_stats(k) >>> 0;
  const store = (addr) => {
    // Store the byte already there, so program bytes never actually change.
    if (!callAt(inst, a, W, { edi: addr, eax: mem[g2w(addr)] })) errs.push(`store to ${addr.toString(16)} did not return`);
  };
  e.set_uop(1);
  try {
    callAt(inst, a, C, {});
    const pc = e.uop_compile(Lc);
    if (!pc) return ['store loop declined'];
    e.uop_install(Lc, pc);
    // A second program that stays live throughout: with no ranges at all the
    // tier is not consulted, and steps 4-5 need it consulted.
    const pk = e.uop_compile(Lk);
    if (!pk) return ['second store loop declined'];
    e.uop_install(Lk, pk);
    // 1. A code page no program was lowered from: skipped, no scan.
    let s0 = st(11), n0 = st(12), k0 = st(3);
    store(C + 0x800);
    if (st(11) === s0) errs.push('store to a program-free code page was not skipped');
    if (st(12) !== n0) errs.push('store to a program-free code page was scanned');
    // 2. The program's own page, a line it does not cover: skipped too.
    s0 = st(11); n0 = st(12);
    store(Lc + 0x800);
    if (st(11) === s0 || st(12) !== n0) errs.push('store to an uncovered line of the program page was not skipped');
    if (st(3) !== k0) errs.push('an uncovered store killed the program');
    // 3. A byte of the program: scanned, and the program dies.
    n0 = st(12);
    store(Lc + 1);
    if (st(12) === n0) errs.push('store into the program was not scanned');
    if (st(3) !== k0 + 1) errs.push(`store into the program did not kill it (kills ${st(3) - k0})`);
    // 4. Its bits are stale now: the next store there scans, finds nothing,
    //    rebuilds; the one after that is skipped.
    const r0 = st(13);
    store(Lc + 2);
    if (st(13) !== r0 + 1) errs.push('stale filter was not rebuilt after a false hit');
    s0 = st(11);
    store(Lc + 2);
    if (st(11) === s0) errs.push('rebuilt filter still holds the dead program');
    // 5. A reinstall is caught again.
    const pc2 = e.uop_compile(Lc);
    if (!pc2) errs.push('recompile declined');
    else {
      e.uop_install(Lc, pc2);
      k0 = st(3);
      store(Lc + 3);
      if (st(3) !== k0 + 1) errs.push('reinstalled program not killed by a store into it');
    }
    if (!errs.length) console.log(`code-write-gate    ok (skipped=${st(11)} scans=${st(12)} rebuilds=${st(13)})`);
  } finally {
    e.set_uop(0);
  }
  return errs;
}

// The hot-table age (07c $bx_hot_age, section 22): every N bumps each sticky
// count is halved. With N=1 a head's count is halved before every bump and
// never nears the 256 threshold, however many times the loop runs; with the
// decay off the same loop installs. uop_stats 2 = installs.
function hotAgeCase(inst, a, nextCode) {
  const { e, mem, g2w } = inst;
  const loop = asm([L('l'), [0x83, 0xC6, 0x04], 0x49, J(cc.NZ, 'l'), 0xC3]);
  const errs = [];
  e.set_uop(1);
  e.set_uop_trace_heads(0);
  try {
    const run = (age) => {
      const at = nextCode();
      mem.set(loop, g2w(at));
      e.set_uop_hot_age(age);
      const i0 = e.uop_stats(2), h0 = e.uop_hot_halvings();
      if (!callAt(inst, a, at, { ecx: 4096, esi: a.buf })) errs.push(`age ${age}: loop did not return`);
      return { installs: e.uop_stats(2) - i0, halvings: e.uop_hot_halvings() - h0 };
    };
    const fast = run(1), off = run(0);
    if (fast.installs !== 0) errs.push(`age 1 still installed (${fast.installs})`);
    if (fast.halvings < 1000) errs.push(`age 1 halved only ${fast.halvings} times`);
    if (off.installs < 1) errs.push('age 0 never installed');
    if (off.halvings !== 0) errs.push(`age 0 halved (${off.halvings})`);
    if (!errs.length) console.log(`hot-age            ok (age1 halvings=${fast.halvings} installs=0; age0 installs=${off.installs})`);
  } finally {
    e.set_uop_hot_age(0x8000);
    e.set_uop(0);
  }
  return errs;
}

// An enter op outlives the flush that freed its program (07d $uop_flush only
// bumps the generation and rewinds the arena), and so does a map way. The
// next generation's programs then land on the freed bytes, and the old
// header's gen word is whatever they put there. Deus Ex (docs/re-notes/
// deus-ex-demo.md) crashed exactly so: a later program's last operand was 4
// in generation 4, its alignment padding still held the dead header's head
// EIP, and the stale enter op ran a "program" made of that program's window
// slots. Forge that coincidence at a freed header and the enter must refuse
// it: only a program installed at that address since the flush may run.
function staleEnterCase(inst, a, nextCode) {
  const { e, mem, g2w } = inst;
  const loop = asm([L('l'), [0x88, 0x07], 0x47, 0x49, J(cc.NZ, 'l'), 0xC3]); // mov [edi],al; inc edi; dec ecx; jnz; ret
  const Ld = nextCode(), Lh = nextCode(), Lx = nextCode();
  for (const at of [Ld, Lh, Lx]) mem.set(loop, g2w(at));
  const dv = new DataView(e.memory.buffer);
  const errs = [];
  e.set_uop(1);
  try {
    // Something before it, so the victim's header is not the arena's first
    // byte (which the next generation's first program would own outright).
    const pd = e.uop_compile(Ld);
    const ph = e.uop_compile(Lh);
    if (!pd || !ph) return ['store loop declined'];
    e.uop_install(Ld, pd);
    e.uop_install(Lh, ph);
    if (ph <= pd || (ph & 15)) return [`unexpected placement pd=${pd.toString(16)} ph=${ph.toString(16)}`];
    const en0 = e.uop_stats(4);
    if (!callAt(inst, a, Lh, { ecx: 64, edi: a.buf, eax: 0x41 })) errs.push('victim did not return');
    if (e.uop_stats(4) === en0) return ['victim never entered: no enter op to go stale'];
    e.uop_flush();
    const x = e.uop_compile(Lx);
    if (!x) return ['next-generation loop declined'];
    e.uop_install(Lx, x);
    // The coincidence: the new gen in the freed header's gen word, the head
    // EIP still behind it, and its enter count reset so a run shows.
    dv.setUint32(ph, e.uop_gen() >>> 0, true);
    dv.setUint32(ph + 4, Lh >>> 0, true);
    dv.setUint32(ph + 16, 0, true);
    for (let i = 0; i < 4; i++) {
      if (!callAt(inst, a, Lh, { ecx: 64, edi: a.buf + 0x100, eax: 0x50 + i })) errs.push('threaded run did not return');
    }
    if (dv.getUint32(ph + 16, true)) errs.push(`entered a freed header ${dv.getUint32(ph + 16, true)} times`);
    if (mem[g2w(a.buf + 0x100 + 63)] !== 0x53) errs.push('store loop wrote the wrong bytes');
    if (!errs.length) console.log(`stale-enter        ok (freed header at arena+0x${(ph - e.uop_arena()).toString(16)} refused)`);
  } finally {
    e.set_uop(0);
  }
  return errs;
}

// A re-guard widens its window to the 64KB-aligned block around the missing
// page ($uop_reguard_wide, 07d) while the backing stays affine and, for a
// store window, no page holds code. Two properties: a store sweep that walks
// from a data page into an adjacent code page of the same block must still
// leave the program at that page and retire the decoded block it overwrote
// (the widened window must stop short of the code page), and a pure data
// sweep must prove far fewer windows than the one-page re-guard
// (--uop-reguard-span=4096) while ending in the same state.
// uop_stats: 1 reguards, 4 enters, 14 pages the widening added.
function reguardWidenCase(inst, a, nextCode) {
  const { e, mem, g2w } = inst;
  const loop = asm([L('l'), [0x88, 0x07], 0x47, 0x49, J(cc.NZ, 'l'), 0xC3]); // mov [edi],al; inc edi; dec ecx; jnz; ret
  const errs = [];
  const st = (k) => e.uop_stats(k) >>> 0;
  const install = (Lc) => {
    const pc = e.uop_compile(Lc);
    if (!pc) { errs.push('store loop declined'); return false; }
    e.uop_install(Lc, pc);
    return true;
  };
  const arm = (span) => {
    // Fresh pages per arm: the previous arm left its code page rewritten.
    let D = nextCode(), P = nextCode();
    while ((D >>> 16) !== (P >>> 16)) { D = P; P = nextCode(); }
    const Lc = nextCode();
    mem.set(loop, g2w(Lc));
    e.set_uop_reguard_span(span);
    e.set_uop(1);
    if (!install(Lc)) return null;
    // 1. A pure data sweep over 16 pages of the buffer, four times.
    mem.fill(0, g2w(a.buf), g2w(a.buf) + 0x10000);
    const rg0 = st(1), wp0 = st(14), en1 = st(4);
    for (let i = 0; i < 4; i++) {
      if (!callAt(inst, a, Lc, { ecx: 0x10000, edi: a.buf, eax: 0x40 + i })) errs.push(`span ${span}: data sweep did not return`);
    }
    if (st(4) === en1) errs.push(`span ${span}: data sweep never entered`);
    let h = 0x811C9DC5;
    for (let k = 0; k < 0x10000; k++) h = Math.imul(h ^ mem[g2w(a.buf) + k], 16777619);
    const out = { reguards: st(1) - rg0, widened: st(14) - wp0, hash: h >>> 0 };
    // 2. From a data page into the code page after it, same 64KB block.
    mem.set([0xB8, 0x11, 0x11, 0x11, 0x11, 0xC3], g2w(P + 0x800));           // mov eax,0x11111111 ; ret
    callAt(inst, a, P + 0x800, {});
    if ((e.get_eax() >>> 0) !== 0x11111111) errs.push(`span ${span}: R before: eax ${(e.get_eax() >>> 0).toString(16)}`);
    const en0 = st(4);
    if (!callAt(inst, a, Lc, { ecx: 0x1005, edi: D + 0x800, eax: 0xB8 })) errs.push(`span ${span}: sweep into code did not return`);
    if (st(4) === en0) errs.push(`span ${span}: sweep into code never entered`);
    callAt(inst, a, P + 0x800, {});
    if ((e.get_eax() >>> 0) !== 0xB8B8B8B8) errs.push(`span ${span}: R after sweep: eax ${(e.get_eax() >>> 0).toString(16)} (stale decoded block)`);
    e.set_uop(0);
    return out;
  };
  try {
    const narrow = arm(0x1000);
    const wide = arm(0x10000);
    if (narrow && wide) {
      if (narrow.hash !== wide.hash) errs.push('data sweep: wide and narrow re-guards left different memory');
      if (narrow.widened) errs.push(`one-page re-guard widened ${narrow.widened} pages`);
      if (!wide.widened) errs.push('wide re-guard never widened');
      if (!(wide.reguards * 4 <= narrow.reguards)) errs.push(`wide re-guards ${wide.reguards} not well under narrow ${narrow.reguards}`);
      if (!errs.length) console.log(`reguard-widen      ok (data sweep re-guards: ${narrow.reguards} one-page, ${wide.reguards} widened, +${wide.widened} pages; code page still exits)`);
    }
  } finally {
    e.set_uop(0);
    e.set_uop_reguard_span(0x10000);
  }
  return errs;
}

// adc into memory whose store window fails (07e kind 20). A carry chain
// `adc eax,[esi] / adc [edi],eax` with lea steps, so CF runs from each adc
// into the next and both flag records are live: the RMW's entry state is the
// first adc's record. edi sweeps from a data page into the code page after it,
// so the store's window is refused there and the instruction re-executes
// threaded from its entry state -- which is only right if the lowering stores
// before it writes its own record. Compared, byte for byte, with the same
// sweep run threaded. (A store that overwrites the decoded block itself is
// window-keep's question; here the sweep stops short of it, and the block
// must still answer as before.)
function adcGuardCase(inst, a, nextCode) {
  const { e, mem, g2w } = inst;
  const errs = [];
  const arm = (on) => {
    const D = nextCode(), P = nextCode(), Lc = nextCode();
    if (P !== D + 0x1000) { errs.push('pages not adjacent'); return null; }
    // clc ; L: adc eax,[esi] ; adc [edi],eax ; lea esi,[esi+4] ; lea edi,[edi+4] ; dec ecx ; jnz L ; ret
    const code = asm([0xF8, L('l'), [0x13, 0x06], [0x11, 0x07], [0x8D, 0x76, 0x04], [0x8D, 0x7F, 0x04], 0x49, J(cc.NZ, 'l'), 0xC3]);
    mem.set(code, g2w(Lc));
    const dv = new DataView(mem.buffer);
    let x = 0x2545F491;
    for (let k = 0; k < 0x1000; k += 4) { x = Math.imul(x ^ (x >>> 15), 0x2C1B3C6D) >>> 0; dv.setUint32(g2w(a.buf) + k, x, true); }
    for (let k = 0; k < 0x1000; k += 4) { dv.setUint32(g2w(D) + k, Math.imul(k, 0x9E3779B1) >>> 0, true); dv.setUint32(g2w(P) + k, 0, true); }
    mem.set([0xB8, 0x11, 0x11, 0x11, 0x11, 0xC3], g2w(P + 0x800));           // mov eax,0x11111111 ; ret
    callAt(inst, a, P + 0x800, {});
    e.set_uop(on ? 1 : 0);
    const st0 = [0, 1, 4, 10].map((k) => e.uop_stats(k));
    // Window census, re-guard context (16) + 9: refused, the written window
    // would hold a code page -- the deopt this case exists for.
    e.set_uop_win_census(1);
    if (on) {
      const pc = e.uop_compile(Lc + 1);
      if (!pc) { errs.push('adc carry chain declined'); e.set_uop(0); return null; }
      e.uop_install(Lc + 1, pc);
    }
    // Twice over data only (the windows get proved), then into the code page.
    for (let i = 0; i < 2; i++) {
      if (!callAt(inst, a, Lc, { ecx: 0x3C0, esi: a.buf, edi: D, eax: 0x7FFFFFF0 + i })) errs.push('data sweep did not return');
    }
    if (!callAt(inst, a, Lc, { ecx: 0x100, esi: a.buf, edi: D + 0xF00, eax: 0xFFFFFFFF })) errs.push('sweep into code did not return');
    const out = {
      regs: [e.get_eax(), e.get_ecx(), e.get_esi() - a.buf, e.get_edi() - D].map((v) => v >>> 0),
      flags: e.uop_flags(),
      mem: Array.from(mem.subarray(g2w(D), g2w(D) + 0x2000)),
      d: [0, 1, 4, 10].map((k, i) => e.uop_stats(k) - st0[i]),
      codeRefused: e.uop_win_census(16 + 9),
    };
    e.set_uop_win_census(0);
    e.set_uop(0);
    callAt(inst, a, P + 0x800, {});
    out.r = e.get_eax() >>> 0;
    return out;
  };
  try {
    const off = arm(false), on = arm(true);
    if (off && on) {
      if (!on.d[2]) errs.push('never entered');
      if (!on.codeRefused) errs.push('the store window into the code page never failed');
      if (JSON.stringify(on.regs) !== JSON.stringify(off.regs)) errs.push(`regs ${on.regs.map((v) => v.toString(16))} vs ${off.regs.map((v) => v.toString(16))}`);
      if (on.flags !== off.flags) errs.push(`flags ${on.flags.toString(2)} vs ${off.flags.toString(2)}`);
      const k = on.mem.findIndex((v, i) => v !== off.mem[i]);
      if (k >= 0) errs.push(`memory differs at +0x${k.toString(16)}`);
      if (on.r !== off.r) errs.push(`R after sweep: eax ${on.r.toString(16)} vs ${off.r.toString(16)}`);
      if (off.r !== 0x11111111) errs.push(`R clobbered: eax ${off.r.toString(16)}`);
      if (off.mem[0x1000] === 0 && off.mem[0x1300] !== 0) errs.push('the sweep never reached the code page');
      if (!errs.length) console.log(`adc-guard-fail     ok (enters=${on.d[2]} reguards=${on.d[1]} refused-at-code-page=${on.codeRefused})`);
    }
  } finally {
    e.set_uop(0);
  }
  return errs;
}

// --handler-hist must measure the program with the tier running; --trace-eip
// (and --break/--watch/--count) must still hold it off, since they observe
// every block. 13-exports.wat $dbg_recompute: $dbg_tier_guard.
function histCase(inst, a, nextCode) {
  const c = CASES.find((x) => x.name === 'lut8');
  const errs = [];
  const off = runCase(inst, c, a, nextCode(), 'off');
  inst.e.set_handler_hist_enabled(1);
  try {
    const on = runCase(inst, c, a, nextCode(), 'hot');
    if (!on.enters) errs.push('handler histogram held the tier off');
    if (on.mem !== off.mem || JSON.stringify(on.regs) !== JSON.stringify(off.regs)) errs.push('tier under histogram diverged');
    inst.e.set_trace_eip_range(1, 0xFFFFFFF0, 0xFFFFFFFF);
    const tr = runCase(inst, c, a, nextCode(), 'hot');
    if (tr.enters) errs.push(`tier entered with --trace-eip armed (enters=${tr.enters})`);
    inst.e.set_trace_eip_range(0, 0, 0);
    if (!errs.length) console.log(`hist-keeps-tier    ok (enters=${on.enters} under --handler-hist, 0 under --trace-eip)`);
  } finally {
    inst.e.set_trace_eip_range(0, 0, 0);
    inst.e.set_handler_hist_enabled(0);
  }
  return errs;
}

// A loop whose head the tier declines (rdtsc is not lowered): the verdict
// settles, the page index marks the head no-bump (01-header PAGE_INDEX_NOBUMP),
// and later transfers into it skip the hot bump -- counted by
// get_uop_nobump_skips. With set_uop_nobump(0) nothing is marked, and both
// runs end in the same state as the tier off.
function nobumpCase(inst, a, nextCode) {
  const { e } = inst;
  const c = { name: 'nobump', regs: { ecx: 4096 },
    code: [L('l'), [0x0F, 0x31], 0x49, J(cc.NZ, 'l'), 0xC3] };
  const errs = [];
  const off = runCase(inst, c, a, nextCode(), 'off');
  const d0 = e.uop_cstat(1), s0 = e.get_uop_nobump_skips() >>> 0;
  const on = runCase(inst, c, a, nextCode(), 'hot');
  const skips = (e.get_uop_nobump_skips() >>> 0) - s0;
  if (e.uop_cstat(1) === d0) errs.push('head was not declined');
  if (skips < 1000) errs.push(`only ${skips} transfers skipped the bump`);
  e.set_uop_nobump(0);
  try {
    const s1 = e.get_uop_nobump_skips() >>> 0;
    const plain = runCase(inst, c, a, nextCode(), 'hot');
    if ((e.get_uop_nobump_skips() >>> 0) !== s1) errs.push('skips counted with the mark off');
    for (const [name, st] of [['on', on], ['mark off', plain]]) {
      if (!st.ok || st.regs[1] !== off.regs[1] || st.mem !== off.mem) errs.push(`${name} diverged from threaded`);
    }
  } finally {
    e.set_uop_nobump(1);
  }
  if (!errs.length) console.log(`nobump-mark        ok (${skips} of 4096 back edges skipped the bump)`);
  return errs;
}

// 07e-uop-compiler.wat's decline reasons, by code ($uop_decline_count).
const WAT_REASONS = [null, 'scan-limit', 'overlap', 'head-unsupported', 'no-backedge', 'loop-too-big',
  'seam-ambiguous', 'long-block', 'unreached-block', 'demand-no-fixpoint', 'branch-mid-block',
  'dead-flags-consumed', 'dead-cf', 'cf-no-recipe', 'cf-kind', 'dead-flags-rec', 'rec-no-recipe', 'rec-kind',
  'dead-flags-jcc', 'kind', 'too-many-windows', 'label', 'arg', 'too-many-temps', 'program-too-big',
  'ranges-full', 'scratch-overflow', 'call-indirect'];

async function main() {
  bench.ensureBuilt();
  const inst = await bench.newInstance();
  const { e } = inst;
  const a = bench.layout(inst.imageBase, 0x20000);
  a.thunk = e.get_thunk_base() >>> 0;   // an API thunk, for the thunk-zone refusal
  if (process.env.UOP_NOFOLD) for (const f of process.env.UOP_NOFOLD.split(",")) e["set_" + f + "_emit"](0);
  // UOP_CENSUS=1 BENCH_TRACE_LOOP=1: print the --uop-census records these
  // cases produce (a smoke test for tools/uop-census.js / uop-census-diff.js).
  if (process.env.UOP_CENSUS) e.set_uop_census(1);
  let slot = 0;
  let fails = 0;
  const only = process.env.UOP_CASE;
  const clocks = process.env.UOP_CLOCK ? [+process.env.UOP_CLOCK] : [0, 1];
  for (const clock of clocks) {
  e.set_branch_clock(clock);
  console.log(clock ? '-- branch clock (a block = an executed x86 branch)' : '-- block clock (threaded cuts charge)');
  for (const c of CASES) {
    if (only && c.name !== only) continue;
    const at = () => { const x = a.code + 0x1000 * slot; slot += c.pages || 1; return x; };
    const off = runCase(inst, c, a, at(), 'off');
    if (c.foldCheck) {
      // Threaded code with and without the loop fold: same state, same clock.
      // `off` above ran with the family's default; run both explicitly.
      const set = (v) => e[`set_${c.foldCheck}_emit`](v);
      const dflt = c.foldCheck === 'loop_lut' ? 1 : 0;
      set(1);
      const m0 = e.get_loop_matched_blocks();
      const fo = runCase(inst, c, a, a.code + 0x1000 * slot++, 'off');
      set(0);
      const nf = runCase(inst, c, a, a.code + 0x1000 * slot++, 'off');
      set(dflt);
      if (e.get_loop_matched_blocks() === m0) { fails++; console.log(`${c.name.padEnd(18)} FAIL: the loop was never folded`); continue; }
      const bad = [...(clock ? ['stops'] : []), 'mem', 'eip', 'flags'].filter((k) => nf[k] !== fo[k]);
      if (JSON.stringify(nf.regs) !== JSON.stringify(fo.regs)) bad.push('regs');
      if (bad.length) fails++;
      console.log(`${c.name.padEnd(18)} fold vs unfolded: ${bad.length ? 'FAIL ' + bad.join(',') + ` (${fo.stops} vs ${nf.stops})` : 'ok'}`);
      continue;
    }
    const results = [];
    // hotOnly: an inline cache records what the slot holds when the head is
    // compiled, which a pre-compile (before the prologue has run) cannot see.
    for (const mode of c.hotOnly ? ['hot'] : ['hot', 'pre']) {
      const st = runCase(inst, c, a, at(), mode);
      if (st.err && c.declines) { results.push(`${mode}: ok (${st.err})`); continue; }
      if (st.err) { results.push(`${mode}: ${st.err}`); fails++; continue; }
      if (c.declines && st.enters) { results.push(`${mode}: FAIL entered a case that must decline`); fails++; continue; }
      const diffs = [];
      if (st.sp && c.aggr) {
        for (const [kk, v] of Object.entries(c.aggr)) { const [k, ck] = kk.split('@'); if (ck !== undefined && +ck !== clock) continue; if (st.sp[k] !== v) diffs.push(`${k}=${st.sp[k]} want ${v}`); }
        if (process.env.UOP_SP) console.log(c.name, JSON.stringify(st.sp));
      }
      if (!st.ok) diffs.push('did not return');
      if (c.trace && !st.traces) diffs.push('no trace was formed');
      if (c.lf && (st.lf !== off.lf || !off.lf || (c.lfEvery && off.lf !== N))) diffs.push(`logical frames ${st.lf} vs ${off.lf}`);
      if (st.eip !== off.eip) diffs.push(`eip ${st.eip.toString(16)} vs ${off.eip.toString(16)}`);
      if (st.flags !== off.flags) diffs.push(`flags ${st.flags.toString(2)} vs ${off.flags.toString(2)}`);
      if (st.mem !== off.mem) diffs.push('memory differs');
      if (st.mmx !== off.mmx) diffs.push(`mmx ${st.mmx} vs ${off.mmx}`);
      // Batch stops. Under the block clock the program charges the cuts
      // threaded code makes once it has split at every in-loop entry (steady
      // state); "pre" installs before threaded code has taken every path, so
      // during warmup threaded runs unsplit blocks and the stops legitimately
      // differ there. A case with a loop threaded code FOLDS is one block per
      // fold run on the block clock, which a program charging trips cannot
      // match. The branch clock has no history, so both must match.
      if (((mode === 'hot' && !c.folds && !c.dynamicEntry) || clock) && st.stops !== off.stops) {
        const x = st.stops.split(','), y = off.stops.split(',');
        let k = 0; while (k < x.length && x[k] === y[k]) k++;
        diffs.push(`batch ${k} stops at ${x[k]} vs ${y[k]} (${st.nstops} vs ${off.nstops} batches)`);
      }
      REGS.forEach((r, k) => { if (st.regs[k] !== off.regs[k]) diffs.push(`${r} ${st.regs[k].toString(16)} vs ${off.regs[k].toString(16)}`); });
      if (!st.enters && !c.declines && !(c.mayStayCold && mode === 'hot')) diffs.push('never entered');
      // counters the feature must move: '>0', or an exact count
      for (const [k, v] of Object.entries(c.want || {})) {
        if (v === '>0' ? !(st.ctr[k] > 0) : st.ctr[k] !== v) diffs.push(`${k}=${st.ctr[k]} want ${v}`);
      }
      if (diffs.length) fails++;
      const ctrs = Object.entries(st.ctr).filter(([, v]) => v).map(([k, v]) => ` ${k}=${v}`).join('');
      results.push(`${mode}: ${diffs.length ? 'FAIL ' + diffs.join(', ') : 'ok'} (enters=${st.enters} blocks=${st.blocks}${ctrs})`);
    }
    console.log(`${c.name.padEnd(18)} ${results.join(' | ')}`);
  }
  }
  e.set_branch_clock(0);
  for(const [name,run] of [['movsd-sparse',movsdSparseCase],['movsd-code-write',movsdCodeCase],
                           ['rep-oracle',repOracleCase],['rep-sparse',repSparseCase],['rep-code-write',repCodeWriteCase],
                           ['pcx-body',pcxBodyCase],['mcopy-code-write',mcopyCodeCase]]){
    if(!only||only===name){
      const errs=run(inst,a,()=>a.code+0x1000*slot++);
      if(errs.length)fails++;
      console.log(`${name.padEnd(18)} ${errs.length?'FAIL '+errs.join(', '):'ok'}`);
    }
  }
  if (!only || only === 'trace-limits') {
    const errs = traceLimitsCase(inst, a, () => a.code + 0x1000 * slot++);
    if (errs.length) { fails++; console.log(`trace-limits       FAIL ${errs.join(', ')}`); }
  }
  if (!only || only === 'trace-poor-work') {
    const errs = tracePoorWorkCase(inst, a, () => a.code + 0x1000 * slot++);
    if (errs.length) { fails++; console.log(`trace-poor-work    FAIL ${errs.join(', ')}`); }
  }
  if (!only || only === 'window-keep') {
    const errs = windowCase(inst, a, () => a.code + 0x1000 * slot++);
    if (errs.length) { fails++; console.log(`window-keep        FAIL ${errs.join(', ')}`); }
  }
  if (!only || only === 'code-write-gate') {
    const errs = codeWriteCase(inst, a, () => a.code + 0x1000 * slot++);
    if (errs.length) { fails++; console.log(`code-write-gate    FAIL ${errs.join(', ')}`); }
  }
  if (!only || only === 'hot-age') {
    const errs = hotAgeCase(inst, a, () => a.code + 0x1000 * slot++);
    if (errs.length) { fails++; console.log(`hot-age            FAIL ${errs.join(', ')}`); }
  }
  if (!only || only === 'stale-enter') {
    const errs = staleEnterCase(inst, a, () => a.code + 0x1000 * slot++);
    if (errs.length) { fails++; console.log(`stale-enter        FAIL ${errs.join(', ')}`); }
  }
  if (!only || only === 'reguard-widen') {
    const errs = reguardWidenCase(inst, a, () => a.code + 0x1000 * slot++);
    if (errs.length) { fails++; console.log(`reguard-widen      FAIL ${errs.join(', ')}`); }
  }
  if (!only || only === 'adc-guard-fail') {
    const errs = adcGuardCase(inst, a, () => a.code + 0x1000 * slot++);
    if (errs.length) { fails++; console.log(`adc-guard-fail     FAIL ${errs.join(', ')}`); }
  }
  if (!only || only === 'hist-keeps-tier') {
    const errs = histCase(inst, a, () => a.code + 0x1000 * slot++);
    if (errs.length) { fails++; console.log(`hist-keeps-tier    FAIL ${errs.join(', ')}`); }
  }
  if (!only || only === 'nobump-mark') {
    const errs = nobumpCase(inst, a, () => a.code + 0x1000 * slot++);
    if (errs.length) { fails++; console.log(`nobump-mark        FAIL ${errs.join(', ')}`); }
  }
  const cs = (k) => e.uop_cstat(k);
  const why = WAT_REASONS.map((n, k) => [n, k && e.uop_decline_count(k)]).filter(([, n]) => n).map(([k, n]) => `${k}=${n}`).join(' ');
  if (process.env.UOP_CENSUS) e.uop_census_dump();
  console.log(`uop compiler: compiled=${cs(0)} declined=${cs(1)} insns=${cs(2)} uops=${cs(3)} flushes=${cs(4)}${why ? '\n  declines: ' + why : ''}`);
  console.log(`reguards=${e.uop_stats(1)} guard-fails=${e.uop_stats(0)} kills=${e.uop_stats(3)}`);
  if (fails) { console.log(`FAIL: ${fails}`); process.exit(1); }
  console.log('PASS');
}

main().catch((err) => { console.error(err.stack || String(err)); process.exit(1); });
