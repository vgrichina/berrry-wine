#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { bootRenderHarness } = require('./render-helper');
const Shader = require('../lib/d3d9-shader');
const IR = require('../lib/d3d-shader-ir');
(async () => {
  const included = fs.readFileSync(path.join(__dirname, '../src/main.watx'), 'utf8').includes('09af-d3d-shader-ir.wat');
  const extraWat = (included ? '' : fs.readFileSync(path.join(__dirname, '../src/09af-d3d-shader-ir.wat'), 'utf8'))
    + '\n(export "test_d3d_ir_phase_split" (func $d3d_ir_phase_split))\n'
    + '(export "test_d3d_ir_scan14" (func $d3d_ir_scan14))\n';
  const { exports: e, memory } = await bootRenderHarness({ fonts: 'none', extraWat });
  const guest = e.guest_alloc(65536 * 4) >>> 0;
  const ptr = e.guest_to_wasm(guest) >>> 0;
  const words = new Uint32Array(memory.buffer, ptr, 65536);
  const vs = 0xfffe0101, ps = 0xffff0101;
  const dst = (bank, n = 0, mask = 15, shift = 0, sat = 0) => (0x80000000 | bank << 28 | n | mask << 16 | shift << 24 | sat << 20) >>> 0;
  const src = (bank, n = 0, swizzle = 0xe4, mod = 0, relative = false) => (0x80000000 | bank << 28 | n | swizzle << 16 | mod << 24 | (relative ? 8192 : 0)) >>> 0;
  function compile(code) {
    words.fill(0, 0, code.length + 1); words.set(code);
    return e.d3d_shader_ir_compile(ptr, code.length) >>> 0;
  }
  // D3D9-CREATE-DRAW-SHADER-AGREEMENT: every shape the native IR accepts must
  // also compile in the software VM, or the draw refuses what create accepted.
  function vmAgrees(p,code){
    const vm=e.d3d_shader_vm_compile(p)>>>0;
    assert.ok(vm,`IR-accepted shader refused by the VM: ${code.map(x=>(x>>>0).toString(16)).join(' ')}`);
    e.d3d_shader_vm_free(vm);
  }
  function good(code) {
    const p = compile(code);
    assert.ok(p, `native error ${e.d3d_shader_ir_error()} at ${e.d3d_shader_ir_error_offset()}: ${code.map(x=>x.toString(16))}`);
    const ir = IR.read(memory.buffer, p);
    const legacy = Shader.compile(Uint32Array.from(code));
    const lowered = Shader.compileNativeIR(ir);
    assert.strictEqual(lowered.source, legacy.source, 'normalized WAT IR preserves GLSL output');
    assert.deepStrictEqual(lowered.attributes, legacy.attributes);
    assert.deepStrictEqual(lowered.uniforms, legacy.uniforms);
    assert.deepStrictEqual(lowered.semantics, legacy.semantics);
    assert.strictEqual(ir.length, legacy.length);
    const copy = new Uint8Array(memory.buffer, p, IR.HEADER_BYTES + ir.instructions.length * IR.INSTRUCTION_BYTES).slice();
    words.fill(0, 0, code.length);
    assert.deepStrictEqual(new Uint8Array(memory.buffer, p, copy.length), copy, 'IR owns immutable normalized data');
    vmAgrees(p,code);
    e.d3d_shader_ir_free(p); e.d3d_shader_ir_free(p); e.d3d_shader_ir_free(0xffffffff);
    return ir;
  }
  function bad(code, error, offset) {
    assert.strictEqual(compile(code), 0, 'malformed/unsupported input must fail');
    if (error !== undefined) assert.strictEqual(e.d3d_shader_ir_error(), error);
    if (offset !== undefined) assert.strictEqual(e.d3d_shader_ir_error_offset(), offset);
  }
  // PS1.4 is public: the native compile routes it to its own validator.
  const ps14 = 0xffff0104;
  for (const version of [ps, 0xffff0102, 0xffff0103]) {
    assert.strictEqual(e.d3d_shader_ir_arity_version(version,64),1);
    assert.strictEqual(e.d3d_shader_ir_arity_version(version,66),1);
    for(const opcode of [87,89,0xfffd])assert.strictEqual(e.d3d_shader_ir_arity_version(version,opcode),-1);
  }
  for(const [opcode,arity] of [[0,0],[64,2],[65,1],[66,2],[87,1],[88,4],[89,3],[0xfffd,0]])
    assert.strictEqual(e.d3d_shader_ir_arity_version(ps14,opcode),arity);
  for(const opcode of [6,31,67,68,69,70,71,72,73,74,75,76,82,83,84,85,86,90])
    assert.strictEqual(e.d3d_shader_ir_arity_version(ps14,opcode),-1);
  assert.strictEqual(e.d3d_shader_ir_arity_version(0xffff0200,66),-1);
  function split(code,expected,error,offset) {
    words.set(code);
    assert.strictEqual(e.test_d3d_ir_phase_split(ptr,code.length),expected);
    if(error!==undefined)assert.strictEqual(e.d3d_shader_ir_error(),error);
    if(offset!==undefined)assert.strictEqual(e.d3d_shader_ir_error_offset(),offset);
  }
  split([ps14,1,dst(0),src(1),65535],0); // no marker means phase2
  split([ps14,64,dst(0,0,7),src(3),0xfffd,1,dst(0),src(1),65535],4);
  split([ps14,66,dst(0),src(3),0xfffd,87,dst(0,5),65535],4);
  split([ps14,81,dst(2),0xfffd,0,0,0,0x0002fffe,0xfffd,65535,65535],0);
  split([ps14,0xfffd,0xfffd,65535],-1,16,2);
  split([ps14,0x4000fffd,65535],-1,16,1);
  split([ps14,66,dst(0)],-1,4,1);
  split([ps14,0x0003fffe,0xfffd,65535],-1,4,1);
  split([ps14,67,dst(0),src(3),65535],-1,3,1);
  split([ps14,0],-1,4,2);
  good([ps14,1,dst(0),src(1),65535]); // phase-2 mov r0, v1
  function scan14(body,expected,error) {
    const code=[ps14,...body,65535];words.set(code);
    const result=e.test_d3d_ir_scan14(ptr,code.length,0);
    assert.strictEqual(result,expected,`PS1.4 arithmetic validator error ${e.d3d_shader_ir_error()} at ${e.d3d_shader_ir_error_offset()}`);
    if(error!==undefined)assert.strictEqual(e.d3d_shader_ir_error(),error);
    if(expected>=0){
      const output=ptr+131072,bytes=32+128*expected;
      new Uint8Array(memory.buffer,output,bytes).fill(0);
      const header=new Uint32Array(memory.buffer,output,8);
      header.set([0x44534952,1,1,ps14,expected,code.length,bytes,body.some(x=>(x>>>0)>>>16===0x4000)?2:0]);
      assert.strictEqual(e.test_d3d_ir_scan14(ptr,code.length,output),expected);
      const view=IR.read(memory.buffer,output);
      assert.strictEqual(Shader.compileIR(view).source,Shader.compile(Uint32Array.from(code)).source,'PS1.4 shared normalized IR lowers identically');
      vmAgrees(output,code);
    }
  }
  scan14([1,dst(0,5),src(1),1,dst(0),src(0,5)],2);
  // Read ports are per instruction (Microsoft ps_1_x Registers: 1.4 c#2, r#3);
  // a coissued pair has no combined limit. B&W2's grass.sdv pair reads four
  // distinct temps, and two constants per half is four across the pair.
  const temps4=[1,dst(0,1),src(2,0),1,dst(0,2),src(2,1),1,dst(0,3),src(2,2),1,dst(0,4),src(2,3)];
  scan14([...temps4,5,dst(0,0,7),src(0,1),src(0,2),0x40000002,dst(0,0,8),src(0,3),src(0,4)],6);
  scan14([...temps4,4,dst(0,0,7),src(0,1),src(0,2),src(0,3),0x40000004,dst(0,0,8),src(0,4),src(0,2),src(0,1)],6);
  scan14([2,dst(0,0,7),src(2,0),src(2,1),0x40000002,dst(0,0,8),src(2,2),src(2,3)],2);
  scan14([4,dst(0),src(2,0),src(2,1),src(2,2)],-1,18); // three constants in one instruction
  scan14([4,dst(0),src(2,0),src(2,1),src(2,0)],1); // a repeated constant is one port
  scan14([1,dst(0),src(1),0xfffd,1,dst(0),src(2)],-1,6); // v phase1 forbidden
  scan14([1,dst(0,5),src(2),0xfffd,1,dst(0,0,7),src(0,5),1,dst(0,0,8),src(1,0,255)],4);
  scan14([1,dst(0,5),src(2),0xfffd,1,dst(0),src(0,5)],-1,17); // lost alpha
  scan14([1,dst(0,5),src(2),0xfffd,1,dst(0,5,8),src(1,0,255),1,dst(0),src(0,5)],4);
  scan14([1,dst(0,6),src(2)],-1,6);
  scan14([1,dst(0),src(3)],-1,6); // read-only coordinate isn't arithmetic source
  scan14([1,dst(3),src(2)],-1,6);
  scan14([1,dst(0),src(2,0,228,1)],-1,7); // no constant source modifiers in1.4
  for(const swizzle of [0,85,170,255,228])scan14([1,dst(0),src(1,0,swizzle)],1);
  scan14([1,dst(0),src(1,0,177)],-1,7);
  for(const shift of [0,1,2,3,13,14,15])scan14([1,dst(0,0,1,shift,1),src(1,0,0)],1);
  for(const shift of [4,12])scan14([1,dst(0,0,1,shift),src(1,0,0)],-1,7);
  scan14([1,dst(0,5,1),src(2),80,dst(0,0,1),src(0,5),src(1),src(2)],2); // component CND
  scan14([1,dst(0,5,1),src(2),80,dst(0,0,2),src(0,5),src(1),src(2)],-1,17);
  const eight=Array.from({length:8},()=>[1,dst(0),src(2)]).flat();
  scan14(eight,8);scan14([...eight,1,dst(0),src(2)],-1,19);
  scan14([...eight,0xfffd,...eight],17);
  scan14([1,dst(0,0,1),src(2),0x40000001,dst(0,0,8),src(1,0,255)],2);
  scan14([1,dst(0,0,1),src(2),0x40000001,dst(0,0,8),src(0,0,0)],-1,17); // pair sees pre-write r0
  scan14([1,dst(0),src(2),1,dst(0,0,1),src(2),0x40000001,dst(0,0,8),src(0,0,0)],3);
  scan14([1,dst(0,0,1),src(2),0xfffd,0x40000001,dst(0,0,8),src(2)],-1,9);
  scan14([9,dst(0,0,7),src(1),src(2),0x40000001,dst(0,0,8),src(1,0,255)],-1,9);
  scan14([1,dst(0),src(2),88,dst(0),src(0),src(1),src(2)],2); //1.4 CMP permits own alias
  scan14(Array.from({length:8},()=>[88,dst(0),src(1),src(2),src(2,1)]).flat(),8);
  scan14([66,dst(0,5),src(3,5),1,dst(0),src(0,5)],2);
  scan14([64,dst(0,5,7),src(3,5),1,dst(0,0,7),src(0,5)],2);
  scan14([64,dst(0,5,7),src(3,5),1,dst(0),src(0,5)],-1,17);
  scan14([64,dst(0,5,3),src(3,5,244,10),1,dst(0,0,3),src(0,5)],2);
  scan14([64,dst(0,5,3),src(3,5,244,10),1,dst(0,0,4),src(0,5)],-1,17);
  scan14([64,dst(0,5,7),src(3,5,244),66,dst(0),src(3,5,244,10)],2);
  scan14([64,dst(0,5,7),src(3,5,244),0xfffd,66,dst(0),src(3,5)],-1,16);
  scan14([64,dst(0,5,7),src(3,5),0xfffd,66,dst(0),src(0,5)],3);
  scan14([64,dst(0,5,7),src(3,5),0xfffd,66,dst(0),src(0,5,228,9)],3);
  scan14([64,dst(0,5,7),src(3,5),66,dst(0),src(0,5)],-1,17); // absentphase: no priorphase temp
  scan14([64,dst(0,5,3),src(3,5,244,10),0xfffd,66,dst(0),src(0,5,228,9)],-1,17); // requiresXYZ even divided
  scan14([64,dst(0,5,7),src(3,5),0xfffd,...Array.from({length:3},(_,i)=>[66,dst(0,i),src(0,5,228,9)]).flat()],-1,16);
  scan14([66,dst(0),src(3,0,228,9)],-1,7);
  scan14([66,dst(0),src(3,0,228,10)],-1,7);
  scan14([64,dst(0,0,7),src(3,0,244,10)],-1,16);
  scan14([1,dst(0),src(1),66,dst(0),src(3)],-1,16); // arithmetic ends address portion
  scan14(Array.from({length:6},(_,i)=>[66,dst(0,i),src(3,i)]).flat(),6);
  scan14(Array.from({length:7},(_,i)=>[66,dst(0,i%6),src(3,i%6)]).flat(),-1,19);
  scan14([65,dst(3,5),1,dst(0),src(1)],2);
  scan14([65,dst(0,5)],-1,17);
  scan14([66,dst(0,5),src(3),65,dst(0,5),1,dst(0),src(1)],3);
  scan14([64,dst(0,5,7),src(3),0xfffd,87,dst(0,5),1,dst(0),src(1)],4);
  scan14([87,dst(0,5)],-1,16);
  scan14([64,dst(0,5,7),src(3),0xfffd,87,dst(0,4)],-1,16);
  scan14([64,dst(0,5,7),src(3),0xfffd,87,dst(0,5),1,dst(0,0,7),src(0,5)],-1,16);
  scan14([64,dst(0,5,7),src(3),0xfffd,87,dst(0,5),66,dst(0,5),src(3)],-1,16);
  scan14([64,dst(0,5,7),src(3),89,dst(0,5,3),src(0,5),src(0,5),0xfffd,66,dst(0),src(0,5)],4);
  scan14([89,dst(0,5,3),src(2),src(2,1)],-1,16); // BEM requires explicit phase1
  scan14([89,dst(0,5,7),src(2),src(2,1),0xfffd,1,dst(0),src(1)],-1,16);
  scan14([89,dst(0,5,3),src(2),src(2,1),89,dst(0,4,3),src(2),src(2,1),0xfffd,1,dst(0),src(1)],-1,16);
  // BEM consumes two arithmetic slots, while the phase marker consumes none.
  const bem=[89,dst(0,5,3,15),src(2),src(2,1)];
  scan14([...eight.slice(0,18),...bem,0xfffd,1,dst(0),src(1)],9);
  scan14([...eight.slice(0,21),...bem,0xfffd,1,dst(0),src(1)],-1,19);
  good([vs, 1, dst(4), src(1), 65535]);
  for(const mask of [1,15]) {
    good([vs,1,dst(4),src(1),1,dst(4,2,mask),src(2),65535]);
    good([vs,1,dst(0,0,1),src(2),1,dst(4),src(1),1,dst(4,2,mask),src(0),65535]);
    good([vs,1,dst(0,0,8),src(2),1,dst(4),src(1),1,dst(4,2,mask),src(0,0,255),65535]);
    bad([vs,1,dst(0,0,8),src(2),1,dst(4),src(1),1,dst(4,2,mask),src(0),65535],17);
    bad([vs,1,dst(4,2,mask),src(2),65535],10); // point output cannot replace mandatory position
  }
  for(const mask of [0,2,3,7,8])bad([vs,1,dst(4),src(1),1,dst(4,2,mask),src(2),65535],16);
  bad([vs,1,dst(4),src(4,2),65535],6);
  bad([ps,1,dst(4,2),src(1),65535],6);
  good([ps, 1, dst(0), src(1), 65535]);
  const ps12=0xffff0102;
  good([ps12,88,dst(0),src(1),src(2),src(2,1),65535]);
  good([ps12,9,dst(0),src(1),src(2),65535]);
  for(const opcode of [82,83,85])for(const modifier of [0,4]){
    good([ps12,64,dst(3),opcode,dst(3,1),src(3,0,228,modifier),1,dst(0),src(3,1),65535]);
    bad([ps,64,dst(3),opcode,dst(3,1),src(3),65535],16);
    bad([ps12,opcode,dst(3,1),src(3),65535],16);
    bad([ps12,64,dst(3),opcode,dst(3),src(3),65535],16);
  }
  good([ps12,64,dst(3),73,dst(3,1),src(3),73,dst(3,2),src(3),86,dst(3,3),src(3),1,dst(0),src(3,3),65535]);
  good([ps12,64,dst(3),70,dst(3,1),src(3,0,228,4),1,dst(0),src(3,1),65535]);
  bad([ps,64,dst(3),70,dst(3,1),src(3,0,228,4),65535],16);
  for(const opcode of [9,88]){
    const args=opcode===9?[src(1),src(2)]:[src(1),src(2),src(2,1)];
    bad([ps,opcode,dst(0),...args,65535],16);
    const maximum=opcode===9?4:3;
    good([ps12,...Array.from({length:maximum},()=>[opcode,dst(0),...args]).flat(),65535]);
    bad([ps12,...Array.from({length:maximum+1},()=>[opcode,dst(0),...args]).flat(),65535],19);
  }
  for(let which=0;which<3;which++){
    const args=[src(1),src(2),src(2,1)];args[which]=src(0);
    bad([ps12,1,dst(0),src(1),88,dst(0),...args,65535],16);
  }
  bad([ps12,1,dst(0,0,7),src(1),9,dst(0,1),src(0),src(2),65535],17);
  bad([ps12,9,dst(0,0,7),src(1),src(2),0x40000001,dst(0,0,8),src(1),65535],9);
  for(const reverse of [false,true]) for(const both of [false,true]) {
    const cmp=(mask,paired)=>[(paired?0x40000000:0)|88,dst(0,0,mask),src(1),src(2),src(2,1)];
    const mov=(mask,paired)=>[(paired?0x40000000:0)|1,dst(0,0,mask),src(1)];
    const pair=[...(reverse&&!both?mov:cmp)(7,false),...(reverse||both?cmp:mov)(8,true)];
    good([ps12,...pair,65535]);
    // Inferred two-slot group policy, not a claim of historic REF evidence.
    const padding=Array.from({length:6},()=>[1,dst(0),src(1)]).flat();
    good([ps12,...padding,...pair,65535]);
    bad([ps12,1,dst(0),src(1),...padding,...pair,65535],19);
    bad([ps12,...pair.slice(0,-1),src(0),65535]);
  }
  for(const which of [0,1]) {
    const args=[src(1),src(2)];args[which]=src(0);
    bad([ps12,1,dst(0),src(1),9,dst(0),...args,65535],16);
  }
  bad([ps12,9,dst(3),src(1),src(2),65535],16);
  bad([ps12,84,dst(3,1),src(3),65535],16); // depth macro belongs to1.3
  const ps13=0xffff0103;
  const depthCode=[ps13,64,dst(3),71,dst(3,1),src(3),84,dst(3,2),src(3),1,dst(0),src(2),65535];
  good(depthCode);
  good([ps13,64,dst(3),71,dst(3,1),src(3,0,228,4),84,dst(3,2),src(3,0,228,4),1,dst(0),src(2),65535]);
  for(const suffix of [[1,dst(0),src(3,2)],[1,dst(3,2),src(2)],[65,dst(3,2)]])
    bad([...depthCode.slice(0,-4),...suffix,65535],16);
  for(const code of [
    [ps13,64,dst(3),84,dst(3,2),src(3),65535],
    [ps13,64,dst(3),71,dst(3,1),src(3),84,dst(3,3),src(3),65535],
    [ps13,64,dst(3),71,dst(3,1),src(3),84,dst(3,2),src(3,0,228,4),65535],
    [ps13,64,dst(3),71,dst(3,1),src(3),84,dst(3,2,7),src(3),65535]
  ])bad(code,16);
  good([vs,31,0x80000000,dst(1),1,dst(4),src(1),65535]);
  // Microsoft dcl-usage-input-register---vs: usages D3DDECLUSAGE, index0..15,
  // whole input register, before executable code. Declaration linkage is a
  // separate draw-time check; optional inline declarations remain supported.
  const usageToken=(usage,index=0)=>(0x80000000|index<<16|usage)>>>0;
  for(let usage=0;usage<=13;usage++)for(const index of [0,15]) {
    const p=compile([vs,31,usageToken(usage,index),dst(1,15),1,dst(4),src(1,15),65535]);
    assert.ok(p,`DCL usage ${usage}, index ${index}`);
    const record=IR.read(memory.buffer,p).instructions[0];
    assert.strictEqual(record.offset,1);
    assert.deepStrictEqual(record.args,[usageToken(usage,index),dst(1,15)]);
    e.d3d_shader_ir_free(p);
  }
  // No guessed duplicate-semantic prohibition: fan-out to distinct v# stays.
  good([vs,31,usageToken(5,15),dst(1),31,usageToken(5,15),dst(1,1),1,dst(4),src(1),65535]);
  good([vs,...Array.from({length:16},(_,n)=>[31,usageToken(5,n),dst(1,n)]).flat(),1,dst(4),src(1,15),65535]);
  good([vs,81,dst(2),0,0,0,0,0x0001fffe,123,31,usageToken(0),dst(1),1,dst(4),src(1),65535]);
  for(const usage of [14,15,16,0x1000,0x100000,0x1000000,0x10000000])
    bad([vs,31,(0x80000000|usage)>>>0,dst(1),1,dst(4),src(1),65535],13,2);
  for(const token of [dst(1,0,0),dst(1,0,7),dst(1,0,15,1),dst(1,0,15,0,1),src(1)])
    bad([vs,31,usageToken(0),token,1,dst(4),src(1),65535],13,3);
  bad([vs,31,usageToken(0),dst(1,16),1,dst(4),src(1),65535],6,3);
  bad([vs,1,dst(4),src(1),31,usageToken(0),dst(1),65535],13,4);
  bad([vs,0,31,usageToken(0),dst(1),1,dst(4),src(1),65535],13,2);
  // One binding per input is an explicit current lowering restriction, not
  // a claim that every native driver rejects an identical repeated binding.
  for(const usage of [0,5])
    bad([vs,31,usageToken(0),dst(1),31,usageToken(usage),dst(1),1,dst(4),src(1),65535],13,4);
  const commented = good([vs, 0x0002fffe, 0xdeadbeef, 0xcafebabe, 1, dst(4), src(1), 65535, 123]);
  assert.strictEqual(commented.instructions[0].offset, 4);
  for (const stage of [vs, ps]) for (const op of (stage===vs?
    [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,78,79]:[1,2,3,4,5,8,18])) {
    const arity = e.d3d_shader_ir_arity(op);
    good([stage, op, dst(stage === vs ? 4 : 0), ...Array.from({length:arity-1},(_,i)=>src(i?2:1)), 65535]);
  }
  good([ps,1,dst(0),src(1),80,dst(0),src(0,0,255),src(2,0),src(2,1),65535]);
  good([vs,1,dst(0),src(2,95),19,dst(0,0,3),src(1),1,dst(4),src(0),65535]);
  for (const shift of [0,1,2,15]) for (const mod of [0,1,2,3,4,5,6])
    good([ps, 1, dst(0,0,7,shift,1), src(1,0,255,mod), 65535]);
  good([ps,1,dst(0,0,8),src(1,0,170),65535]);
  for (const op of [20,21,22,23,24]) {
    const rows=op===20||op===22?4:op===24?2:3;
    good([vs,1,dst(0),src(2,95),op,dst(0,0,(1<<rows)-1),src(1),src(2,4),1,dst(4),src(0),65535]);
  }
  good([vs,81,dst(2,2),0x3f800000,0xbf800000,0,0x80000000,1,dst(4),src(2,2),65535]);
  good([ps,64,dst(3),66,dst(3,1),69,dst(3,2),src(3,1),65,dst(3,2),1,dst(0),src(3,2),65535]);
  // Native-only new texture coverage until the GLSL lowerer gains these ops.
  for(const opcode of [67,68,70]) {
    const p=compile([ps,66,dst(3),opcode,dst(3,1),src(3),1,dst(0),src(3,1),65535]);
    assert.ok(p,`native texture opcode ${opcode}: ${e.d3d_shader_ir_error()}`);
    assert.strictEqual(IR.read(memory.buffer,p).instructions[1].opcode,opcode);
    e.d3d_shader_ir_free(p);
    bad([ps,opcode,dst(3),src(3,1),65535],16);
    bad([ps,opcode,dst(3,1),src(3,0,228,4),65535],16);
    bad([ps,opcode,dst(0),src(3),65535],6);
    bad([vs,opcode,dst(3,1),src(3),65535],16);
  }
  bad([ps,66,dst(3),67,dst(3,1),src(3),1,dst(0),src(3),65535],16);
  good([ps,66,dst(3),67,dst(3,1),src(3),65,dst(3),65535]); // original coordinates survive bump register consumption
  const repeatBump=compile([ps,66,dst(3),67,dst(3,1),src(3),68,dst(3,2),src(3),1,dst(0),src(3,2),65535]);
  assert.ok(repeatBump,'bump sources may be consumed by further bump instructions');e.d3d_shader_ir_free(repeatBump);
  bad([ps,66,dst(3),68,dst(3,1),src(3),...Array.from({length:8},()=>[1,dst(0),src(3,1)]).flat(),65535],19);
  for(const modifier of [0,4]) {
    const pair=[ps,64,dst(3),71,dst(3,1),src(3,0,228,modifier),72,dst(3,2),src(3,0,228,modifier),1,dst(0),src(3,2),65535];
    const p=compile(pair);assert.ok(p,`TEXM3x2 pair modifier${modifier}: ${e.d3d_shader_ir_error()}`);e.d3d_shader_ir_free(p);
    const commented=[...pair.slice(0,6),0x0001fffe,0x12345678,...pair.slice(6)];
    const c=compile(commented);assert.ok(c,'comments do not interrupt a matrix macro');e.d3d_shader_ir_free(c);
  }
  for(const tail of [
    [71,dst(3,1),src(3)], // missing TEX
    [72,dst(3,2),src(3)], // missing PAD
    [71,dst(3,1),src(3),72,dst(3,3),src(3)], // stage gap
    [71,dst(3,1),src(3),72,dst(3,2),src(3,1)], // source changed
    [71,dst(3,1),src(3),72,dst(3,2),src(3,0,228,4)], // modifier changed
    [71,dst(3,3),src(3),72,dst(3,2),src(3)],
    [71,dst(3,1),src(3),0,72,dst(3,2),src(3)] // bounded adjacent-executable requirement
  ])bad([ps,64,dst(3),...tail,65535],16);
  bad([ps,71,dst(3,1),src(3),72,dst(3,2),src(3),65535],16);
  // Microsoft texm3x3tex: two PAD rows, then TEX, consecutive destination
  // stages and identical initialized source/modifier. GLSL lowering is a
  // separate pending slice, so these test the native validator directly.
  for(const modifier of [0,4]) {
    const s=src(3,0,228,modifier);
    const p=compile([ps,64,dst(3),73,dst(3,1),s,0x0001fffe,123,73,dst(3,2),s,74,dst(3,3),s,1,dst(0),src(3,3),65535]);
    assert.ok(p,`3x3 native error ${e.d3d_shader_ir_error()} at ${e.d3d_shader_ir_error_offset()}`);
    const view=new Uint32Array(memory.buffer,p,8+5*32);
    assert.strictEqual(view[4],5);
    assert.deepStrictEqual([view[8+32],view[8+64],view[8+96]],[73,73,74]);
    e.d3d_shader_ir_free(p);
  }
  for(const body of [
    [75,dst(3,3),src(3),src(2)],
    [76,dst(3,3),src(3)],
    [73,dst(3,1),src(3)],
    [73,dst(3,1),src(3),74,dst(3,2),src(3)],
    [73,dst(3,1),src(3),73,dst(3,2),src(3)],
    [73,dst(3,2),src(3),73,dst(3,3),src(3),74,dst(3,3),src(3)],
    [73,dst(3,1),src(3),73,dst(3,2),src(3),74,dst(3,2),src(3)],
    [73,dst(3,1),src(3),73,dst(3,2),src(3,0,228,4),74,dst(3,3),src(3)],
    [73,dst(3,1),src(3),0,73,dst(3,2),src(3),74,dst(3,3),src(3)],
    [74,dst(3,3),src(3)],
    [71,dst(3,1),src(3),73,dst(3,2),src(3),74,dst(3,3),src(3)]
  ])bad([ps,64,dst(3),...body,65535],16);
  for(const opcode of [75,76])for(const modifier of [0,4]) {
    const s=src(3,0,228,modifier),code=[ps,64,dst(3),73,dst(3,1),s,73,dst(3,2),s,
      opcode,dst(3,3),s,...(opcode===75?[src(2,7)]:[]),1,dst(0),src(3,3),65535];
    const p=compile(code);assert.ok(p,`SPEC error ${e.d3d_shader_ir_error()} at ${e.d3d_shader_ir_error_offset()}`);
    const native=IR.read(memory.buffer,p),glsl=Shader.compileIR(native,{cubeStages:[3]});
    assert.strictEqual(glsl.source,Shader.compile(Uint32Array.from(code),{cubeStages:[3]}).source);
    e.d3d_shader_ir_free(p);
  }
  for(const eye of [src(3),src(1),src(0),src(2,8),src(2,0,255),src(2,0,228,1),src(2,0,228,4)])
    bad([ps,64,dst(3),73,dst(3,1),src(3),73,dst(3,2),src(3),75,dst(3,3),src(3),eye,65535]);
  const rel = good([vs,1,dst(3,0,1),src(1),1,dst(4),src(2,4,0xe4,0,true),65535]);
  assert.strictEqual(rel.flags, 1);
  const co = good([ps,1,dst(0,0,7),src(1),0x40000001,dst(0,0,8),src(2),65535]);
  assert.strictEqual(co.flags, 2);
  bad([vs,65535],10);
  bad([0xfffe0200,65535],2,0);
  bad([ps,0x02000001,dst(0),src(1),65535],3,1);
  bad([ps,999,65535],3,1);
  bad([ps,1,dst(0)],4,1);
  bad([ps,1,0,src(1),65535],5,2);
  bad([ps,1,dst(0,2),src(1),65535],6,2);
  bad([ps,1,dst(0),src(2,8),65535],6,3);
  bad([ps,1,dst(0,0,0),src(1),65535],16,1);
  bad([ps,1,dst(0),src(1,0,0xe4,9),65535],16,1);
  bad([vs,1,dst(4),src(2,0,0xe4,0,true),65535],8,3);
  bad([vs,1,dst(3,0,1),src(2,0,0xe4,0,true),1,dst(4),src(1),65535],8,3);
  bad([ps,0x40000001,dst(0),src(1),65535],9,1);
  bad([ps,81,dst(2),0x7f800000,0,0,0,65535],14,3);
  bad([vs,20,dst(4),src(1),src(2,94),65535],15,1);
  bad([ps,20,dst(0),src(1),src(2),65535],16,1);
  bad([ps,0x0003fffe,1,2],4,1);
  bad([ps,...Array(4097).fill(0),65535],11,4097);
  // The older JS parser is deliberately not the legality oracle. These are
  // profile-invalid even where arithmetic could be generated successfully.
  for(const op of [6,7,9,10,11,12,13,14,15,16,17,19,20,21,22,23,24,31,78,79])
    bad([ps,op,dst(0),src(1),src(2),65535],16,1);
  for(const op of [18,64,65,66,69,80]) bad([vs,op,dst(4),src(1),src(2),src(2),65535],16,1);
  for(const shift of [3,13,14]) bad([ps,1,dst(0,0,15,shift),src(1),65535],16,1);
  for(const mod of [7,8]) bad([ps,1,dst(0),src(1,0,228,mod),65535],16,1);
  for(const mask of [1,2,3,4,5,6,9,10,11,12,13,14]) bad([ps,1,dst(0,0,mask),src(1),65535],16,1);
  for(const swizzle of [0,85,27,170]) bad([ps,1,dst(0),src(1,0,swizzle),65535],16,1);
  bad([ps,8,dst(0,0,8),src(1),src(2),65535],16,1);
  bad([vs,1,dst(4,0,15,1),src(1),65535],16,1);
  bad([vs,1,dst(4,0,15,0,1),src(1),65535],16,1);
  bad([vs,1,dst(4),src(1,0,228,2),65535],16,1);
  bad([vs,1,dst(4),src(4),65535],6,3,'output registers are write-only');
  bad([vs,2,dst(4),src(1,0),src(1,1),65535],18,1);
  bad([vs,2,dst(4),src(2,0),src(2,1),65535],18,1);
  bad([ps,4,dst(0),src(2,0),src(2,1),src(2,2),65535],18,1);
  bad([ps,4,dst(0),src(3,0),src(3,1),src(3,2),65535],18,1);
  bad([ps,1,dst(0),src(0,1),65535],17,3);
  bad([vs,1,dst(4),src(0),65535],17,3);
  bad([ps,80,dst(0),src(1,0,255),src(2),src(2),65535],16,1);
  bad([ps,69,dst(3,0),src(3,1),65535],16,1);
  bad([ps,66,dst(3,0,7),65535],16,1);
  bad([ps,66,dst(3,0,15,0,1),65535],16,1);
  bad([vs,1,dst(0),src(1),20,dst(0),src(0),src(2),1,dst(4),src(0),65535],15,4);
  bad([vs,20,dst(4),src(1),src(2,0,27),65535],15,1);
  bad([vs,20,dst(4),src(1),src(2,0,228,1),65535],15,1);
  bad([vs,19,dst(4),src(1),65535],16,1);
  const moves=n=>Array.from({length:n},()=>[1,dst(4),src(1)]).flat();
  // Microsoft DirectX8.1 SDK Registers p49: coissued pairs share THREE
  // distinct read ports per bank, while each PS1.1 instruction still has TWO.
  // https://documentation.help/directx8_c/documentation.pdf
  for(const bank of [2,3]) for(const reverse of [false,true]) {
    const init=bank===3?[64,dst(3,0),64,dst(3,1),64,dst(3,2),64,dst(3,3)]:[];
    const firstMask=reverse?8:7,secondMask=reverse?7:8;
    const prefix=[ps,...init,2,dst(0,0,firstMask),src(bank,0),src(bank,1)];
    good([...prefix,0x40000002,dst(0,1,secondMask),src(bank,1),src(bank,2),65535]);
    bad([...prefix,0x40000002,dst(0,1,secondMask),src(bank,2),src(bank,3),65535],18,prefix.length);
    // Repeated register selectors/modifiers still consume only one read port.
    good([...prefix,0x40000002,dst(0,1,secondMask),src(bank,0,255,1),src(bank,1,255,4),65535]);
    // Separate instructions are not restricted to the pair's total budget.
    good([...prefix,2,dst(0,1,secondMask),src(bank,2),src(bank,3),65535]);
  }
  bad([ps,4,dst(0,0,7),src(2,0),src(2,1),src(2,2),0x40000001,dst(0,0,8),src(2),65535],18,1);
  good([ps,64,dst(3),64,dst(3,1),4,dst(0,0,7),src(2),src(3),src(1),
    0x40000004,dst(0,0,8),src(2,1),src(3,1),src(1,1),65535]); // perbank, not six total
  good([ps,2,dst(0,0,7),src(2,6),src(2,7),
    2,dst(0,0,7),src(2,0),src(2,1),0x40000002,dst(0,0,8),src(2,1),src(2,2),65535]); // prior instruction is not part of pair
  good([ps,64,dst(3),64,dst(3,1),64,dst(3,2),2,dst(3,3,7),src(3),src(3,1),
    0x40000002,dst(3,3,8),src(3,1),src(3,2),1,dst(0),src(3,3),65535]); // destination t3 consumes no read port
  bad([ps,2,dst(0,0,7),src(2,0),src(2,1),0x0001fffe,123,
    0x40000002,dst(0,0,8),src(2,2),src(2,3),65535],18,7); // comments preserve pair's read set
  // Component initialization is independent of runtime values: test selected
  // reads, not a blanket requirement to initialize the whole source register.
  const finish=[1,dst(4),src(1),65535];
  const verify=(code,valid)=>valid?good(code):bad(code,17);
  for(const register of [0,7,8,11]) for(let written=0;written<4;written++) for(let read=0;read<4;read++) {
    const swizzle=read*0x55;
    verify([vs,1,dst(0,register,1<<written),src(1),1,dst(0,10,8),src(0,register,swizzle),...finish],written===read);
  }
  bad([vs,1,dst(0,0,1),src(1),1,dst(4),src(0),65535],17,6);
  good([vs,1,dst(0,0,5),src(1),1,dst(0,1,5),src(0),...finish]);
  bad([vs,1,dst(0,0,5),src(1),1,dst(0,1,3),src(0),...finish],17);
  good([vs,1,dst(0,0,1),src(1),1,dst(0,0,2),src(1),1,dst(0,0,4),src(1),
    1,dst(0,0,8),src(1),1,dst(4),src(0),65535]);
  const readCase=(op,mask,initial,sources,valid=true)=>verify([vs,...initial,op,dst(0,11,mask),...sources,...finish],valid);
  // DP3 needs xyz even for a scalar write; DP4 additionally needs w.
  readCase(8,1,[1,dst(0,0,7),src(1)],[src(0),src(2)]);
  readCase(8,1,[1,dst(0,0,3),src(1)],[src(0),src(2)],false);
  readCase(9,1,[1,dst(0,0,7),src(1)],[src(0),src(2)],false);
  // Scalar operations consume the selected first component, not dst.w.
  for(const opcode of [6,7,14,15,79]) {
    readCase(opcode,8,[1,dst(0,0,8),src(1)],[src(0,0,255)]);
    readCase(opcode,8,[1,dst(0,0,8),src(1)],[src(0)],false);
  }
  readCase(78,8,[],[src(0)]); // EXPP.w is constant one
  readCase(78,1,[],[src(0)],false);
  readCase(16,9,[],[src(0)]); // LIT.xw are constants
  readCase(16,2,[1,dst(0,0,1),src(1)],[src(0)]);
  readCase(16,4,[1,dst(0,0,11),src(1)],[src(0)]); // LIT.z needs xyw, never z
  readCase(16,4,[1,dst(0,0,3),src(1)],[src(0)],false);
  readCase(17,1,[],[src(0),src(0,1)]); // DST.x constant one
  readCase(17,4,[1,dst(0,0,4),src(1)],[src(0),src(0,1)]); // DST.z uses only source0.z
  readCase(17,8,[1,dst(0,1,8),src(1)],[src(0),src(0,1)]); // DST.w uses only source1.w
  readCase(17,2,[1,dst(0,0,2),src(1)],[src(0),src(0,1)],false);
  readCase(19,2,[1,dst(0,0,2),src(1)],[src(0)]); // FRC.y does not read xzw
  // M3x2 vector and two temporary matrix rows require xyz, not w. Each row
  // gets validated; writing row0 never implicitly initializes row1.
  const matrixInit=[1,dst(0,0,7),src(1),1,dst(0,4,7),src(1),1,dst(0,5,7),src(1)];
  readCase(24,3,matrixInit,[src(0),src(0,4)]);
  readCase(24,3,matrixInit.slice(0,-3),[src(0),src(0,4)],false);
  readCase(21,7,matrixInit,[src(0),src(0,4)],false); // M4x3 also needs w
  // Coissued reads see the state BEFORE both writes, not the first partner.
  bad([ps,1,dst(0,0,7),src(1),0x40000001,dst(0,1,8),src(0,0,170),65535],17);
  good([ps,1,dst(0,0,7),src(1),1,dst(0,0,7),src(2),0x40000001,dst(0,1,8),src(0,0,170),65535]);
  good([ps,1,dst(0,0,7),src(1),0x40000001,dst(0,0,8),src(2),1,dst(0,1),src(0),65535]);
  bad([ps,1,dst(0,0,7),src(1),1,dst(0,0,15),src(0),65535],17);
  good([ps,1,dst(0,0,8),src(1),80,dst(0,1,7),src(0,0,255),src(1),src(2),65535]);
  bad([ps,1,dst(0,0,7),src(1),80,dst(0,1,7),src(0,0,255),src(1),src(2),65535],17);
  good([vs,...moves(128),65535]);bad([vs,...moves(129),65535],19,385);
  const pixelMoves=n=>Array.from({length:n},()=>[1,dst(0),src(1)]).flat();
  good([ps,...pixelMoves(8),65535]);bad([ps,...pixelMoves(9),65535],19,25);
  bad([ps,66,dst(3,0),66,dst(3,1),66,dst(3,2),66,dst(3,3),65,dst(3,3),65535],19,9);
  for (const [address,count] of [[0,2],[ptr+1,2],[ptr,1],[ptr,65537],[memory.buffer.byteLength-4,2],[0xfffffffc,2]]) {
    assert.strictEqual(e.d3d_shader_ir_compile(address,count),0);
    assert.strictEqual(e.d3d_shader_ir_error(),1);
  }
  // Deterministic malformed-stream fuzzing: bounded reads must never trap or
  // allocate an accepted object that the IR reader/GLSL consumer cannot read.
  let seed = 0x873129ab;
  for (let i=0;i<1000;i++) {
    const code=[i&1?vs:ps];
    for (let n=0;n<(i%13)+1;n++) { seed ^= seed<<13; seed ^= seed>>>17; seed ^= seed<<5; code.push(seed>>>0); }
    code.push(65535);
    const p=compile(code);
    if (p) { Shader.compileIR(IR.read(memory.buffer,p)); e.d3d_shader_ir_free(p); }
    else assert.ok(e.d3d_shader_ir_error());
  }
  // Release/recompile must reuse heap storage rather than leak one allocation
  // per immutable shader version. Exercise non-LIFO removal too.
  const a=compile([ps,65535]), b=compile([ps,65535]), c=compile([ps,65535]);
  e.d3d_shader_ir_free(b); e.d3d_shader_ir_free(a); e.d3d_shader_ir_free(c);
  for (let i=0;i<2000;i++) good([ps,1,dst(0),src(1),65535]);
  const held=[];
  for (let i=0;i<128;i++) {
    const p=compile([ps,...Array(512).fill(0),65535]);
    if (!p) { assert.strictEqual(e.d3d_shader_ir_error(),12,'bounded heap OOM is explicit'); break; }
    held.push(p);
  }
  assert.ok(held.length>0 && held.length<128,'test reaches actual allocator limit');
  held.reverse().forEach(p=>e.d3d_shader_ir_free(p));
  good([ps,1,dst(0),src(1),65535]);
  console.log('PASS WAT shader IR: normalized GLSL parity, all current arithmetic ops, masks/modifiers, origin, bounds/fuzz, lifetime');
})().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
