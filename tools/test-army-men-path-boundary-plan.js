'use strict';
// Evaluate the actual runner address-expression resolver with synthetic memory.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const {flags}=require('./army-men-path-boundary-plan');
const source=fs.readFileSync(process.argv[2]+'/test/run.js','utf8');
const start=source.indexOf('const parseAddrExpr = (expr) =>');
const end=source.indexOf('const parts = [];',start);assert(start>=0&&end>start);
const memory=new ArrayBuffer(0x4000),dv=new DataView(memory),regs={ebp:0x1000,ebx:0x2000};
dv.setUint32(regs.ebx,0x3000,true);
const parse=vm.runInNewContext(source.slice(start,end)+'\nparseAddrExpr;',{dv,g2w:x=>x,regValue:r=>regs[r]??null,e:{}});
assert.equal(parse('ebp-0x234'),0xdcc);assert.equal(parse('*ebx'),0x3000);assert.equal(parse('ebx'),0x2000);
new Uint8Array(memory).set(Buffer.from('c:/campaigns\0'),parse('ebp-0x234'));
new Uint8Array(memory).set(Buffer.from('\0:/campaigns\0'),parse('*ebx'));
assert.equal(dv.getUint8(parse('ebp-0x234')),99);assert.equal(dv.getUint8(parse('*ebx')),0);
assert.equal(flags.filter(s=>s.startsWith('--trace-at=')).length,1);
assert(!flags.some(s=>s.includes('--trace-api')||s.includes('--break')||s.includes('--skip')));
assert(flags.includes('--trace-at-limit=8'));
console.log('PASS actual trace-at expression resolver distinguishes preserved fullpath and CString buffers; no guest executed');
