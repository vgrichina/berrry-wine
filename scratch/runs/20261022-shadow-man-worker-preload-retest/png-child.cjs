'use strict';
const assert=require('assert'),ROOT='/home/user/shadow-man-tools-ready-oct22/runtime';
const {createCanvas}=require(ROOT+'/lib/canvas-compat'),{g2w}=require(ROOT+'/lib/mem-utils');
const canvas=createCanvas(8,6),cx=canvas.getContext('2d');cx.fillStyle='#ff0000';cx.fillRect(0,0,8,6);
require(ROOT+'/lib/host-imports').createHostImports({renderer:{canvas,repaint:()=>{}},vfs:{files:new Map()}});
(async()=>{
 const memory=new WebAssembly.Memory({initial:4}),dv=new DataView(memory.buffer);
 const h={memory,log:()=>{},log_api_exit:()=>{},process_spawn:()=>33};
 await WebAssembly.instantiate({}, {host:h});
 const name=Buffer.from('ShowWindow\0');new Uint8Array(memory.buffer).set(name,128);
 const addr=g2w(0x1000,0,memory.buffer);dv.setUint32(addr,123,true);dv.setUint32(addr+4,99,true);dv.setUint32(addr+8,1,true);
 h.log(128,name.length);let stopped=false;
 try{h.log_api_exit();}catch(e){assert.match(String(e),/authorized first-boundary stop/);stopped=true;}
 assert(stopped);
})().catch(e=>{console.error(e);process.exitCode=1});
