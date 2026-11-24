#!/usr/bin/env node
// Full production decoder + compiled WAT; run after tools/build.sh.
// AF=1 cannot be installed by the current POPFD; AF is undefined for nonzero shifts.
'use strict';
const fs = require('fs'), crypto = require('crypto'), path = require('path');
const root = path.resolve(__dirname, '..');
// Independent mathematical concatenation. No production helper is imported.
function expected(bits, right, dst, src, count, flags) {
  const w = BigInt(bits), mask = (1n << w) - 1n, c = BigInt(count & 31);
  const d = BigInt(dst >>> 0) & mask, s = BigInt(src >>> 0) & mask;
  if (!c) return { result: Number(d), expectedFlags: flags, flagMask: 0xffffffff };
  if (c > w) return { result: null, expectedFlags: flags, flagMask: 0 }; // undefined
  const concat = right ? (s << w) + d : (d << w) + s;
  const r = right ? (concat >> c) & mask : ((concat << c) >> w) & mask;
  const cf = Number(right ? (d >> (c - 1n)) & 1n : (d >> (w - c)) & 1n);
  const sf = Number((r >> (w - 1n)) & 1n);
  let parity = 0; for (let i = 0n; i < 8n; i++) parity ^= Number((r >> i) & 1n);
  const of = Number(((d ^ r) >> (w - 1n)) & 1n);
  const flagMask = (c === 1n ? 0xffffffff : 0xfffff7ff) & ~0x10; // AF undefined
  const expectedFlags = (flags & ~0x8d5) | cf | ((1 ^ parity) << 2)
    | (Number(r === 0n) << 6) | (sf << 7) | (of << 11);
  return { result: Number(r), expectedFlags: expectedFlags >>> 0, flagMask: flagMask >>> 0 };
}
// Literal bit examples pin the oracle's direction, sign transition and carry.
for (const [bits, right, dst, src, result, flags] of [
  [16, true, 0, 1, 0x8000, 0xa86],
  [16, false, 0x4000, 0, 0x8000, 0xa86],
  [32, true, 0, 1, 0x80000000, 0xa86],
  [32, false, 0x80000000, 0, 0, 0xa47],
]) {
  const got = expected(bits, right, dst, src, 1, 0x202);
  if (got.result !== result || ((got.expectedFlags ^ flags) & 0x8c5))
    throw new Error('Double-shift concatenation oracle disagrees with literal bits');
}
const cases = [];
for (const bits of [16, 32]) for (const right of [false, true])
for (const form of ['reg', 'abs', 'base', 'sib'])
for (const pair of (form === 'reg' ? [[0,2], [1,2], [0,1], [2,2]] : [[0,2], [0,1]]))
for (const mode of ['imm', 'cl'])
for (const count of [0,1,2,15,16,17,31,32,33,48,255])
for (const [value, source] of [[0,0], [0x80008000,1], [0x40004000,0x80008000],
  [0xffffffff,0], [0x12345678,0x87654321], [1,0xffffffff]])
for (const flags of [0x202,0xa87,0x247]) {
  const [destReg, srcReg] = pair;
  const regs = [0xa55ac33c, 0x12340004, 0xaced1122, 0, 0, 0x0badf00d, 3, 0x12345678];
  regs[srcReg] = source;
  if (form === 'reg') regs[destReg] = value;
  if (mode === 'cl') regs[1] = ((regs[1] & ~255) | count) >>> 0;
  const dst = form === 'reg' ? regs[destReg] : value, src = regs[srcReg];
  cases.push({bits,right,form,destReg,srcReg,mode,count,value,flags,regs,
    ...expected(bits,right,dst,src,count,flags)});
}
async function main() {
  const bytes = fs.readFileSync(process.env.WINE_ASSEMBLY_WASM || `${root}/build/wine-assembly.wasm`);
  const module = await WebAssembly.compile(bytes);
  const memory = new WebAssembly.Memory({initial:8192, maximum:8192, shared:true});
  const imports = {};
  for (const imp of WebAssembly.Module.imports(module)) {
    const ns = imports[imp.module] ||= {};
    if (imp.kind === 'memory') ns[imp.name] = memory;
    else if (imp.kind === 'function') ns[imp.name] = () => 0;
    else throw new Error(`Unexpected import ${imp.kind}`);
  }
  const e = (await WebAssembly.instantiate(module, imports)).exports;
  const mem = new Uint8Array(memory.buffer), dv = new DataView(memory.buffer);
  const pe = fs.readFileSync(`${root}/test/binaries/notepad.exe`);
  mem.set(pe,e.get_staging()); e.load_pe(pe.length);
  const image = e.get_image_base(), g2w = a => require(`${root}/lib/region-map.generated.js`).g2w(a,image);
  const data = image+0x800000, before=data+0x100, after=before+4, stack=image+0xd00000;
  const le32 = x => [x&255,(x>>>8)&255,(x>>>16)&255,x>>>24];
  const names = ['eax','ecx','edx','ebx','esp','ebp','esi','edi'];
  const frozen = cases;
  const codeCache = new Map(), failures = [], categories = {};
  for (const t of frozen) {
    const {bits,right,form,destReg,srcReg,mode,count,value,flags} = t;
    const operand = form === 'reg' ? [0xc0 | (srcReg<<3) | destReg]
      : form === 'abs' ? [0x05 | (srcReg<<3), ...le32(data)]
      : form === 'base' ? [0x43 | (srcReg<<3),0x10]
      : [0x44 | (srcReg<<3),0xb3,0x10];
    const instruction = [...(bits===16?[0x66]:[]),0x0f,(right?0xac:0xa4)+(mode==='cl'?1:0),
      ...operand,...(mode==='imm'?[count]:[])];
    const code = [0x68,...le32(flags),0x9d,0x9c,0x8f,0x05,...le32(before),
      ...instruction,0x9c,0x8f,0x05,...le32(after),0xc3];
    const key = code.join(','); let address = codeCache.get(key);
    if (!address) {
      address = image+0x100000+codeCache.size*128;
      mem.set(code,g2w(address)); codeCache.set(key,address);
    }
    const regs=t.regs.slice(); regs[3]=data-0x10-(form==='sib'?12:0); regs[4]=stack;
    for (let i=0;i<8;i++) e[`set_${names[i]}`](regs[i]);
    mem.fill(0x5a,g2w(data-8),g2w(data+12));
    for (let i=0;i<bits/8;i++) mem[g2w(data+i)]=(value>>>(8*i))&255;
    const memoryBefore=mem.slice(g2w(data-8),g2w(data+12));
    dv.setUint32(g2w(stack),0,true); e.set_eip(address); e.run(10000);
    const issues=[], observedBefore=dv.getUint32(g2w(before),true),observedAfter=dv.getUint32(g2w(after),true);
    if (observedBefore!==flags) issues.push('fixture-flags');
    if (((observedAfter^t.expectedFlags)&t.flagMask)!==0) {
      for (const [name,mask] of [['CF',1],['PF',4],['ZF',64],['SF',128],['OF',2048],['other',0xfffff72a]])
        if (((observedAfter^t.expectedFlags)&t.flagMask&mask)!==0) issues.push(name);
    }
    const expectRegs=regs.slice(); expectRegs[4]=stack+4;
    if (t.result!==null) {
      if (form==='reg') expectRegs[destReg]=bits===32?t.result:((regs[destReg]&0xffff0000)|t.result)>>>0;
      else for (let i=0;i<bits/8;i++) memoryBefore[8+i]=(t.result>>>(8*i))&255;
    }
    for (let i=0;i<8;i++) {
      if (t.result===null && form==='reg' && i===destReg) {
        if (bits===16 && ((e[`get_${names[i]}`]()^regs[i])&0xffff0000)!==0) issues.push('upper-half');
      } else if ((e[`get_${names[i]}`]()>>>0)!==(expectRegs[i]>>>0)) issues.push(`register-${names[i]}`);
    }
    const actual=mem.slice(g2w(data-8),g2w(data+12));
    for (let i=0;i<actual.length;i++) {
      if (t.result===null && form!=='reg' && i>=8 && i<8+bits/8) continue;
      if (actual[i]!==memoryBefore[i]) {issues.push('memory');break;}
    }
    if (e.get_eip()!==0) issues.push('return');
    if (issues.length) {
      for (const issue of issues) categories[issue]=(categories[issue]||0)+1;
      failures.push({...t, observedBefore, observedAfter, issues, eax:e.get_eax()>>>0});
    }
  }
  const result={checked:frozen.length, passed:frozen.length-failures.length, failed:failures.length,categories,
    moduleSha256:crypto.createHash('sha256').update(bytes).digest('hex'),failures};
  if (process.env.PROBE_OUT) fs.writeFileSync(process.env.PROBE_OUT,JSON.stringify(result,null,2));
  console.log(JSON.stringify({...result,failures:failures.slice(0,6)},null,2));
  process.exitCode=failures.length?1:0;
}
main().catch(err=>{console.error(err);process.exitCode=1;});
