'use strict';
// Independent synthetic control memory only. This never opens the test box.
const fs=require('fs'),assert=require('assert/strict'),crypto=require('crypto');
const bytes=fs.readFileSync(process.env.AOE3_CONTROL_MODULE||__dirname+'/control-module.wasm');
const moduleObject=new WebAssembly.Module(bytes),memory=new WebAssembly.Memory({initial:8192,maximum:32768,shared:true});
const imports={};for(const i of WebAssembly.Module.imports(moduleObject)){imports[i.module]||={};imports[i.module][i.name]=i.kind==='memory'?memory:()=>0;}
const rows=[];imports.host.log_eip=ip=>rows.push(ip>>>0);
const e=new WebAssembly.Instance(moduleObject,imports).exports;
e.init_thread(0,0x400000,0x400000,0xb00000,0,0,0,0);
const code=(a,b)=>b.forEach((v,i)=>e.guest_write8(a+i,v));
const A=0x489ec9,T=0x8e4bc0,S=0x700000;
// Exact original E8 rel32 bytes at 489ec9, then a stop loop; control callee ret.
code(A,[0xe8,0xf2,0xac,0x45,0,0x83,0xc4,0x0c,0xeb,0xfe]);code(T,[0xc3]);
e.set_esp(S);e.set_eip(A);e.set_trace_eip_range(1,0x400000,0xb00000);e.run(4);
assert(rows.includes(A));assert(rows.includes(T));assert(rows.includes(0x489ece));
console.log(JSON.stringify({pass:true,controlOnly:true,moduleSha256:crypto.createHash('sha256').update(bytes).digest('hex'),rows,scope:'exact original direct CALL opcode; synthetic RET callee, not native COM or full original-function coverage'}));
