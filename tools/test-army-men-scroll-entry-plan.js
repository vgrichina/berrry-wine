'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const runtime=process.argv[2],exe=process.argv[3];assert(runtime&&exe);
const plan=require('./army-men-scroll-entry-plan'),src=fs.readFileSync(path.join(runtime,'test/run.js'),'utf8');
const begin=src.indexOf('const parseAddrExpr = (expr) =>'),end=src.indexOf('const parts = [];',begin);
const dv=new DataView(new ArrayBuffer(8192));dv.setUint32(4096,2048,true);
const parse=vm.runInNewContext(src.slice(begin,end)+'\nparseAddrExpr;',{dv,g2w:x=>x===0x4744d8?4096:x,regValue:r=>({esp:1024,ecx:7,edx:9})[r]??null,e:{}});
assert.equal(parse('esp'),1024);assert.equal(parse('0x4744d8'),0x4744d8);assert.equal(parse('*0x4744d8'),2048);
assert(plan.flags.includes('--trace-at=0x4074f1'));assert(plan.flags.includes('--trace-at-limit=8'));
const pe=fs.readFileSync(exe),nt=pe.readUInt32LE(0x3c),opt=nt+24,base=pe.readUInt32LE(opt+28);assert.equal(base,0x400000);
function raw(va){const rva=va-base,n=pe.readUInt16LE(nt+6),s=opt+pe.readUInt16LE(nt+20);for(let i=0;i<n;i++){const p=s+i*40,start=pe.readUInt32LE(p+12),size=pe.readUInt32LE(p+16);if(rva>=start&&rva<start+size)return pe.readUInt32LE(p+20)+rva-start;}throw Error('unmapped');}
assert.equal(pe.subarray(raw(0x4074e2),raw(0x4074e2)+2).toString('hex'),'750d','jne targets4074f1');
assert.equal(pe.subarray(raw(0x4074f1),raw(0x407503)+3).toString('hex'),'8d4424006a1050a1d8444700505251508b00ff501c','actual pushes and indirect BltFast');
console.log('PASS original instruction/branch mapping and actual pre-push pointer decoder; source only');
