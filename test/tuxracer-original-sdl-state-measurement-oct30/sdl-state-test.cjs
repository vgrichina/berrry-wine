'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const {sampleSDL}=require('./sdl-state.cjs');
const code=Buffer.from('8b44240485c074090fbf0da04f031089088b44240885c074090fbf15a44f03108910a0b04f0310c3','hex');
function fixture(base){const memory={buffer:new ArrayBuffer(0x40000)};new Uint8Array(memory.buffer,106784,code.length).set(code);const dv=new DataView(memory.buffer);dv.setInt16(0x34fa0,320,true);dv.setInt16(0x34fa4,260,true);dv.setInt16(0x34fa8,-4,true);dv.setUint8(0x34fb0,1);return {mods:{'sdl.dll':{loadAddr:base,origBase:0x10000000}},memory,g2w:a=>a-base,tickState:{batch:7},renderer:{_mouseX:320,_mouseY:240,_mouseButtonsMask:1}};}
const run=c=>vm.runInNewContext('('+sampleSDL.toString()+')()',c);
for(const base of [0x10000000,0x12000000]){const c=fixture(base),before=Buffer.from(c.memory.buffer);const s=run(c);assert.equal(s.x,320);assert.equal(s.y,260);assert.equal(s.relativeX,-4);assert.equal(s.buttons,1);assert.equal(s.host.y,240);assert(before.equals(Buffer.from(c.memory.buffer)));}
let c=fixture(0x10000000);new Uint8Array(c.memory.buffer)[106784]^=1;assert.throws(()=>run(c),/code mismatch/);
c=fixture(0x10000000);c.g2w=()=>240;assert.throws(()=>run(c),/unmapped/);
c=fixture(0x10000000);c.mods={};assert.throws(()=>run(c),/absent/);
c=fixture(0x10000000);c.mods['sdl.dll'].origBase=0;assert.throws(()=>run(c),/original base/);
console.log(JSON.stringify({PASS:true,positive:2,rejecting:4,readOnly:true,productionGuestExecuted:false}));
