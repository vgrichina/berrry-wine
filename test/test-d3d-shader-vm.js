#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { bootRenderHarness } = require('./render-helper');

(async () => {
  // During staged integration the fragment can be appended to the real source
  // closure. Once included, use it exactly once through the canonical manifest.
  const manifest = fs.readFileSync(path.join(__dirname, '../src/main.watx'), 'utf8');
  const fragment = ['09af-d3d-shader-ir.wat','09ag-d3d-shader-vm.wat'].map(file =>
    manifest.includes(file) ? '' : fs.readFileSync(path.join(__dirname, '../src',file),'utf8')).join('\n');
  const { exports: e, memory } = await bootRenderHarness({ fonts: 'none', extraWat: fragment + `
    (func (export "shader_test_alloc") (param $n i32) (result i32)
      (call $g2w (call $heap_alloc (local.get $n))))
    (func (export "shader_test_quad_lod") (param $ctx i32) (param $u0 f32) (param $u1 f32) (param $u2 f32) (param $u3 f32)
      (param $v0 f32) (param $v1 f32) (param $v2 f32) (param $v3 f32) (param $lane i32) (result f32)
      (call $d3d_shader_vm_lane (call $d3d_shader_vm_quad_lod
        (i32.load offset=36 (call $d3d_shader_vm_sampler (local.get $ctx) (i32.const 0)))
        (f32x4.replace_lane 3 (f32x4.replace_lane 2 (f32x4.replace_lane 1 (f32x4.splat (local.get $u0)) (local.get $u1)) (local.get $u2)) (local.get $u3))
        (f32x4.replace_lane 3 (f32x4.replace_lane 2 (f32x4.replace_lane 1 (f32x4.splat (local.get $v0)) (local.get $v1)) (local.get $v2)) (local.get $v3)))
        (local.get $lane)))
    (func (export "shader_test_seed_cpu")
      (i32.store offset=0 (global.get $reg_base) (i32.const 1234567)) (i32.store offset=16 (global.get $reg_base) (i32.const 7654321))
      (global.set $eip (i32.const 112233)) (global.set $flag_op (i32.const 3))
      (i64.store (global.get $xmm_base) (i64.const 0x1234567812345678)))
    (func (export "shader_test_cpu_unchanged") (result i32)
      (i32.and (i32.eq (i32.load offset=0 (global.get $reg_base)) (i32.const 1234567))
        (i32.and (i32.eq (i32.load offset=16 (global.get $reg_base)) (i32.const 7654321))
          (i32.and (i32.eq (global.get $eip) (i32.const 112233))
            (i32.and (i32.eq (global.get $flag_op) (i32.const 3))
              (i64.eq (i64.load (global.get $xmm_base)) (i64.const 0x1234567812345678)))))))
  ` });
  const mem = memory || e.memory;
  assert.ok(mem, 'harness exposes shared memory');
  const u32 = new Uint32Array(mem.buffer), f32 = new Float32Array(mem.buffer);
  const opnd = (bank, index, selector = 0xe4, modifier = 0) => [bank,index,selector,modifier];
  const ins = (op, dst, ...src) => ({op, operands:[dst,...src]});
  const d = (index, mask = 15, sat = 0) => opnd(0,index,mask,sat);
  const s = (index, swizzle = 0xe4, mod = 0) => opnd(0,index,swizzle,mod);
  function ir(instructions, flags = 0) {
    const n = 32 + instructions.length * 128, p = e.shader_test_alloc(n);
    u32.fill(0,p/4,(p+n)/4);
    u32.set([0x44534952,1,0,0xfffe0101,instructions.length,0,n,flags],p/4);
    instructions.forEach((item,i)=> {
      const q = (p+32+i*128)/4;
      u32.set([item.op,i,item.operands.length,item.coissue||0],q);
      item.operands.forEach((o,j)=>u32.set(o,q+4+j*4));
    });
    return p;
  }
  function compile(instructions) {
    const p = ir(instructions), out = e.d3d_shader_vm_compile(p);
    e.d3d_shader_vm_free(p);
    assert.ok(out,'supported shader compiles');
    return out;
  }
  function register(ctx,index,values,bank=0) {
    const off = (ctx+32+(bank*128+index)*64)/4;
    if(values) f32.set(values.flat(),off);
    return Array.from(f32.slice(off,off+16));
  }
  const a = [[1,2,3,4],[5,6,7,8],[9,10,11,12],[13,14,15,16]];
  const b = [[2,3,4,5],[3,4,5,6],[4,5,6,7],[5,6,7,8]];
  const c = [[0.25,0.5,0.75,1],[1,2,3,4],[2,3,4,5],[3,4,5,6]];
  let cases = 0;
  // LOG and LOGP use a finite negative sentinel for both signs of zero.
  // Keep log2's internal -Infinity policy separate (texture LOD relies on it).
  for (const opcode of [15, 79]) for (let scalar = 0; scalar < 4; scalar++)
  for (const mask of [15, 5]) for (const lanes of [15, 5]) {
    const program = compile([ins(opcode, d(0, mask), s(1, scalar * 85))]);
    const ctx = e.d3d_shader_vm_context(program, lanes);
    const input = Array.from({length:4}, () => [9,9,9,9]);
    input[scalar] = [0, -0, 1, 2];
    register(ctx, 1, input); register(ctx, 0, a);
    assert.strictEqual(e.d3d_shader_vm_run(ctx, 1), 0);
    const result = [-Math.fround(3.4028234663852886e38), -Math.fround(3.4028234663852886e38), 0, 1];
    const expected = a.map((row, component) => row.map((old, lane) =>
      (mask & (1 << component)) && (lanes & (1 << lane)) ? result[lane] : old));
    assert.deepStrictEqual(register(ctx, 0), expected.flat(),
      `opcode ${opcode}: scalar ${scalar}, mask ${mask}, lanes ${lanes}: finite zero sentinel and untouched inactive components`);
    e.d3d_shader_vm_free(ctx); e.d3d_shader_vm_free(program); cases++;
  }
  e.shader_test_seed_cpu();
  function compile14(instructions){
    const p=ir(instructions);u32[p/4+2]=1;u32[p/4+3]=0xffff0104;
    const program=e.d3d_shader_vm_compile(p);e.d3d_shader_vm_free(p);assert.ok(program,'PS1.4 normalized IR compiles');return program;
  }
  {
    const program=compile14([ins(80,d(0),s(1),s(2),s(3))]),ctx=e.d3d_shader_vm_context(program,15);
    register(ctx,1,[[1,0,1,0],[0,1,0,1],[.5,.6,.4,.7],[1,1,0,0]]);register(ctx,2,Array(4).fill([2,2,2,2]));register(ctx,3,Array(4).fill([3,3,3,3]));
    assert.strictEqual(e.d3d_shader_vm_run(ctx,1),0);assert.deepStrictEqual(register(ctx,0),[2,3,2,3,3,2,3,2,3,2,3,2,2,2,3,3]);
    e.d3d_shader_vm_free(ctx);e.d3d_shader_vm_free(program);cases++;
  }
  {
    const program=compile14([{op:65533,operands:[]},ins(1,d(0),s(5))]),ctx=e.d3d_shader_vm_context(program,5);
    for(let r=0;r<6;r++)register(ctx,r,Array(4).fill([1,2,3,4]));
    assert.strictEqual(e.d3d_shader_vm_run(ctx,1),1);
    for(let r=0;r<6;r++)assert.deepStrictEqual(register(ctx,r).slice(12),[0,2,0,4],'PHASE clears active alpha lanes across all six registers');
    assert.strictEqual(e.d3d_shader_vm_run(ctx,1),0);e.d3d_shader_vm_free(ctx);e.d3d_shader_vm_free(program);cases++;
  }
  {
    const program=compile14([ins(64,d(0,3),opnd(3,5,244,10))]),ctx=e.d3d_shader_vm_context(program,15);
    register(ctx,5,[[2,2,2,2],[4,4,4,4],[99,99,99,99],[2,0,4,-2]],3);
    assert.strictEqual(e.d3d_shader_vm_run(ctx,1),0);assert.deepStrictEqual(register(ctx,0),[1,1,.5,-1,2,1,1,-2,0,0,0,0,0,0,0,0]);
    e.d3d_shader_vm_free(ctx);e.d3d_shader_vm_free(program);cases++;
  }
  {
    const program=compile14([ins(66,d(5),opnd(3,5)),ins(1,d(0),s(5))]),ctx=e.d3d_shader_vm_context(program,15);
    register(ctx,5,Array(4).fill([.25,.25,.25,.25]),3);assert.strictEqual(e.d3d_shader_vm_run(ctx,1),-3);assert.strictEqual(u32[ctx/4+2],0);
    const pixels=e.shader_test_alloc(4),desc=e.shader_test_alloc(36);u32[pixels/4]=0xff00ff00;u32.set([pixels,1,1,4,0,3,3,1,0],desc/4);
    assert.strictEqual(e.d3d_shader_vm_bind_texture(ctx,5,desc),1);assert.strictEqual(e.d3d_shader_vm_run(ctx,2),0);
    assert.deepStrictEqual(register(ctx,0),[0,0,0,0,1,1,1,1,0,0,0,0,1,1,1,1]);
    for(const p of[ctx,program,pixels,desc])e.d3d_shader_vm_free(p);cases++;
  }
  {
    const program=compile14([ins(65,d(5))]),ctx=e.d3d_shader_vm_context(program,15);
    register(ctx,5,[[1,-1,1,1],[1,1,-1,1],[1,1,1,-1],[1,1,1,1]]);
    assert.strictEqual(e.d3d_shader_vm_run(ctx,1),0);assert.strictEqual(e.d3d_shader_vm_live_mask(ctx),1);
    e.d3d_shader_vm_free(ctx);e.d3d_shader_vm_free(program);cases++;
  }
  {
    const program=compile14([ins(89,d(5,3),s(0),s(1))]),ctx=e.d3d_shader_vm_context(program,15),desc=e.shader_test_alloc(28);
    u32[desc/4]=1;f32.set([2,3,4,5,1,0],desc/4+1);assert.strictEqual(e.d3d_shader_vm_bind_bump(ctx,5,desc),1);
    register(ctx,0,Array(4).fill([1,1,1,1]));register(ctx,1,[[2,2,2,2],[3,3,3,3],[0,0,0,0],[0,0,0,0]]);
    assert.strictEqual(e.d3d_shader_vm_run(ctx,1),0);assert.deepStrictEqual(register(ctx,5).slice(0,8),[17,17,17,17,22,22,22,22]);
    for(const p of[ctx,program,desc])e.d3d_shader_vm_free(p);cases++;
  }
  {
    const program=compile14([ins(87,d(5))]),ctx=e.d3d_shader_vm_context(program,15);
    register(ctx,5,[[1,1,-1,9],[2,0,2,2],[0,0,0,0],[0,0,0,0]]);
    assert.strictEqual(e.d3d_shader_vm_run(ctx,1),0);assert.strictEqual(e.d3d_shader_vm_depth_valid(ctx),1);
    assert.deepStrictEqual(Array.from(f32.slice((ctx+62816)/4,(ctx+62832)/4)),[.5,1,0,1]);
    assert.strictEqual(register(ctx,5)[0],1,'TEXDEPTH does not overwrite r5');e.d3d_shader_vm_free(ctx);e.d3d_shader_vm_free(program);cases++;
  }
  for(const opcode of [1,2,3,4,5,8,9,10,11]) {
    const sources = opcode===1 ? [s(1)] : opcode===4 ? [s(1),s(2),s(3)] : [s(1),s(2)];
    const program=compile([ins(opcode,d(0),...sources)]), ctx=e.d3d_shader_vm_context(program,15);
    register(ctx,1,a); register(ctx,2,b); register(ctx,3,c);
    assert.strictEqual(e.d3d_shader_vm_run(ctx,1),0);
    const expected=[];
    for(let component=0;component<4;component++) for(let lane=0;lane<4;lane++) {
      const av=a[component][lane],bv=b[component][lane],cv=c[component][lane];
      let value;
      switch(opcode) {
        case 1:value=av;break; case 2:value=Math.fround(av+bv);break;
        case 3:value=Math.fround(av-bv);break;
        case 4:value=Math.fround(Math.fround(av*bv)+cv);break;
        case 5:value=Math.fround(av*bv);break;
        case 8:case 9:
          value=Math.fround(a[0][lane]*b[0][lane]);
          for(let j=1;j<(opcode===8?3:4);j++)value=Math.fround(value+Math.fround(a[j][lane]*b[j][lane]));
          break;
        case 10:value=Math.min(av,bv);break;case 11:value=Math.max(av,bv);break;
      }
      expected.push(value);
    }
    assert.deepStrictEqual(register(ctx,0),expected,`opcode ${opcode} four independent lanes`);
    assert.strictEqual(u32[(ctx+20)/4],1);
    e.d3d_shader_vm_free(ctx);e.d3d_shader_vm_free(program);cases++;
  }
  // In-place .wzyx proves all source components precede any destination store.
  {
    const program=compile([ins(1,d(0,5),s(0,0x1b))]),ctx=e.d3d_shader_vm_context(program,5);
    register(ctx,0,a);
    assert.strictEqual(e.d3d_shader_vm_run(ctx,0),1);
    assert.deepStrictEqual(register(ctx,0),a.flat(),'budget zero has no effects');
    assert.strictEqual(e.d3d_shader_vm_run(ctx,1),0);
    const expected=a.map(row=>row.slice());
    for(const component of [0,2])for(const lane of [0,2])expected[component][lane]=a[3-component][lane];
    assert.deepStrictEqual(register(ctx,0),expected.flat(),'destination and lane masks preserve bits');
    e.d3d_shader_vm_free(ctx);e.d3d_shader_vm_free(program);cases++;
  }
  for(let modifier=0;modifier<=8;modifier++) {
    const program=compile([ins(1,d(0),s(1,0xe4,modifier))]),ctx=e.d3d_shader_vm_context(program,15);
    register(ctx,1,c);e.d3d_shader_vm_run(ctx,1);
    const expected=c.flat().map(x=>[x,-x,x-.5,-(x-.5),2*x-1,-(2*x-1),1-x,2*x,-2*x][modifier]);
    assert.deepStrictEqual(register(ctx,0),expected);
    e.d3d_shader_vm_free(ctx);e.d3d_shader_vm_free(program);cases++;
  }
  {
    const program=compile([ins(4,d(0),s(1),s(2),s(3))]),ctx=e.d3d_shader_vm_context(program,15);
    register(ctx,1,Array.from({length:4},()=>[1+2**-23,Infinity,NaN,-0]));
    register(ctx,2,Array.from({length:4},()=>[1-2**-23,0,2,1]));
    register(ctx,3,Array.from({length:4},()=>[-1,0,1,-0]));
    e.d3d_shader_vm_run(ctx,1);
    const values=register(ctx,0);
    for(let component=0;component<4;component++) {
      assert.strictEqual(values[component*4],0,'MAD uses separate rounded multiply and add, not fused');
      assert.ok(Number.isNaN(values[component*4+1]));
      assert.ok(Number.isNaN(values[component*4+2]));
      assert.ok(Object.is(values[component*4+3],-0),'signed zero retained');
    }
    e.d3d_shader_vm_free(ctx);e.d3d_shader_vm_free(program);cases++;
  }
  {
    const program=compile([ins(1,d(0,15,1),s(1)),ins(2,d(0),s(0),s(0))]);
    const ctx=e.d3d_shader_vm_context(program,15),other=e.d3d_shader_vm_context(program,15);
    const vals=[[-2,0,.5,2],[-3,.25,.75,4],[-1,-.5,1,2],[0,1,2,3]];
    register(ctx,1,vals);register(other,1,c);
    const bytes=Buffer.from(new Uint8Array(mem.buffer,program,u32[(program+12)/4]));
    assert.strictEqual(e.d3d_shader_vm_run(ctx,1),1);
    assert.deepStrictEqual(register(ctx,0),vals.flat().map(x=>Math.min(1,Math.max(0,x))));
    assert.strictEqual(e.d3d_shader_vm_run(other,2),0,'independent context');
    assert.strictEqual(e.d3d_shader_vm_run(ctx,1),0);
    assert.deepStrictEqual(register(ctx,0),vals.flat().map(x=>2*Math.min(1,Math.max(0,x))));
    assert.deepStrictEqual(Buffer.from(new Uint8Array(mem.buffer,program,bytes.length)),bytes,'immutable packets');
    assert.strictEqual(e.d3d_shader_vm_run(ctx,1),0,'completed resume does not reexecute');
    assert.strictEqual(u32[(ctx+20)/4],2);
    e.d3d_shader_vm_cancel(other);
    assert.strictEqual(e.d3d_shader_vm_run(other,2),-2,'explicit cancellation');
    e.d3d_shader_vm_free(ctx);e.d3d_shader_vm_free(other);e.d3d_shader_vm_free(program);cases++;
  }
  for(const item of [ins(66,d(0)),ins(1,d(0),s(128)),ins(1,d(0),s(1,0xe4,256)),
    ins(1,d(0,15,1024),s(1)),{...ins(1,d(0),s(1)),coissue:1},ins(1,d(0,0),s(1))]) {
    const p=ir([item]);assert.strictEqual(e.d3d_shader_vm_compile(p),0,'unsupported IR rejected');
    e.d3d_shader_vm_free(p);cases++;
  }
  assert.strictEqual(e.d3d_shader_vm_compile(0),0);
  assert.strictEqual(e.d3d_shader_vm_compile(0xfffffff0),0);
  assert.strictEqual(e.d3d_shader_vm_run(0,1),-1);
  {
    const program=compile([ins(1,opnd(3,0,1),s(1))]),ctx=e.d3d_shader_vm_context(program,15);
    register(ctx,1,[[-1.2,-.2,.8,2.2],[0,0,0,0],[0,0,0,0],[0,0,0,0]]);
    assert.strictEqual(e.d3d_shader_vm_run(ctx,1),0);
    assert.deepStrictEqual(register(ctx,0,null,3).slice(0,4),[-2,-1,0,2],'VS a0 conversion floors each lane');
    e.d3d_shader_vm_free(ctx);e.d3d_shader_vm_free(program);cases++;
  }
  // Actual guest bytecode -> WAT validated IR -> compiled SIMD packets, with
  // typed input/constant/output banks. No JS bytecode decoder/evaluator involved.
  {
    const tokens=Uint32Array.from([0xfffe0101,2,0xc00f0000,0x90e40000,0xa0e40000,0xffff]);
    const ptr=e.shader_test_alloc(tokens.byteLength);u32.set(tokens,ptr/4);
    const normalized=e.d3d_shader_ir_compile(ptr,tokens.length);
    assert.ok(normalized,`real IR compile: ${e.d3d_shader_ir_error()}`);
    const program=e.d3d_shader_vm_compile(normalized);
    assert.ok(program,'normalized WAT IR accepted');
    e.d3d_shader_ir_free(normalized);e.d3d_shader_vm_free(ptr);
    const ctx=e.d3d_shader_vm_context(program,15);
    register(ctx,0,a,1);register(ctx,0,b,2);
    assert.strictEqual(e.d3d_shader_vm_run(ctx,1),0);
    assert.deepStrictEqual(register(ctx,0,null,4),a.flat().map((x,i)=>x+b.flat()[i]));
    e.d3d_shader_vm_free(ctx);e.d3d_shader_vm_free(program);cases++;
  }
  assert.strictEqual(e.shader_test_cpu_unchanged(),1,'shader execution does not borrow x86 CPU state');
  // New coverage uses real WAT token validation throughout, with independent
  // numeric expectations (not the JS GLSL compiler or another shared evaluator).
  const dstToken=(bank,index=0,mask=15,shift=0,sat=0)=>(0x80000000|bank<<28|index|mask<<16|shift<<24|sat<<20)>>>0;
  const srcToken=(bank,index=0,swizzle=0xe4,mod=0,relative=false)=>(0x80000000|bank<<28|index|swizzle<<16|mod<<24|(relative?8192:0))>>>0;
  function bytecode(tokens) {
    const p=e.shader_test_alloc(tokens.length*4);u32.set(tokens,p/4);
    const normalized=e.d3d_shader_ir_compile(p,tokens.length);
    assert.ok(normalized,`IR error ${e.d3d_shader_ir_error()} at ${e.d3d_shader_ir_error_offset()}`);
    const program=e.d3d_shader_vm_compile(normalized);
    e.d3d_shader_ir_free(normalized);e.d3d_shader_vm_free(p);
    assert.ok(program,'real normalized shader compiles');return program;
  }
  for(const shift of [0,1,2,15]) for(const saturate of [0,1]) {
    const program=bytecode([0xffff0101,1,dstToken(0,0,15,shift,saturate),srcToken(1),65535]);
    const ctx=e.d3d_shader_vm_context(program,15),values=[[-2,-.25,.25,2],[.125,.5,1,4],[-8,-1,0,.75],[1,2,3,4]];
    register(ctx,0,values,1);assert.strictEqual(e.d3d_shader_vm_run(ctx,1),0);
    const factor=2**(shift>8?shift-16:shift);
    assert.deepStrictEqual(register(ctx,0),values.flat().map(v=>saturate?Math.min(1,Math.max(0,v*factor)):v*factor));
    e.d3d_shader_vm_free(ctx);e.d3d_shader_vm_free(program);cases++;
  }
  {
    // A late DEF must override application c0 before the earlier MOV; NOP and
    // declarations consume bounded execution slots without writing registers.
    const program=bytecode([0xfffe0101,31,0x80000000,dstToken(1),0,1,dstToken(4),srcToken(2),
      81,dstToken(2),0x3f800000,0x40000000,0xbf800000,0x3f000000,65535]);
    const ctx=e.d3d_shader_vm_context(program,5),other=e.d3d_shader_vm_context(program,15);
    const constant=Array.from({length:4},()=>[9,9,9,9]);register(ctx,0,constant,2);register(other,0,constant,2);
    assert.strictEqual(e.d3d_shader_vm_run(ctx,1),1,'DEF prologue respects budget');
    assert.deepStrictEqual(register(ctx,0,null,4),Array(16).fill(0),'no premature arithmetic');
    assert.strictEqual(e.d3d_shader_vm_run(ctx,3),0);
    const expected=[1,2,-1,.5].flatMap(v=>[v,0,v,0]);
    assert.deepStrictEqual(register(ctx,0,null,4),expected);
    assert.deepStrictEqual(register(other,0,null,2),constant.flat(),'DEF is context-local');
    assert.strictEqual(e.d3d_shader_vm_run(other,4),0);
    assert.deepStrictEqual(register(other,0,null,4),[1,2,-1,.5].flatMap(v=>[v,v,v,v]));
    e.d3d_shader_vm_free(ctx);e.d3d_shader_vm_free(other);e.d3d_shader_vm_free(program);cases++;
  }
  for(const [op,width,rows] of [[20,4,4],[21,4,3],[22,3,4],[23,3,3],[24,3,2]]) {
    const program=bytecode([0xfffe0101,1,dstToken(0),srcToken(2,95),op,dstToken(0,0,(1<<rows)-1),srcToken(1),srcToken(2,4),
      1,dstToken(4),srcToken(0),65535]);
    const ctx=e.d3d_shader_vm_context(program,15);
    register(ctx,0,a,1);
    const matrix=[[2,3,4,5],[6,7,8,9],[10,11,12,13],[14,15,16,17]];
    matrix.forEach((row,i)=>register(ctx,4+i,row.map(v=>[v,v,v,v]),2));
    assert.strictEqual(e.d3d_shader_vm_run(ctx,3),0);
    const expected=[];
    for(let component=0;component<4;component++) for(let lane=0;lane<4;lane++) {
      let value=0;
      if(component<rows)for(let j=0;j<width;j++)value=Math.fround(value+Math.fround(a[j][lane]*matrix[component][j]));
      expected.push(value);
    }
    assert.deepStrictEqual(register(ctx,0,null,4),expected,`matrix opcode ${op}`);
    e.d3d_shader_vm_free(ctx);e.d3d_shader_vm_free(program);cases++;
  }
  {
    // Matrix source aliases its destination; row results must all read the old
    // vector even when x/y stores would alter later dot products.
    // Synthetic internal IR stress case; native vs_1_1 explicitly forbids this
    // matrix alias and its rejection is tested in test-d3d-shader-ir.js.
    const program=compile([ins(1,d(0),opnd(1,0)),ins(20,d(0),s(0),opnd(2,0)),ins(1,opnd(4,0,15),s(0))]);
    const ctx=e.d3d_shader_vm_context(program,15);register(ctx,0,a,1);
    for(let row=0;row<4;row++)register(ctx,row,[1,1,1,1].map(v=>[v+row,v+row,v+row,v+row]),2);
    assert.strictEqual(e.d3d_shader_vm_run(ctx,3),0);
    assert.deepStrictEqual(register(ctx,0,null,4),[1,2,3,4].flatMap(scale=>[28,32,36,40].map(v=>v*scale)));
    e.d3d_shader_vm_free(ctx);e.d3d_shader_vm_free(program);cases++;
  }
  {
    // Each vertex lane has its own floored a0.x and constant selection. Invalid
    // addresses return zero without reading a neighboring register bank.
    const program=bytecode([0xfffe0101,1,dstToken(3,0,1),srcToken(1),
      1,dstToken(4),srcToken(2,2,0x1b,1,true),65535]);
    const ctx=e.d3d_shader_vm_context(program,15);
    register(ctx,0,[[-1.2,-.2,.8,2.2],[0,0,0,0],[0,0,0,0],[0,0,0,0]],1);
    for(let n=0;n<5;n++)register(ctx,n,[0,1,2,3].map(c=>[100*n+c,100*n+c,100*n+c,100*n+c]),2);
    assert.strictEqual(e.d3d_shader_vm_run(ctx,2),0);
    assert.deepStrictEqual(register(ctx,0,null,4),[0,1,2,3].flatMap(c=>[0,1,2,4].map(n=>-(100*n+3-c))));
    // Rerun a fresh context with exceptional/out-of-bank addresses.
    const bad=e.d3d_shader_vm_context(program,15);
    register(bad,0,[[-100,Infinity,NaN,100],[0,0,0,0],[0,0,0,0],[0,0,0,0]],1);
    assert.strictEqual(e.d3d_shader_vm_run(bad,2),0);
    assert.ok(register(bad,0,null,4).every(v=>Object.is(v,-0)));
    e.d3d_shader_vm_free(ctx);e.d3d_shader_vm_free(bad);e.d3d_shader_vm_free(program);cases++;
  }
  {
    const program=bytecode([0xfffe0101,1,dstToken(3,0,1),srcToken(1),
      20,dstToken(4),srcToken(1,1),srcToken(2,0,0xe4,0,true),65535]);
    const ctx=e.d3d_shader_vm_context(program,15);
    register(ctx,0,[[0,1,2,3],[0,0,0,0],[0,0,0,0],[0,0,0,0]],1);
    register(ctx,1,[[1,1,1,1],[1,1,1,1],[1,1,1,1],[1,1,1,1]],1);
    for(let n=0;n<7;n++)register(ctx,n,[n,n+1,n+2,n+3].map(v=>[v,v,v,v]),2);
    assert.strictEqual(e.d3d_shader_vm_run(ctx,2),0);
    assert.deepStrictEqual(register(ctx,0,null,4),[0,1,2,3].flatMap(row=>[0,1,2,3].map(lane=>4*(row+lane)+6)));
    e.d3d_shader_vm_free(ctx);e.d3d_shader_vm_free(program);cases++;
  }
  assert.strictEqual(e.shader_test_cpu_unchanged(),1,'expanded compiler/execution remains isolated from x86 state');
  // 2D sampler contract: native format bytes are retained through execution;
  // metadata is copied. Independently known 2x2 colors expose axis/order/pitch.
  const colors=[[1,0,0,1],[0,1,0,1],[0,0,1,1],[1,1,1,1]];
  const border=[.25,.5,.75,1].map(v=>Math.fround(Math.round(v*255)/255));
  function texture(ctx,{stage=0,format=0,addressU=3,addressV=3,filter=1}={}) {
    const pixels=e.shader_test_alloc(24),desc=e.shader_test_alloc(36);
    const bytes=new Uint8Array(mem.buffer,pixels,24);bytes.fill(17);
    colors.forEach((color,i)=>{
      const c=color.map(v=>v*255);if(format) [c[0],c[2]]=[c[2],c[0]];
      if(format===22)c[3]=0;
      bytes.set(c,Math.floor(i/2)*12+i%2*4);
    });
    u32.set([pixels,2,2,12,format,addressU,addressV,filter,0xff4080bf],desc/4);
    assert.strictEqual(e.d3d_shader_vm_bind_texture(ctx,stage,desc),1);
    u32.fill(0,desc/4,desc/4+9);e.d3d_shader_vm_free(desc);
    return pixels;
  }
  const rgbaLanes=lanes=>[0,1,2,3].flatMap(c=>lanes.map(v=>v[c]));
  function near(actual,expected,label) {
    assert.strictEqual(actual.length,expected.length);
    actual.forEach((v,i)=>assert.ok(Math.abs(v-expected[i])<2e-6,`${label} component ${i}: ${v} != ${expected[i]}`));
  }
  const texTokens=[0xffff0101,66,dstToken(3),1,dstToken(0),srcToken(3),65535];
  // Independently colored mip levels: choosing/blending levels has an exact
  // answer, unrelated to texture-coordinate arithmetic or the shader compiler.
  function mipFixture(ctx,{mode=2,min=1,mag=1,bias=0,max=0,first=0,format=0}={}) {
    const desc=e.shader_test_alloc(64),table=e.shader_test_alloc(48),pixels=[];
    for(let level=first;level<3;level++) {
      const width=4>>level,height=width,pitch=width*4+4,p=e.shader_test_alloc(pitch*height);
      pixels.push(p);const bytes=new Uint8Array(mem.buffer,p,pitch*height);bytes.fill(0xcd);
      const color=format===62?[[129,0,255,13],[127,127,0,9],[0,128,128,7]][level]:colors[level].map(v=>v*255);
      for(let y=0;y<height;y++)for(let x=0;x<width;x++)bytes.set(color,y*pitch+x*4);
      u32.set([p,width,height,pitch],table/4+(level-first)*4);
    }
    u32.set([1,3-first,table,format,3,3,0xff4080bf,min,mag,mode,0,max,first,4,4,0],desc/4);
    new Float32Array(mem.buffer,desc+40,1)[0]=bias;
    assert.strictEqual(e.d3d_shader_vm_bind_texture_mips(ctx,0,desc),1);
    return {desc,table,pixels,free(){for(const p of [...pixels,desc,table])e.d3d_shader_vm_free(p);}};
  }
  const sampleLOD=(ctx,lod,u=.5,v=.5)=>[0,1,2,3].map(c=>e.d3d_shader_vm_sample_lod(ctx,0,u,v,lod,c));
  function cubeFixture(ctx,stage=0) {
    const desc=e.shader_test_alloc(64),table=e.shader_test_alloc(6*3*16),pixels=[];
    for(let face=0;face<6;face++)for(let level=0;level<3;level++) {
      const width=4>>level,pitch=width*4+4,p=e.shader_test_alloc(pitch*width);pixels.push(p);
      const bytes=new Uint8Array(mem.buffer,p,pitch*width);bytes.fill(0xcd);
      for(let y=0;y<width;y++)for(let x=0;x<width;x++)bytes.set([20+face*30,level*100,x*40+y*10,255],y*pitch+x*4);
      u32.set([p,width,width,pitch],table/4+(face*3+level)*4);
    }
    u32.set([1,3,table,0,3,3,0,1,1,2,0,0,0,4,4,1],desc/4);
    assert.strictEqual(e.d3d_shader_vm_bind_texture_mips(ctx,stage,desc),1);
    return {desc,table,pixels,free(){for(const p of [...pixels,desc,table])e.d3d_shader_vm_free(p);}};
  }
  {
    const program=bytecode(texTokens),ctx=e.d3d_shader_vm_context(program,15),m=cubeFixture(ctx);
    const axes=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
    const sample=(d,lod)=>[0,1,2,3].map(c=>e.d3d_shader_vm_sample_cube_lod(ctx,0,...d,lod,c));
    axes.forEach((d,face)=>{
      assert.strictEqual(e.d3d_shader_vm_cube_face(...d),face);
      near(sample(d,0),[(20+face*30)/255,0,100/255,1],'cube face center');
      near(sample(d.map(v=>v*7),.5),[(20+face*30)/255,50/255,75/255,1],'cube direction scale and mip blend');
      near(sample(d,99),[(20+face*30)/255,200/255,0,1],'cube last mip');
    });
    for(const [d,face] of [[[1,1,1],0],[[-1,1,1],1],[[0,1,1],2],[[0,-1,1],3]])assert.strictEqual(e.d3d_shader_vm_cube_face(...d),face);
    for(const d of [[0,0,0],[NaN,1,0],[1,Infinity,0]])assert.ok(Number.isNaN(sample(d,0)[0]));
    assert.ok(Number.isNaN(sampleLOD(ctx,0)[0]),'2D API must not silently sample cube face zero');
    const directions=[[2,-1,-1],[-2,-1,1],[1,2,1],[1,-2,-1],[1,-1,2],[-1,-1,-2]];
    directions.forEach((d,face)=>{
      near([e.d3d_shader_vm_cube_uv(face,...d,0),e.d3d_shader_vm_cube_uv(face,...d,1)],[.75,.75],'all face orientations');
      near(sample(d,0),[(20+face*30)/255,0,150/255,1],'cube corner orientation');
    });
    u32[m.desc/4+7]=2;u32[m.desc/4+8]=2;
    assert.strictEqual(e.d3d_shader_vm_bind_texture_mips(ctx,0,m.desc),1);
    near(sample([1,0,0],0),[20/255,0,75/255,1],'cube face-local bilinear center');
    near(sample([1,0,1],0),[20/255,0,15/255,1],'cube bilinear seam clamps each tap within selected face');
    near(sample([1,0,1.0001],0),[140/255,0,135/255,1],'other seam side selects adjacent face without atlas bleed');
    u32[m.desc/4+7]=1;u32[m.desc/4+8]=1;
    assert.strictEqual(e.d3d_shader_vm_bind_texture_mips(ctx,0,m.desc),1);
    // Every face is validated, including final face/final level. Failure keeps
    // the previously copied chain usable, even after caller metadata changes.
    u32[ m.table/4+17*4+1 ]=2;
    assert.strictEqual(e.d3d_shader_vm_bind_texture_mips(ctx,0,m.desc),0);
    near(sample(axes[5],2),[170/255,200/255,0,1],'invalid sixth face preserves binding');
    u32[m.table/4+17*4+1]=1;u32[m.desc/4+4]=1;
    assert.strictEqual(e.d3d_shader_vm_bind_texture_mips(ctx,0,m.desc),0,'cube WRAP explicitly unsupported');
    m.free();e.d3d_shader_vm_free(ctx);e.d3d_shader_vm_free(program);cases++;
  }
  {
    const program=bytecode(texTokens),ctx=e.d3d_shader_vm_context(program,1),m=cubeFixture(ctx);
    // Neighbors cross +X/+Z major-axis selection, but their projected +X UV
    // differences are small: own-face UVs would spuriously select a low mip.
    register(ctx,0,[[1,1,1,1],[0,0,0,0],[.9,1.1,.9,1.1],[1,1,1,1]],3);
    u32[(ctx+24)/4]=15;
    assert.strictEqual(e.d3d_shader_vm_run(ctx,20),0);
    near([0,1,2,3].map(c=>register(ctx,0)[c*4]),[20/255,0,20/255,1],'cube helper seam projection keeps level zero');
    assert.strictEqual(e.d3d_shader_vm_live_mask(ctx),1);
    m.free();e.d3d_shader_vm_free(ctx);e.d3d_shader_vm_free(program);cases++;
  }
  for(const modifier of [0,4]) {
    const s=srcToken(3,0,228,modifier);
    const program=bytecode([0xffff0101,64,dstToken(3),73,dstToken(3,1),s,73,dstToken(3,2),s,
      74,dstToken(3,3),s,1,dstToken(0),srcToken(3,3),65535]);
    const ctx=e.d3d_shader_vm_context(program,5),m=cubeFixture(ctx,3);
    register(ctx,0,[[.75,.75,.75,.75],[.5,.5,.5,.5],[.25,.25,.25,.25],[1,1,1,1]],3);
    // Independently chosen nontrivial rows cancel Y/Z for each source.
    // PAD needs neither stage1 nor stage2 sampler bindings.
    register(ctx,1,[[2,2,2,2],[0,0,0,0],[0,0,0,0],[7,7,7,7]],3);
    register(ctx,2,(modifier?[1,2,1,8]:[0,1,-2,8]).map(v=>[v,v,v,v]),3);
    register(ctx,3,(modifier?[2,3,2,9]:[1,-1,-1,9]).map(v=>[v,v,v,v]),3);
    const original1=register(ctx,1,null,3),original2=register(ctx,2,null,3);u32[(ctx+24)/4]=15;
    assert.strictEqual(e.d3d_shader_vm_run(ctx,2),1,'yield between PAD rows preserves hidden dot');
    assert.deepStrictEqual(register(ctx,1,null,3),original1,'PAD does not publish destination');
    assert.strictEqual(e.d3d_shader_vm_run(ctx,1),1);
    assert.deepStrictEqual(register(ctx,2,null,3),original2);
    assert.strictEqual(e.d3d_shader_vm_run(ctx,20),0);
    for(const lane of [0,2])near([0,1,2,3].map(c=>register(ctx,0)[c*4+lane]),[20/255,0,100/255,1],'3x3 cube matrix result');
    for(const lane of [1,3])near([0,1,2,3].map(c=>register(ctx,0)[c*4+lane]),[20/255,0,100/255,1],'helpers execute matrix rows too');
    assert.strictEqual(e.d3d_shader_vm_live_mask(ctx),5);
    m.free();e.d3d_shader_vm_free(ctx);e.d3d_shader_vm_free(program);cases++;
  }
  {
    const program=bytecode(texTokens),ctx=e.d3d_shader_vm_context(program,15),m=cubeFixture(ctx);
    register(ctx,0,[[1,1,1,1],[0,0,0,0],[-.5,.5,-.5,.5],[1,1,1,1]],3);
    assert.strictEqual(e.d3d_shader_vm_run(ctx,20),0);
    // +X projection u=.75/.25, delta .5 times original size4 => rho2,
    // lambda1 exactly. Each row has the same horizontal footprint.
    for(let lane=0;lane<4;lane++)near([0,1,2,3].map(c=>register(ctx,0)[c*4+lane]),
      [20/255,100/255,(lane&1?10:50)/255,1],'cube implicit level one analytic footprint');
    m.free();e.d3d_shader_vm_free(ctx);e.d3d_shader_vm_free(program);cases++;
  }
  // Non-unit N=(2,2,0): reflection swaps eye X/Y and negates Z. Omitting
  // division by N.N yields different faces, making this an independent oracle.
  for(const opcode of [75,76])for(const modifier of [0,4]) {
    const source=srcToken(3,0,228,modifier);
    const program=bytecode([0xffff0101,64,dstToken(3),
      1,dstToken(3,1),srcToken(2,1),1,dstToken(3,2),srcToken(2,1),
      73,dstToken(3,1),source,73,dstToken(3,2),source,
      opcode,dstToken(3,3),source,...(opcode===75?[srcToken(2,7)]:[]),1,dstToken(0),srcToken(3,3),65535]);
    for(const [eye,face] of [[[1,0,0],2],[[0,1,0],0],[[0,0,1],5],[[-1,0,0],3]])for(const scale of [1,-3]) {
      const ctx=e.d3d_shader_vm_context(program,5),m=cubeFixture(ctx,3);
      register(ctx,0,[modifier?.75:.5,0,0,1].map(v=>Array(4).fill(v)),3);
      register(ctx,1,[4*scale,0,0,eye[0]].map(v=>Array(4).fill(v)),3);
      register(ctx,2,[4*scale,0,0,eye[1]].map(v=>Array(4).fill(v)),3);
      register(ctx,3,[0,0,0,eye[2]].map(v=>Array(4).fill(v)),3);
      register(ctx,7,[...eye,99].map(v=>Array(4).fill(v)),2);
      register(ctx,1,[9,8,7,6].map(v=>Array(4).fill(v)),2);
      u32[(ctx+24)/4]=15;
      assert.strictEqual(e.d3d_shader_vm_run(ctx,4),1);
      assert.strictEqual(e.d3d_shader_vm_run(ctx,20),0);
      near(register(ctx,0),rgbaLanes(Array(4).fill([(20+face*30)/255,0,100/255,1])),`SPEC${opcode} non-unit reflection, original row Q, c7`);
      m.free();e.d3d_shader_vm_free(ctx);cases++;
    }
    e.d3d_shader_vm_free(program);
  }
  {
    const s=srcToken(3),program=bytecode([0xffff0101,64,dstToken(3),73,dstToken(3,1),s,
      73,dstToken(3,2),s,76,dstToken(3,3),s,1,dstToken(0),srcToken(3,3),65535]);
    const ctx=e.d3d_shader_vm_context(program,1),m=cubeFixture(ctx,3);
    register(ctx,0,[.5,0,0,1].map(v=>Array(4).fill(v)),3);
    register(ctx,1,[4,0,0,1].map(v=>Array(4).fill(v)),3);
    register(ctx,2,[4,0,0,0].map(v=>Array(4).fill(v)),3);
    register(ctx,3,[[0,0,0,0],[0,0,0,0],[0,0,0,0],[-.25,.25,-.25,.25]],3);
    u32[(ctx+24)/4]=15;assert.strictEqual(e.d3d_shader_vm_run(ctx,20),0);
    for(let lane=0;lane<4;lane++)near([0,1,2,3].map(c=>register(ctx,0)[c*4+lane]),
      [80/255,0,(lane&1?90:100)/255,1],'VSPEC per-lane eye Q and reflected helper derivatives');
    assert.strictEqual(e.d3d_shader_vm_live_mask(ctx),1);
    m.free();e.d3d_shader_vm_free(ctx);e.d3d_shader_vm_free(program);cases++;
  }
  {
    const program=bytecode([0xffff0102,88,dstToken(0),srcToken(2),srcToken(1),srcToken(2,1),65535]);
    const ctx=e.d3d_shader_vm_context(program,15);
    const compare=[[-1,0,1,NaN],[0,-0,-1,2],[1,-1,0,-0],[NaN,1,-1,0]];
    register(ctx,0,compare,2);register(ctx,1,Array(4).fill([.2,.3,.4,.5]),2);
    register(ctx,0,Array(4).fill([.6,.7,.8,.9]),1);
    assert.strictEqual(e.d3d_shader_vm_run(ctx,1),0);
    near(register(ctx,0),compare.flatMap(row=>row.map((v,l)=>v>=0?[.6,.7,.8,.9][l]:[.2,.3,.4,.5][l])),'CMP per-component including +/-zero and NaN');
    e.d3d_shader_vm_free(ctx);e.d3d_shader_vm_free(program);cases++;
  }
  for(const opcode of [82,83,85])for(const modifier of [0,4]){
    const program=bytecode([0xffff0102,64,dstToken(3),opcode,dstToken(3,1),srcToken(3,0,228,modifier),1,dstToken(0),srcToken(3,1),65535]);
    const ctx=e.d3d_shader_vm_context(program,15),pixels=opcode===85?0:texture(ctx,{stage:1});
    const coords=[[.25,.75,.25,.75],[.25,.25,.75,.75],[0,0,0,0],[1,1,1,1]];
    register(ctx,0,coords.map(row=>row.map(v=>modifier?(v+1)/2:v)),3);
    register(ctx,1,[[1,1,1,1],[0,0,0,0],[0,0,0,0],[99,99,99,99]],3);
    assert.strictEqual(e.d3d_shader_vm_run(ctx,10),0);
    near(register(ctx,0),opcode===85?Array(4).fill(coords[0]).flat():rgbaLanes(opcode===82?colors:[colors[0],colors[1],colors[0],colors[1]]),`PS1.2 texture${opcode} bx2${modifier}`);
    [pixels,ctx,program].forEach(p=>e.d3d_shader_vm_free(p));cases++;
  }
  {
    const program=bytecode([0xffff0102,64,dstToken(3),82,dstToken(3,1),srcToken(3,0,228,4),1,dstToken(0),srcToken(3,1),65535]);
    for(const [face,direction]of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]].entries()){
      const ctx=e.d3d_shader_vm_context(program,15),m=cubeFixture(ctx,1);
      register(ctx,0,[...direction.map(v=>(v+1)/2),1].map(v=>Array(4).fill(v)),3);
      assert.strictEqual(e.d3d_shader_vm_run(ctx,10),0);
      near(register(ctx,0),rgbaLanes(Array(4).fill([(20+face*30)/255,0,100/255,1])),'PS1.2 dependent RGB cube lookup');
      m.free();e.d3d_shader_vm_free(ctx);cases++;
    }
    e.d3d_shader_vm_free(program);
  }
  {
    const s=srcToken(3),program=bytecode([0xffff0102,64,dstToken(3),73,dstToken(3,1),s,
      73,dstToken(3,2),s,86,dstToken(3,3),s,1,dstToken(0),srcToken(3,3),65535]);
    const ctx=e.d3d_shader_vm_context(program,15);
    register(ctx,0,[.25,.5,.75,99].map(v=>Array(4).fill(v)),3);
    for(let row=0;row<3;row++)register(ctx,row+1,[row===0?1:0,row===1?1:0,row===2?1:0,99].map(v=>Array(4).fill(v)),3);
    assert.strictEqual(e.d3d_shader_vm_run(ctx,10),0);
    near(register(ctx,0),rgbaLanes(Array(4).fill([.25,.5,.75,1])),'plain matrix does not require any samplers and returns W1');
    e.d3d_shader_vm_free(ctx);e.d3d_shader_vm_free(program);cases++;
  }
  for(const [version,instruction]of [
    [0xffff0101,ins(9,d(0),opnd(1,0),opnd(2,0))],
    [0xffff0101,ins(82,opnd(3,1,15),opnd(3,0))],
    [0xffff0102,ins(84,opnd(3,2,15),opnd(3,0))],
    [0xffff0102,ins(9,d(0),s(0),opnd(2,0))],
    [0xffff0102,ins(9,opnd(3,0,15),opnd(1,0),opnd(2,0))],
    [0xffff0102,ins(88,d(0),s(0),opnd(2,0),opnd(1,0))]
  ]){
    const p=ir([instruction]);u32[p/4+2]=1;u32[p/4+3]=version;
    assert.strictEqual(e.d3d_shader_vm_compile(p),0,'VM rejects profile mismatch or CMP alias in synthetic IR');
    e.d3d_shader_vm_free(p);cases++;
  }
  for(const outputMask of [1,15])for(const lanes of [15,5]) {
    const program=bytecode([0xfffe0101,1,dstToken(4),srcToken(1),1,dstToken(0,0,8),srcToken(2),
      5,dstToken(4,2,outputMask),srcToken(0,0,255),srcToken(2,1),65535]);
    assert.strictEqual(e.d3d_shader_vm_has_point_size(program),1);
    const ctx=e.d3d_shader_vm_context(program,lanes);
    register(ctx,0,[[0,0,0,0],[0,0,0,0],[0,0,0,0],[1,2,-1,0]],2);
    register(ctx,1,[[2,3,4,5],[100,100,100,100],[100,100,100,100],[100,100,100,100]],2);
    register(ctx,2,Array(4).fill([77,77,77,77]),4);
    assert.strictEqual(e.d3d_shader_vm_run(ctx,10),0);
    near(register(ctx,2,null,4),[...[2,6,-4,0].map((v,l)=>lanes&(1<<l)?v:77),...Array(12).fill(77)],'oPts is scalar x only, masked lanes and irrelevant components preserved');
    [ctx,program].forEach(p=>e.d3d_shader_vm_free(p));cases++;
  }
  assert.strictEqual(e.d3d_shader_vm_has_point_size(0),0);
  for(const instruction of [ins(1,opnd(4,2,2),opnd(1,0)),ins(1,d(0),opnd(4,2)),
    ins(20,opnd(4,2,15),opnd(1,0),opnd(2,0))]) {
    const p=ir([instruction]);assert.strictEqual(e.d3d_shader_vm_compile(p),0,'invalid scalar output synthetic IR rejects');e.d3d_shader_vm_free(p);cases++;
  }
  for(const mask of [15,5])for(const modifier of [0,4]) {
    const source=srcToken(3,0,228,modifier);
    const program=bytecode([0xffff0103,64,dstToken(3),71,dstToken(3,1),source,84,dstToken(3,2),source,1,dstToken(0),srcToken(2),65535]);
    const ctx=e.d3d_shader_vm_context(program,mask);u32[(ctx+24)/4]=15;
    register(ctx,0,[1,modifier?.5:0,modifier?.5:0,1].map(v=>Array(4).fill(v)),3);
    register(ctx,1,[[.25,.5,-1,2],[0,0,0,0],[0,0,0,0],[99,99,99,99]],3);
    const original=[[1,0,1,1],[0,0,0,0],[0,0,0,0],[99,99,99,99]];
    register(ctx,2,original,3);
    assert.strictEqual(e.d3d_shader_vm_run(ctx,2),1);
    assert.strictEqual(e.d3d_shader_vm_depth_valid(ctx),0,'PAD has no output depth');
    assert(Number.isNaN(e.d3d_shader_vm_depth(ctx,0)));
    assert.strictEqual(e.d3d_shader_vm_run(ctx,1),1);
    assert.strictEqual(e.d3d_shader_vm_depth_valid(ctx),1);
    near([0,1,2,3].map(l=>e.d3d_shader_vm_depth(ctx,l)),[.25,1,0,1],'depth ratio, zero denominator, explicit range clamp, helper lanes');
    assert.deepStrictEqual(register(ctx,2,null,3),original.flat(),'depth macro does not publish mutable t destination');
    assert.strictEqual(e.d3d_shader_vm_run(ctx,1),0);
    assert.strictEqual(e.d3d_shader_vm_live_mask(ctx),mask,'helper depths never add covered lanes');
    u32[(ctx+8)/4]=0;assert.strictEqual(e.d3d_shader_vm_run(ctx,0),1);
    assert.strictEqual(e.d3d_shader_vm_depth_valid(ctx),0,'new quad resets depth validity');
    assert(Number.isNaN(e.d3d_shader_vm_depth(ctx,4)));
    [ctx,program].forEach(p=>e.d3d_shader_vm_free(p));cases++;
  }
  for(const mode of [0,1,2]) {
    const program=bytecode(texTokens),ctx=e.d3d_shader_vm_context(program,5),m=mipFixture(ctx,{mode});
    assert.strictEqual(e.d3d_shader_vm_context_bytes(),74176);
    for(const lod of [-10,0,.25,.5,1,1.5,2,99]) {
      const clamped=Math.min(2,Math.max(0,lod));
      const level=mode===0?0:mode===1?Math.floor(clamped+.5):Math.floor(clamped);
      const fraction=mode===2?clamped-level:0;
      near(sampleLOD(ctx,lod),colors[level].map((v,c)=>v*(1-fraction)+(colors[Math.min(2,level+1)][c])*fraction),`mip mode${mode} lod${lod}`);
    }
    // Metadata is owned; caller descriptor/table can be overwritten immediately.
    u32.fill(0,m.desc/4,m.desc/4+16);u32.fill(0,m.table/4,m.table/4+12);
    near(sampleLOD(ctx,1),mode===0?colors[0]:colors[1],'copied chain metadata');
    assert.strictEqual(e.d3d_shader_vm_run(ctx,2),-4,'implicit TEX explicitly gated until helper lanes');
    assert.strictEqual(u32[(ctx+8)/4],0,'unsupported sampling does not retire');
    for(const lod of [NaN,Infinity,-Infinity])assert.ok(Number.isNaN(e.d3d_shader_vm_sample_lod(ctx,0,.5,.5,lod,0)));
    assert.ok(Number.isNaN(e.d3d_shader_vm_sample_lod(ctx,4,.5,.5,0,0)));
    assert.ok(Number.isNaN(e.d3d_shader_vm_sample_lod(ctx,0,.5,.5,0,4)));
    assert.strictEqual(e.d3d_shader_vm_bind_texture_mips(ctx,0,0),1);
    assert.ok(Number.isNaN(sampleLOD(ctx,0)[0]));
    m.free();e.d3d_shader_vm_free(ctx);e.d3d_shader_vm_free(program);cases++;
  }
  {
    // TEX samples all four channels once per packet and serves the other
    // component calls from a cache: every lane/component must stay bit-equal
    // to the scalar one-component sampler, with fresh results each execution.
    let seed=12345;const rnd=()=>((seed=(Math.imul(seed,1103515245)+12345)>>>0)/2**32);
    const same=(actual,expected,label)=>actual.forEach((v,i)=>assert.ok(Object.is(v,expected[i]),`${label} [${i}]: ${v} != ${expected[i]}`));
    const program=bytecode(texTokens);
    for(const format of [0,21,22,62]) for(const filter of [1,2]) for(const addressU of [1,2,3,4]) {
      const ctx=e.d3d_shader_vm_context(program,15),addressV=[1,2,3,4][Math.floor(rnd()*4)];
      const pixels=texture(ctx,{format,addressU,addressV,filter});
      for(let rep=0;rep<3;rep++) {
        new Uint8Array(mem.buffer,pixels,24).forEach((_,i,a)=>{a[i]=Math.floor(rnd()*256);});
        const u=[0,1,2,3].map(()=>Math.fround(rnd()*4-1.5)),v=[0,1,2,3].map(()=>Math.fround(rnd()*4-1.5));
        if(rep===2){u[1]=NaN;v[3]=Infinity;}
        register(ctx,0,[u,v,[0,0,0,0],[1,1,1,1]],3);u32[(ctx+24)/4]=15;
        assert.strictEqual(e.d3d_shader_vm_run(ctx,2),0);
        const expected=[0,1,2,3].flatMap(c=>u.map((_,lane)=>e.d3d_shader_vm_sample_lod(ctx,0,u[lane],v[lane],0,c)));
        same(register(ctx,0,null,3),Array.from(new Float32Array(expected)),`tex cache format${format} filter${filter} address${addressU}/${addressV} rep${rep}`);
        u32[(ctx+8)/4]=0;
      }
      e.d3d_shader_vm_free(ctx);cases++;
    }
    // Mipped TEX: the reference takes each lane's LOD from the VM's own quad LOD.
    for(const mode of [0,1,2]) for(const [min,mag] of [[1,1],[2,2],[1,2]]) for(const bias of [0,.5,-.25]) {
      const ctx=e.d3d_shader_vm_context(program,15),m=mipFixture(ctx,{mode,min,mag,bias});
      for(const d of [1/8,1/4,1/2,1]) {
        const u0=Math.fround(rnd()*2-.5),v0=Math.fround(rnd()*2-.5);
        const u=[u0,u0+d,u0,u0+d].map(Math.fround),v=[v0,v0,v0+d,v0+d].map(Math.fround);
        register(ctx,0,[u,v,[0,0,0,0],[1,1,1,1]],3);u32[(ctx+24)/4]=15;
        assert.strictEqual(e.d3d_shader_vm_run(ctx,2),0);
        const lod=lane=>e.shader_test_quad_lod(ctx,...u,...v,lane);
        const expected=[0,1,2,3].flatMap(c=>u.map((_,lane)=>e.d3d_shader_vm_sample_lod(ctx,0,u[lane],v[lane],lod(lane),c)));
        same(register(ctx,0,null,3),Array.from(new Float32Array(expected)),`mip tex cache mode${mode} filter${min}/${mag} bias${bias} d${d}`);
        u32[(ctx+8)/4]=0;
      }
      m.free();e.d3d_shader_vm_free(ctx);cases++;
    }
    e.d3d_shader_vm_free(program);
  }
  for(const options of [{bias:1},{max:1},{first:1},{max:0xffffffff},{bias:-2}]) {
    const program=bytecode(texTokens),ctx=e.d3d_shader_vm_context(program,15),m=mipFixture(ctx,options);
    const lower=Math.min(2,Math.max(options.first||0,options.max||0));
    const lod=Math.min(2,Math.max(lower,.5+(options.bias||0))),i=Math.floor(lod),f=lod-i;
    near(sampleLOD(ctx,.5),colors[i].map((v,c)=>v*(1-f)+colors[Math.min(2,i+1)][c]*f),'bias/max/residency in original-resource LOD units');
    m.free();e.d3d_shader_vm_free(ctx);e.d3d_shader_vm_free(program);cases++;
  }
  {
    const program=bytecode(texTokens),ctx=e.d3d_shader_vm_context(program,15),m=mipFixture(ctx,{mode:2});
    const legacyPrefix=new Uint8Array(mem.buffer,ctx,62848).slice();
    for(const stage of [4,5]) {
      assert.strictEqual(e.d3d_shader_vm_bind_texture_mips(ctx,stage,m.desc),1);
      for(const lod of [0,.5,1,2]) {
        const l=Math.floor(lod),f=lod-l;
        near([0,1,2,3].map(c=>e.d3d_shader_vm_sample_lod(ctx,stage,.5,.5,lod,c)),
          colors[l].map((v,c)=>v*(1-f)+colors[Math.min(2,l+1)][c]*f),`six-stage appended sampler${stage} LOD${lod}`);
      }
    }
    assert.deepStrictEqual(new Uint8Array(mem.buffer,ctx,62848),legacyPrefix,'new stages cannot overwrite legacy samplers, depth or registers');
    assert.strictEqual(e.d3d_shader_vm_bind_texture_mips(ctx,6,m.desc),0);
    assert.strictEqual(e.d3d_shader_vm_bind_bump(ctx,6,0),0);
    assert(Number.isNaN(e.d3d_shader_vm_sample_lod(ctx,6,.5,.5,0,0)));
    assert.strictEqual(e.d3d_shader_vm_bind_texture(ctx,4,0),1);
    assert(Number.isNaN(e.d3d_shader_vm_sample_lod(ctx,4,.5,.5,0,0)));
    near([0,1,2,3].map(c=>e.d3d_shader_vm_sample_lod(ctx,5,.5,.5,1,c)),colors[1],'unbinding4 preserves5');
    m.free();e.d3d_shader_vm_free(ctx);e.d3d_shader_vm_free(program);cases++;
  }
  {
    const program=bytecode(texTokens),ctx=e.d3d_shader_vm_context(program,15),m=mipFixture(ctx,{min:1,mag:2});
    // Base image split red/green. At u=.5, point is green, bilinear is half each.
    const bytes=new Uint8Array(mem.buffer,m.pixels[0],80);
    for(let y=0;y<4;y++)for(let x=0;x<4;x++)bytes.set(x<2?[255,0,0,255]:[0,255,0,255],y*20+x*4);
    near(sampleLOD(ctx,-1),[.5,.5,0,1],'magnification uses linear filter');
    near(sampleLOD(ctx,.25),[0,1,0,1],'minification uses point filter before level blend');
    const snapshot=new Uint8Array(mem.buffer,ctx+57376,48).slice();
    const saved=Array.from(new Uint32Array(mem.buffer,m.desc,16));
    for(const [offset,value] of [[0,2],[4,0],[4,13],[8,0xfffffff0],[12,99],[16,0],[20,5],[28,3],[32,0],[36,3],[40,0x7fc00000],[48,12],[52,0],[56,2049],[60,2]]) {
      u32.set(saved,m.desc/4);u32[(m.desc+offset)/4]=value;
      assert.strictEqual(e.d3d_shader_vm_bind_texture_mips(ctx,0,m.desc),0,`bad mip descriptor+${offset}`);
      assert.deepStrictEqual(new Uint8Array(mem.buffer,ctx+57376,48),snapshot,'failed bind preserves active sampler');
    }
    u32.set(saved,m.desc/4);
    const levels=Array.from(new Uint32Array(mem.buffer,m.table,12));
    for(const [index,value] of [[0,0xfffffff0],[1,3],[3,15],[5,3],[7,0xffffffff],[9,2]]) {
      u32.set(levels,m.table/4);u32[m.table/4+index]=value;
      assert.strictEqual(e.d3d_shader_vm_bind_texture_mips(ctx,0,m.desc),0,`bad mip level word${index}`);
    }
    const legacy=texture(ctx);near(sampleLOD(ctx,2,.25,.25),colors[0],'legacy rebind clears mip marker');
    assert.strictEqual(u32[(ctx+57376+36)/4],0);
    e.d3d_shader_vm_free(legacy);m.free();e.d3d_shader_vm_free(ctx);e.d3d_shader_vm_free(program);cases++;
  }
  {
    const program=bytecode(texTokens),ctx=e.d3d_shader_vm_context(program,15),m=mipFixture(ctx,{format:62,min:2,mag:2});
    near(sampleLOD(ctx,.5),[0,.5,.5,1],'signed channels decoded before cross-level filtering');
    m.free();e.d3d_shader_vm_free(ctx);e.d3d_shader_vm_free(program);cases++;
  }
  for(const vertical of [false,true]) {
    const program=bytecode(texTokens),ctx=e.d3d_shader_vm_context(program,15);
    const desc=e.shader_test_alloc(64),table=e.shader_test_alloc(192),owned=[];
    for(let level=0;level<12;level++) {
      const width=vertical?1:2048>>level,height=vertical?2048>>level:1;
      const p=e.shader_test_alloc(width*height*4);owned.push(p);
      const pixels=new Uint8Array(mem.buffer,p,width*height*4);
      for(let i=0;i<pixels.length;i+=4)pixels.set([level*20,255-level*20,0,255],i);
      u32.set([p,width,height,width*4],table/4+level*4);
    }
    u32.set([1,12,table,0,1,2,0,1,2,2,0,0,0,vertical?1:2048,vertical?2048:1,0],desc/4);
    for(let stage=0;stage<4;stage++) {
      assert.strictEqual(e.d3d_shader_vm_bind_texture_mips(ctx,stage,desc),1);
      for(const lod of [0,5.5,11,100]) {
        const chosen=Math.min(11,lod);
        near([0,1,2,3].map(c=>e.d3d_shader_vm_sample_lod(ctx,stage,1.125,-.75,lod,c)),
          [chosen*20/255,(255-chosen*20)/255,0,1],'all stages, twelve-level non-square chain');
      }
    }
    for(const p of [...owned,desc,table,ctx,program])e.d3d_shader_vm_free(p);cases++;
  }
  for(const lod of [-1,0,1,1.5,2]) {
    const program=bytecode(texTokens),ctx=e.d3d_shader_vm_context(program,1),m=mipFixture(ctx);
    const delta=2**lod/4;
    register(ctx,0,[[.1,.1+delta,.1,.1+delta],[.2,.2,.2+delta,.2+delta],[0,0,0,0],[1,1,1,1]],3);
    u32[(ctx+24)/4]=15;
    assert.strictEqual(e.d3d_shader_vm_run(ctx,2),0);
    const clamped=Math.min(2,Math.max(0,lod)),level=Math.floor(clamped),f=clamped-level;
    const expected=colors[level].map((v,c)=>v*(1-f)+colors[Math.min(2,level+1)][c]*f);
    near(register(ctx,0),rgbaLanes([expected,expected,expected,expected]),`implicit helper LOD${lod}`);
    assert.strictEqual(e.d3d_shader_vm_live_mask(ctx),1,'helpers never become output coverage');
    m.free();e.d3d_shader_vm_free(ctx);e.d3d_shader_vm_free(program);cases++;
  }
  for(const kill of [false,true]) {
    // Dependent lookup derives from freshly written helper values, not the
    // original texture coordinate or stale masked-off t0 contents.
    const program=bytecode([0xffff0101,...(kill?[65,dstToken(3,2)]:[]),1,dstToken(3),srcToken(1),
      69,dstToken(3,1),srcToken(3),1,dstToken(0),srcToken(3,1),65535]);
    const ctx=e.d3d_shader_vm_context(program,3),m=mipFixture(ctx);
    assert.strictEqual(e.d3d_shader_vm_bind_texture_mips(ctx,1,m.desc),1);
    register(ctx,0,[[.1,.1,.6,.6],[0,0,0,0],[0,0,0,0],[.1,.6,.1,.6]],1);
    register(ctx,2,[[-1,1,-1,1],[0,0,0,0],[0,0,0,0],[1,1,1,1]],3);
    u32[(ctx+24)/4]=15;
    assert.strictEqual(e.d3d_shader_vm_run(ctx,1),1,'helper values persist across yield');
    assert.strictEqual(e.d3d_shader_vm_run(ctx,3),0);
    near(register(ctx,0),rgbaLanes(Array(4).fill(colors[1])),'dependent TEXREG2AR mip selection');
    assert.strictEqual(e.d3d_shader_vm_live_mask(ctx),kill?2:3);
    m.free();e.d3d_shader_vm_free(ctx);e.d3d_shader_vm_free(program);cases++;
  }
  for(const format of [0,21,22]) {
    // Existing single-level ABI below remains unchanged.
    const program=bytecode(texTokens),ctx=e.d3d_shader_vm_context(program,15);
    const pixels=texture(ctx,{format});
    register(ctx,0,[[.25,.75,.25,.75],[.25,.25,.75,.75],[0,0,0,0],[1,1,1,1]],3);
    assert.strictEqual(e.d3d_shader_vm_run(ctx,2),0);
    near(register(ctx,0),rgbaLanes(colors),`native format ${format}`);
    e.d3d_shader_vm_free(pixels);e.d3d_shader_vm_free(ctx);e.d3d_shader_vm_free(program);cases++;
  }
  {
    const program=bytecode([0xffff0101,66,dstToken(3,3),1,dstToken(0),srcToken(3,3),65535]);
    const ctx=e.d3d_shader_vm_context(program,15),pixels=texture(ctx,{stage:3});
    register(ctx,3,[[.25,.75,NaN,Infinity],[.25,.75,.25,.25],[0,0,0,0],[1,1,1,1]],3);
    assert.strictEqual(e.d3d_shader_vm_run(ctx,2),0);
    near(register(ctx,0),rgbaLanes([colors[0],colors[3],[0,0,0,0],[0,0,0,0]]),'stage3 and nonfinite coordinate policy');
    e.d3d_shader_vm_free(pixels);e.d3d_shader_vm_free(ctx);e.d3d_shader_vm_free(program);cases++;
  }
  for(const mode of [1,2,3,4]) {
    const program=bytecode(texTokens),ctx=e.d3d_shader_vm_context(program,15);
    const pixels=texture(ctx,{addressU:mode});
    register(ctx,0,[[-.25,.25,.75,1.25],[.25,.25,.25,.25],[0,0,0,0],[1,1,1,1]],3);
    assert.strictEqual(e.d3d_shader_vm_run(ctx,2),0);
    const expected=mode===1?[colors[1],colors[0],colors[1],colors[0]]:
      mode===4?[border,colors[0],colors[1],border]:[colors[0],colors[0],colors[1],colors[1]];
    near(register(ctx,0),rgbaLanes(expected),`point U address ${mode}`);
    e.d3d_shader_vm_free(pixels);e.d3d_shader_vm_free(ctx);e.d3d_shader_vm_free(program);cases++;
  }
  for(const mode of [1,2,3,4]) {
    const program=bytecode(texTokens),ctx=e.d3d_shader_vm_context(program,15);
    const pixels=texture(ctx,{addressV:mode});
    register(ctx,0,[[.25,.25,.25,.25],[-.25,.25,.75,1.25],[0,0,0,0],[1,1,1,1]],3);
    assert.strictEqual(e.d3d_shader_vm_run(ctx,2),0);
    const expected=mode===1?[colors[2],colors[0],colors[2],colors[0]]:
      mode===4?[border,colors[0],colors[2],border]:[colors[0],colors[0],colors[2],colors[2]];
    near(register(ctx,0),rgbaLanes(expected),`point V address ${mode}`);
    e.d3d_shader_vm_free(pixels);e.d3d_shader_vm_free(ctx);e.d3d_shader_vm_free(program);cases++;
  }
  const mix=(a,b)=>a.map((v,i)=>(v+b[i])/2),rg=mix(colors[0],colors[1]);
  for(const mode of [1,2,3,4]) {
    const program=bytecode(texTokens),ctx=e.d3d_shader_vm_context(program,15);
    const pixels=texture(ctx,{addressU:mode,filter:2});
    register(ctx,0,[[0,.5,1,1.25],[.25,.25,.25,.25],[0,0,0,0],[1,1,1,1]],3);
    assert.strictEqual(e.d3d_shader_vm_run(ctx,2),0);
    const expected=mode===1?[rg,rg,rg,colors[0]]:mode===4?
      [mix(border,colors[0]),rg,mix(colors[1],border),border]:[colors[0],rg,colors[1],colors[1]];
    near(register(ctx,0),rgbaLanes(expected),`linear footprint U address ${mode}`);
    e.d3d_shader_vm_free(pixels);e.d3d_shader_vm_free(ctx);e.d3d_shader_vm_free(program);cases++;
  }
  {
    const program=bytecode(texTokens),ctx=e.d3d_shader_vm_context(program,15);
    const pixels=texture(ctx,{addressU:4,addressV:4,filter:2});
    register(ctx,0,[[.5,.25,0,1],[.5,.25,0,1],[0,0,0,0],[1,1,1,1]],3);
    assert.strictEqual(e.d3d_shader_vm_run(ctx,2),0);
    near(register(ctx,0),rgbaLanes([[.5,.5,.5,1],colors[0],
      colors[0].map((v,i)=>v*.25+border[i]*.75),colors[3].map((v,i)=>v*.25+border[i]*.75)]),'2D bilinear corner footprint');
    e.d3d_shader_vm_free(pixels);e.d3d_shader_vm_free(ctx);e.d3d_shader_vm_free(program);cases++;
  }
  for(const version of[0xffff0101,0xffff0102,0xffff0103])for(const op of [64,66]) {
    // The initial interpolation is preserved even after an earlier write to t0.
    const program=bytecode([version,1,dstToken(3),srcToken(2),op,dstToken(3),1,dstToken(0),srcToken(3),65535]);
    const ctx=e.d3d_shader_vm_context(program,15),pixels=op===66?texture(ctx):0;
    const coords=[[-.25,.25,.75,1.25],[.25,.25,.25,.25],[0,.5,1,2],[-1,.25,0,2]];
    register(ctx,0,coords,3);register(ctx,0,Array.from({length:4},()=>[9,9,9,9]),2);
    assert.strictEqual(e.d3d_shader_vm_run(ctx,1),1);
    assert.strictEqual(e.d3d_shader_vm_run(ctx,2),0);
    near(register(ctx,0),op===64?coords.flat().map((v,i)=>i>=12?1:Math.min(1,Math.max(0,v))):
      rgbaLanes([colors[0],colors[0],colors[1],colors[1]]),`initial TEX coordinate opcode ${op}`);
    e.d3d_shader_vm_free(pixels);e.d3d_shader_vm_free(ctx);e.d3d_shader_vm_free(program);cases++;
  }
  {
    const program=bytecode([0xffff0101,69,dstToken(3,1),srcToken(3),1,dstToken(0),srcToken(3,1),65535]);
    const ctx=e.d3d_shader_vm_context(program,15),pixels=texture(ctx,{stage:1});
    register(ctx,0,[[.25,.25,.75,.75],[9,9,9,9],[9,9,9,9],[.25,.75,.25,.75]],3);
    assert.strictEqual(e.d3d_shader_vm_run(ctx,2),0);
    near(register(ctx,0),rgbaLanes(colors),'TEXREG2AR samples (alpha,red)');
    e.d3d_shader_vm_free(pixels);e.d3d_shader_vm_free(ctx);e.d3d_shader_vm_free(program);cases++;
  }
  for(const version of [0xffff0101,0xffff0102]) for(const stage of [0,3]) for(const overwrite of [false,true]) {
    const program=bytecode([version,1,dstToken(3,stage),srcToken(2),65,dstToken(3,stage),1,dstToken(0),srcToken(1),65535]);
    const ctx=e.d3d_shader_vm_context(program,15);
    const original=overwrite?[[-1,1,1,1],[1,-1,1,1],[1,1,-1,1],[1,1,1,-1]]:Array(4).fill([1,1,1,1]);
    register(ctx,stage,original,3);register(ctx,0,Array(4).fill(overwrite?[1,1,1,1]:[-1,-1,-1,-1]),2);
    assert.strictEqual(e.d3d_shader_vm_run(ctx,1),1);
    assert.strictEqual(e.d3d_shader_vm_live_mask(ctx),15);
    assert.strictEqual(e.d3d_shader_vm_run(ctx,2),0);
    assert.strictEqual(e.d3d_shader_vm_live_mask(ctx),overwrite?8:15,'TEXKILL reads original stage coordinates after opposite-sign mutable writes');
    [ctx,program].forEach(p=>e.d3d_shader_vm_free(p));cases++;
  }
  for(const mask of [15,5]) {
    const program=bytecode([0xffff0101,65,dstToken(3),1,dstToken(0),srcToken(1),65535]);
    const ctx=e.d3d_shader_vm_context(program,mask);
    const coords=[[-1,1,1,1],[1,-1,1,1],[1,1,-1,1],[1,1,1,-1]];
    register(ctx,0,coords,3);register(ctx,0,a,1);
    assert.strictEqual(e.d3d_shader_vm_run(ctx,1),1);
    assert.strictEqual(e.d3d_shader_vm_live_mask(ctx),mask&8,'TEXKILL tests xyz, not w');
    assert.deepStrictEqual(register(ctx,0,null,3),coords.flat(),'TEXKILL does not modify register');
    assert.strictEqual(e.d3d_shader_vm_run(ctx,1),0);
    assert.strictEqual(e.d3d_shader_vm_live_mask(ctx),mask&8,'discard persists across resume');
    // Reusing a context for another quad resets only its per-quad discard state.
    u32[(ctx+8)/4]=0;register(ctx,0,Array.from({length:4},()=>[1,1,1,1]),3);
    assert.strictEqual(e.d3d_shader_vm_run(ctx,2),0);
    assert.strictEqual(e.d3d_shader_vm_live_mask(ctx),mask);
    e.d3d_shader_vm_free(ctx);e.d3d_shader_vm_free(program);cases++;
  }
  {
    const program=bytecode(texTokens),ctx=e.d3d_shader_vm_context(program,3);
    register(ctx,0,[[.25,.75,.25,.75],[.25,.25,.75,.75],[0,0,0,0],[1,1,1,1]],3);
    assert.strictEqual(e.d3d_shader_vm_run(ctx,2),-3,'missing bound storage is explicit');
    assert.strictEqual(u32[(ctx+8)/4],0,'failed sample does not retire');
    const pixels=texture(ctx);assert.strictEqual(e.d3d_shader_vm_run(ctx,2),0);
    near(register(ctx,0),rgbaLanes([colors[0],colors[1],[0,0,0,0],[0,0,0,0]]),'inactive lane output retained');
    assert.strictEqual(e.d3d_shader_vm_bind_texture(ctx,0,0),1);
    const descriptor=e.shader_test_alloc(36),valid=[pixels,2,2,12,0,3,3,1,0xff000000];
    for(const [field,value] of [[0,0xfffffffc],[1,0],[1,2049],[2,0xffffffff],[3,7],[3,0xffffffff],[4,123],[5,0],[6,5],[7,3]]) {
      const values=valid.slice();values[field]=value;u32.set(values,descriptor/4);
      assert.strictEqual(e.d3d_shader_vm_bind_texture(ctx,0,descriptor),0,`invalid descriptor field ${field}`);
    }
    assert.strictEqual(e.d3d_shader_vm_bind_texture(ctx,6,descriptor),0);
    assert.strictEqual(e.d3d_shader_vm_bind_texture(ctx,0,0xfffffffc),0);
    e.d3d_shader_vm_free(descriptor);e.d3d_shader_vm_free(pixels);e.d3d_shader_vm_free(ctx);e.d3d_shader_vm_free(program);cases++;
  }
  // Transcendental reference: mathematical values rounded to f32, independently
  // evaluated here, never imported by the WAT execution path. EXP requires at
  // least21bits; LOG's test bound includes normal f32 rounding of large exponents.
  function numeric(actual,expected,tolerance=5e-7) {
    actual.forEach((value,i)=>{
      const want=expected[i];
      if(Number.isNaN(want))assert.ok(Number.isNaN(value));
      else if(!Number.isFinite(want)||Object.is(want,-0))assert.ok(Object.is(value,want),`${value} vs ${want}`);
      else assert.ok(Math.abs(value-want)<=tolerance*Math.max(1,Math.abs(want)),`${value} vs ${want}`);
    });
  }
  const splatLanes=values=>Array.from({length:4},()=>values).flat();
  for(const [op,values,expected] of [
    [6,[1,2,-4,0],[1,.5,-.25,Infinity]],
    [6,[-0,Infinity,NaN,2**-149],[-Infinity,0,NaN,Infinity]],
    [7,[1,4,-9,0],[1,.5,Math.fround(1/3),Infinity]],
    [14,[0,1,-1,.5],[1,2,.5,Math.fround(Math.SQRT2)]],
    [14,[-149,-150,127,128],[2**-149,0,2**127,Infinity]],
    [14,[-Infinity,Infinity,NaN,1],[0,Infinity,NaN,2]],
    [15,[1,2,.5,-8],[0,1,-1,3]],
    [15,[0,2**-149,Infinity,NaN],[-Math.fround(3.4028234663852886e38),-149,Infinity,NaN]],
    [79,[0,2,.5,-8],[-Math.fround(3.4028234663852886e38),1,-1,3]],
  ]) {
    const program=bytecode([0xfffe0101,op,dstToken(4),srcToken(1,0,0),65535]);
    const ctx=e.d3d_shader_vm_context(program,15);register(ctx,0,[values,[0,0,0,0],[0,0,0,0],[0,0,0,0]],1);
    assert.strictEqual(e.d3d_shader_vm_run(ctx,1),0);
    numeric(register(ctx,0,null,4),splatLanes(expected));
    // Subnormal/zero endpoints are exact, not concealed by absolute tolerance.
    if(op===14&&values[0]===-149)assert.deepStrictEqual(register(ctx,0,null,4).slice(0,2),[2**-149,0]);
    e.d3d_shader_vm_free(ctx);e.d3d_shader_vm_free(program);cases++;
  }
  for(const op of [12,13,17]) {
    const program=bytecode([0xfffe0101,op,dstToken(4),srcToken(1),srcToken(2),65535]);
    const ctx=e.d3d_shader_vm_context(program,15);register(ctx,0,a,1);register(ctx,0,b,2);
    assert.strictEqual(e.d3d_shader_vm_run(ctx,1),0);
    const expected=a.flat().map((value,j)=>op===12?+(value<b.flat()[j]):op===13?+(value>=b.flat()[j]):
      j<4?1:j<8?value*b.flat()[j]:j<12?value:b.flat()[j]);
    numeric(register(ctx,0,null,4),expected);
    e.d3d_shader_vm_free(ctx);e.d3d_shader_vm_free(program);cases++;
  }
  {
    const program=bytecode([0xfffe0101,1,dstToken(0),srcToken(2,95),19,dstToken(0,0,3),srcToken(1),1,dstToken(4),srcToken(0),65535]);
    const ctx=e.d3d_shader_vm_context(program,15),values=[[-1.25,-.75,.25,1.75],[2.5,-2.5,0,3.125],[1,1,1,1],[1,1,1,1]];
    register(ctx,0,values,1);assert.strictEqual(e.d3d_shader_vm_run(ctx,3),0);
    numeric(register(ctx,0,null,4),values.flat().map((v,j)=>j<8?v-Math.floor(v):0));
    e.d3d_shader_vm_free(ctx);e.d3d_shader_vm_free(program);cases++;
  }
  {
    const program=bytecode([0xfffe0101,78,dstToken(4),srcToken(1,0,255),65535]);
    const ctx=e.d3d_shader_vm_context(program,15),values=[2.25,-1.5,0,1.75];
    register(ctx,0,[[0,0,0,0],[0,0,0,0],[0,0,0,0],values],1);assert.strictEqual(e.d3d_shader_vm_run(ctx,1),0);
    numeric(register(ctx,0,null,4),[values.map(v=>2**Math.floor(v)),values.map(v=>v-Math.floor(v)),values.map(v=>Math.fround(2**v)),[1,1,1,1]].flat());
    e.d3d_shader_vm_free(ctx);e.d3d_shader_vm_free(program);cases++;
  }
  {
    const program=bytecode([0xfffe0101,16,dstToken(4),srcToken(1),65535]);
    const ctx=e.d3d_shader_vm_context(program,15);
    register(ctx,0,[[1,1,-1,1],[.5,0,.5,2],[0,0,0,0],[2,-2,2,3]],1);
    assert.strictEqual(e.d3d_shader_vm_run(ctx,1),0);
    numeric(register(ctx,0,null,4),[[1,1,1,1],[1,1,0,1],[.25,0,0,8],[1,1,1,1]].flat());
    e.d3d_shader_vm_free(ctx);e.d3d_shader_vm_free(program);cases++;
  }
  for(const op of [18,80]) {
    const tokens=op===18?[0xffff0101,18,dstToken(0),srcToken(1),srcToken(2),srcToken(2,1),65535]:
      [0xffff0101,1,dstToken(0),srcToken(1),80,dstToken(0),srcToken(0,0,255),srcToken(2),srcToken(2,1),65535];
    const program=bytecode(tokens),ctx=e.d3d_shader_vm_context(program,15);
    const amount=Array.from({length:4},()=>[0,.25,.75,1]);register(ctx,0,amount,1);register(ctx,0,a,2);register(ctx,1,b,2);
    assert.strictEqual(e.d3d_shader_vm_run(ctx,2),0);
    const expected=a.flat().map((av,j)=>op===18?Math.fround(Math.fround(amount.flat()[j]*av)+Math.fround((1-amount.flat()[j])*b.flat()[j])):
      amount.flat()[j]>.5?av:b.flat()[j]);
    numeric(register(ctx,0),expected);
    e.d3d_shader_vm_free(ctx);e.d3d_shader_vm_free(program);cases++;
  }
  // TEXREG2GB is supported by Wine's SM1 opcode table and Microsoft's overview;
  // the dedicated Microsoft page omits PS1.1 (native-reference discrepancy).
  {
    const program=bytecode([0xffff0101,70,dstToken(3,1),srcToken(3),1,dstToken(0),srcToken(3,1),65535]);
    const ctx=e.d3d_shader_vm_context(program,15),pixels=texture(ctx,{stage:1});
    register(ctx,0,[[9,9,9,9],[.25,.75,.25,.75],[.25,.25,.75,.75],[9,9,9,9]],3);
    assert.strictEqual(e.d3d_shader_vm_run(ctx,2),0);
    near(register(ctx,0),rgbaLanes(colors),'TEXREG2GB green/blue coordinates');
    [pixels,ctx,program].forEach(p=>e.d3d_shader_vm_free(p));cases++;
  }
  function bump(ctx,stage,values,version=1) {
    const desc=e.shader_test_alloc(28);u32[desc/4]=version;
    new Float32Array(mem.buffer,desc+4,6).set(values);
    const result=e.d3d_shader_vm_bind_bump(ctx,stage,desc);
    new Uint8Array(mem.buffer,desc,28).fill(0);e.d3d_shader_vm_free(desc);return result;
  }
  // Independent signed source: four texels with U/V signs and distinct L.
  // Off-diagonal matrix swaps U/V, so both orientation and stage are observable.
  for(const opcode of [67,68]) for(const filter of [1,2]) {
    const program=bytecode([0xffff0101,66,dstToken(3),opcode,dstToken(3,1),srcToken(3),1,dstToken(0),srcToken(3,1),65535]);
    const ctx=e.d3d_shader_vm_context(program,15),signed=texture(ctx,{format:62}),pixels=texture(ctx,{stage:1,filter});
    const bytes=new Uint8Array(mem.buffer,signed,24);
    [[128,128,0,99],[128,127,85,99],[127,128,170,99],[127,127,255,99]].forEach((v,i)=>bytes.set(v,(i>>1)*12+(i&1)*4));
    register(ctx,0,[[.25,.75,.25,.75],[.25,.25,.75,.75],[0,0,0,0],[1,1,1,1]],3);
    register(ctx,1,Array.from({length:4},()=>[.5,.5,.5,.5]),3);
    assert.strictEqual(e.d3d_shader_vm_run(ctx,3),-3,'missing bump state rejects before retiring');
    assert.strictEqual(u32[(ctx+8)/4],1);
    assert.strictEqual(bump(ctx,1,[0,.25,.25,0,.5,.25]),1);
    assert.strictEqual(bump(ctx,1,[9,9,9,9,9,9],2),0,'unknown version leaves old binding');
    assert.strictEqual(bump(ctx,1,[0,0,Infinity,0,0,0]),0,'nonfinite state leaves old binding');
    assert.strictEqual(e.d3d_shader_vm_run(ctx,3),0,'resume uses copied destination-stage state');
    const expected=colors.map((color,i)=>color.map(v=>v*(opcode===68?i/6+.25:1)));
    near(register(ctx,0),rgbaLanes(expected),`signed TEXBEM${opcode===68?'L':''} filter${filter}`);
    assert.strictEqual(e.d3d_shader_vm_bind_bump(ctx,6,0),0);
    assert.strictEqual(e.d3d_shader_vm_bind_bump(ctx,1,0xfffffffc),0);
    assert.strictEqual(e.d3d_shader_vm_bind_bump(ctx,1,0),1);
    [signed,pixels,ctx,program].forEach(p=>e.d3d_shader_vm_free(p));cases++;
  }
  // Bilinear signed channels are interpolated after signed decode (not as bytes).
  {
    const program=bytecode(texTokens),ctx=e.d3d_shader_vm_context(program,5),pixels=texture(ctx,{format:62,filter:2});
    const bytes=new Uint8Array(mem.buffer,pixels,24);
    [[128,127,0,0],[127,128,255,0],[128,127,0,0],[127,128,255,0]].forEach((v,i)=>bytes.set(v,(i>>1)*12+(i&1)*4));
    register(ctx,0,Array.from({length:4},()=>[.5,.5,.5,.5]),3);
    register(ctx,0,Array.from({length:4},()=>[7,7,7,7]));
    assert.strictEqual(e.d3d_shader_vm_run(ctx,2),0);
    near(register(ctx,0),[0,7,0,7,0,7,0,7,.5,7,.5,7,1,7,1,7],'signed bilinear masked lanes');
    [pixels,ctx,program].forEach(p=>e.d3d_shader_vm_free(p));cases++;
  }
  for(const packets of [
    [ins(71,opnd(3,1,15),opnd(3,0))],
    [ins(72,opnd(3,2,15),opnd(3,0))],
    [ins(71,opnd(3,1,15),opnd(3,0)),ins(72,opnd(3,3,15),opnd(3,0))],
    [ins(71,opnd(3,1,15),opnd(3,0)),ins(72,opnd(3,2,15),opnd(3,0,228,4))],
    [ins(71,opnd(3,1,15),opnd(1,0)),ins(72,opnd(3,2,15),opnd(1,0))]
  ]) {
    const p=ir(packets);u32[(p+8)/4]=1;u32[(p+12)/4]=0xffff0101;
    assert.strictEqual(e.d3d_shader_vm_compile(p),0,'malformed matrix packets reject before allocation');
    e.d3d_shader_vm_free(p);cases++;
  }
  // Paired texture matrix instructions retain their hidden U across yields.
  for(const modifier of [0,4]) for(const mask of [15,5]) {
    const program=bytecode([0xffff0101,64,dstToken(3),71,dstToken(3,1),srcToken(3,0,228,modifier),
      72,dstToken(3,2),srcToken(3,0,228,modifier),1,dstToken(0),srcToken(3,2),65535]);
    const ctx=e.d3d_shader_vm_context(program,mask);
    const values=[[.25,.75,.25,.75],[.25,.25,.75,.75],[.125,.25,.5,1],[1,1,1,1]];
    register(ctx,0,values.map(row=>modifier?row.map(v=>(v+1)/2):row),3);
    register(ctx,1,[[1,1,1,1],[0,0,0,0],[0,0,0,0],[99,99,99,99]],3);
    register(ctx,2,[[0,0,0,0],[1,1,1,1],[0,0,0,0],[99,99,99,99]],3);
    const before=register(ctx,1,null,3);
    register(ctx,0,Array.from({length:4},()=>[9,9,9,9]));
    assert.strictEqual(e.d3d_shader_vm_run(ctx,2),1,'PAD needs no texture bound');
    assert.deepStrictEqual(register(ctx,1,null,3),before,'PAD writes hidden U, not destination texture register');
    near(Array.from(new Float32Array(mem.buffer,ctx+57584,4)),values[0].map((v,l)=>mask&(1<<l)?v:0),'saved U per active lane');
    assert.strictEqual(e.d3d_shader_vm_run(ctx,2),-3,'TEX requires final destination sampler');
    assert.strictEqual(u32[(ctx+8)/4],2,'missing sampler does not retire TEX');
    const pixels=texture(ctx,{stage:2});
    assert.strictEqual(e.d3d_shader_vm_run(ctx,2),0);
    near(register(ctx,0),rgbaLanes(colors.map((color,l)=>mask&(1<<l)?color:[9,9,9,9])),'texture matrix sampling');
    [pixels,ctx,program].forEach(p=>e.d3d_shader_vm_free(p));cases++;
  }
  // All three terms contribute, with distinct per-stage rows and no W term.
  {
    const program=bytecode([0xffff0101,64,dstToken(3),71,dstToken(3,1),srcToken(3),
      72,dstToken(3,2),srcToken(3),1,dstToken(0),srcToken(3,2),65535]);
    const ctx=e.d3d_shader_vm_context(program,15),pixels=texture(ctx,{stage:2,filter:2});
    register(ctx,0,[[.25,.25,.25,.25],[.5,.5,.5,.5],[.75,.75,.75,.75],[1,1,1,1]],3);
    register(ctx,1,[[1,1,1,1],[.25,.25,.25,.25],[-.5,-.5,-.5,-.5],[99,99,99,99]],3); // U=0
    register(ctx,2,[[.5,.5,.5,.5],[.25,.25,.25,.25],[1,1,1,1],[99,99,99,99]],3); // V=1
    assert.strictEqual(e.d3d_shader_vm_run(ctx,4),0);
    near(register(ctx,0),rgbaLanes(Array(4).fill(colors[2])),'RGB three-term dot, W ignored');
    [pixels,ctx,program].forEach(p=>e.d3d_shader_vm_free(p));cases++;
  }
  for(const mask of [15,5]) for(const reverse of [false,true]) for(const both of [false,true]) {
    // Cross-pair alias: RGB writes r1.z while alpha CMP reads its OLD value.
    // Own-instruction CMP alias remains forbidden by native validation.
    const rgb=both?[88,dstToken(0,1,7),srcToken(1,1),srcToken(2,1),srcToken(2,2)]:
      [1,dstToken(0,1,7),srcToken(2,1)];
    const alpha=[88,dstToken(0,0,8),srcToken(0,1,170),srcToken(2,1),srcToken(2,2)];
    const pair=reverse?[alpha,rgb]:[rgb,alpha];pair[1]=[pair[1][0]|0x40000000,...pair[1].slice(1)];
    const program=bytecode([0xffff0102,1,dstToken(0,1),srcToken(1),...pair.flat(),65535]);
    const ctx=e.d3d_shader_vm_context(program,mask),cancelled=e.d3d_shader_vm_context(program,mask);
    for(const c of [ctx,cancelled]) {
      register(c,0,[[0,0,0,0],[0,0,0,0],[-1,0,1,-1],[.4,.4,.4,.4]],1);
      register(c,0,Array(4).fill([-1,1,-1,1]),2);
      register(c,1,Array(4).fill([-1,1,-1,1]),1);
      register(c,1,Array(4).fill([.8,.8,.8,.8]),2);
      register(c,2,Array(4).fill([.2,.2,.2,.2]),2);
      assert.strictEqual(e.d3d_shader_vm_run(c,1),1);
    }
    const before=register(ctx,1);
    assert.strictEqual(e.d3d_shader_vm_run(ctx,1),1);
    assert.deepStrictEqual(register(ctx,1),before,'CMP pair cannot partially retire');
    assert.strictEqual(e.d3d_shader_vm_run(ctx,2),0);
    near(register(ctx,0),[...Array(12).fill(0),...[.2,.8,.8,.2].map((v,l)=>mask&(1<<l)?v:0)],'CMP reads pre-pair r1.z in either order');
    near(register(ctx,1),Array.from({length:16},(_,i)=>!(mask&(1<<(i&3)))?0:i>=12?.4:both?((i&1)?.8:.2):.8),'CMP/MOV RGB masks preserve alpha');
    e.d3d_shader_vm_cancel(cancelled);assert.strictEqual(e.d3d_shader_vm_run(cancelled,2),-2);
    assert.deepStrictEqual(register(cancelled,1),before,'cancel preserves both CMP pair destinations');
    [ctx,cancelled,program].forEach(p=>e.d3d_shader_vm_free(p));cases++;
  }
  for(const mask of [15,5]) for(const reverse of [false,true]) {
    const first=reverse?[5,dstToken(0,0,8),srcToken(0,0,170),srcToken(2)]:
      [5,dstToken(0,0,7,1,1),srcToken(0),srcToken(2)];
    const second=reverse?[0x40000001,dstToken(0,0,7),srcToken(0,0,255)]:
      [0x40000001,dstToken(0,0,8,15,1),srcToken(0,0,170)];
    const program=bytecode([0xffff0101,1,dstToken(0),srcToken(1),...first,...second,65535]);
    assert.strictEqual(u32[(program+4)/4],2,'coissue packet ABI is versioned');
    const ctx=e.d3d_shader_vm_context(program,mask),other=e.d3d_shader_vm_context(program,mask);
    const values=[[.2,.4,.6,.8],[.3,.5,.7,.9],[.25,.75,1.25,-.5],[.1,.9,.6,.4]],scale=[[2,2,2,2],[3,3,3,3],[4,4,4,4],[2,2,2,2]];
    for(const c of [ctx,other]){register(c,0,values,1);register(c,0,scale,2);assert.strictEqual(e.d3d_shader_vm_run(c,1),1);}
    const before=register(ctx,0),otherBefore=register(other,0);
    assert.strictEqual(e.d3d_shader_vm_run(ctx,1),1,'budget cannot expose half a pair');
    assert.strictEqual(u32[(ctx+8)/4],1);assert.strictEqual(u32[(ctx+20)/4],1);
    assert.deepStrictEqual(register(ctx,0),before);
    assert.strictEqual(e.d3d_shader_vm_run(ctx,1),1,'repeated insufficient budgets are side-effect free');
    assert.strictEqual(e.d3d_shader_vm_run(ctx,2),0);
    const expected=values.flat().map((v,j)=>{
      const component=j>>2,lane=j&3;if(!(mask&(1<<lane)))return 0;
      return reverse?(component===3?values[2][lane]*2:values[3][lane]):
        Math.min(1,Math.max(0,component===3?values[2][lane]*.5:v*scale[component][lane]*2));
    });
    near(register(ctx,0),expected,'same destination coissue uses pre-pair cross-component reads');
    assert.strictEqual(u32[(ctx+8)/4],3);assert.strictEqual(u32[(ctx+20)/4],3);
    e.d3d_shader_vm_cancel(other);assert.strictEqual(e.d3d_shader_vm_run(other,2),-2);
    assert.deepStrictEqual(register(other,0),otherBefore,'cancel before pair leaves both writes uncommitted');
    assert.strictEqual(u32[(other+8)/4],1);
    u32[(program+4)/4]=1;
    assert.strictEqual(e.d3d_shader_vm_context(program,15),0,'stale program ABI1 is explicitly rejected');
    assert.strictEqual(e.d3d_shader_vm_run(ctx,2),-1,'context cannot execute stale program ABI');
    u32[(program+4)/4]=2;
    // Never resume at the second packet, even if a caller corrupts the PC.
    u32[(ctx+8)/4]=2;assert.strictEqual(e.d3d_shader_vm_run(ctx,2),-1);
    [ctx,other,program].forEach(p=>e.d3d_shader_vm_free(p));cases++;
  }
  {
    const program=bytecode([0xffff0101,1,dstToken(0),srcToken(1),1,dstToken(0,1),srcToken(1,1),
      1,dstToken(0,1,7),srcToken(0),0x40000001,dstToken(0,0,8),srcToken(0,1,170),65535]);
    const ctx=e.d3d_shader_vm_context(program,15);
    register(ctx,0,[[1,2,3,4],[5,6,7,8],[9,10,11,12],[13,14,15,16]],1);
    register(ctx,1,[[21,22,23,24],[25,26,27,28],[29,30,31,32],[33,34,35,36]],1);
    assert.strictEqual(e.d3d_shader_vm_run(ctx,3),1);assert.strictEqual(u32[(ctx+8)/4],2);
    assert.strictEqual(e.d3d_shader_vm_run(ctx,2),0);
    near(register(ctx,0),[1,2,3,4,5,6,7,8,9,10,11,12,29,30,31,32],'different destinations preserve second source');
    near(register(ctx,1),[1,2,3,4,5,6,7,8,9,10,11,12,33,34,35,36],'first destination masked RGB');
    [ctx,program].forEach(p=>e.d3d_shader_vm_free(p));cases++;
  }
  {
    const program=bytecode([0xffff0101,1,dstToken(0),srcToken(1),
      1,dstToken(0,0,8),srcToken(2),0x40000050,dstToken(0,1,7),srcToken(0,0,255),srcToken(2,1),srcToken(2,2),65535]);
    const ctx=e.d3d_shader_vm_context(program,15);
    register(ctx,0,[[0,0,0,0],[0,0,0,0],[0,0,0,0],[.25,.75,.5,1]],1);
    for(let c=0;c<3;c++)register(ctx,c,Array.from({length:4},()=>[c/2,c/2,c/2,c/2]),2);
    assert.strictEqual(e.d3d_shader_vm_run(ctx,3),0);
    near(register(ctx,1),[1,.5,1,.5,1,.5,1,.5,1,.5,1,.5,0,0,0,0],'CND coissue condition reads old r0.a');
    [ctx,program].forEach(p=>e.d3d_shader_vm_free(p));cases++;
  }
  for(const packets of [
    [{...ins(1,d(0,8),opnd(1,0)),coissue:1}],
    [ins(1,d(0,7),opnd(1,0)),{...ins(1,d(0,7),opnd(1,0)),coissue:1}],
    [ins(1,d(0,7),opnd(1,0)),{...ins(1,d(0,8),opnd(1,0)),coissue:1},{...ins(1,d(1,7),opnd(1,0)),coissue:1}],
    [ins(66,opnd(3,0,15)),{...ins(1,d(0,8),opnd(1,0)),coissue:1}],
    [ins(1,opnd(4,0,7),opnd(1,0)),{...ins(1,d(0,8),opnd(1,0)),coissue:1}]
  ]) {
    const p=ir(packets,2);u32[(p+8)/4]=1;u32[(p+12)/4]=0xffff0101;
    assert.strictEqual(e.d3d_shader_vm_compile(p),0,'invalid coissue packet pair rejects');e.d3d_shader_vm_free(p);cases++;
  }
  let maxExpRelative=0,maxLogAbsolute=0;
  for(const op of [14,15]) {
    const program=bytecode([0xfffe0101,op,dstToken(4),srcToken(1,0,0),65535]);
    const ctx=e.d3d_shader_vm_context(program,15);
    for(let k=0;k<1024;k+=4) {
      const values=Array.from({length:4},(_,j)=>Math.fround(op===14?-125.875+(k+j)*253/1024:
        (1+(k+j)%127/127)*2**(-120+Math.floor((k+j)/127)*30)));
      register(ctx,0,[values,[0,0,0,0],[0,0,0,0],[0,0,0,0]],1);u32[(ctx+8)/4]=0;
      assert.strictEqual(e.d3d_shader_vm_run(ctx,1),0);
      const result=register(ctx,0,null,4).slice(0,4);
      values.forEach((value,j)=>{
        const reference=Math.fround(op===14?2**value:Math.log2(value));
        const error=Math.abs(reference-result[j]);
        if(op===14){maxExpRelative=Math.max(maxExpRelative,error/reference);assert.ok(error/reference<=2**-21,'EXP21bit relative contract');}
        else {maxLogAbsolute=Math.max(maxLogAbsolute,error);assert.ok(error<=2**-16,'LOG f32 exponent rounding bound');}
      });
    }
    e.d3d_shader_vm_free(ctx);e.d3d_shader_vm_free(program);cases++;
  }
  assert.strictEqual(e.shader_test_cpu_unchanged(),1,'sampler and transcendental execution does not borrow x86 state');
  console.log(`PASS D3D threaded SIMD VM: ${cases} cases; EXP max relative ${maxExpRelative}, LOG max absolute ${maxLogAbsolute} (1024 samples each)`);
})().catch(error=>{console.error(error);process.exitCode=1;});
