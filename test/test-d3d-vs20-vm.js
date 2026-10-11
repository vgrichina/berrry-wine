'use strict';
const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

(async () => {
  const { exports: e, memory } = await bootRenderHarness({ fonts: 'none', extraWat: `
    (export "compile20" (func $d3d_shader_ir_compile20))
    (func (export "ir20_live_bytes") (result i32) (global.get $d3d_ir_live_bytes))
    (func (export "alloc20") (param i32) (result i32)
      (call $g2w (call $heap_alloc (local.get 0))))
  ` });
  const u = new Uint32Array(memory.buffer), f = new Float32Array(memory.buffer), b = new Uint8Array(memory.buffer);
  const operand = (bank, index, selector = 0xe4, modifier = 0) => [bank, index, selector, modifier];
  const ins = (op, ...operands) => ({ op, operands });
  const dst = (index, mask = 15) => operand(0, index, mask);
  const constant = (index, relative = false) => operand(2, index, 0xe4, relative ? 256 : 0);
  const source = index => operand(0, index);
  const addr = operand(3, 0, 1);
  let cases = 0;
  function ir(instructions, version = 0xfffe0200) {
    const bytes = 32 + instructions.length * 128, p = e.alloc20(bytes);
    assert(p); u.fill(0, p / 4, (p + bytes) / 4);
    u.set([0x44534952, 1, 0, version, instructions.length, 0, bytes, 1], p / 4);
    instructions.forEach((item, i) => {
      const q = (p + 32 + i * 128) / 4;
      u.set([item.op, i, item.operands.length, 0], q);
      item.operands.forEach((value, j) => u.set(value, q + 4 + j * 4));
    });
    return p;
  }
  function compile(instructions, legacy = false) {
    const p = ir(instructions, legacy ? 0xfffe0101 : 0xfffe0200);
    if (!legacy) assert.strictEqual(e.d3d_shader_vm_compile(p), 0, 'public VM compiler still rejects VS2');
    const program = (legacy ? e.d3d_shader_vm_compile(p) : e.d3d_shader_vm_compile_vs20(p)) >>> 0;
    e.d3d_shader_vm_free(p); assert(program); return program;
  }
  function register(ctx, bank, index) {
    const offset = bank === 2 && index >= 128 ? 65568 + (index - 128) * 64 : 32 + (bank * 128 + index) * 64;
    return (ctx + offset) / 4;
  }
  const x = (ctx, bank, index) => Array.from(f.slice(register(ctx, bank, index), register(ctx, bank, index) + 4));
  function seedConstants(ctx) {
    for (let c = 0; c < 256; c++) for (let component = 0; component < 4; component++)
      f.fill(c + component / 4, register(ctx, 2, c) + component * 4, register(ctx, 2, c) + component * 4 + 4);
  }
  function release(...pointers) { pointers.forEach(p => e.d3d_shader_vm_free(p)); }
  function seedSincosCoefficients(ctx) {
    // Signed half-angle Taylor coefficients from the DDI derivation. Its
    // separate literal table contains conflicting signs/denominators; these
    // fixtures test mathematical results, not a verified SDK macro expansion.
    const coefficients=[[-1/(5040*128),-1/(720*64),1/(24*16),1/(120*32)],[-1/(6*8),-1/(2*4),1,.5]];
    coefficients.forEach((values,index)=>values.forEach((value,component)=>
      f.fill(value,register(ctx,2,254+index)+component*4,register(ctx,2,254+index)+component*4+4)));
  }
  for(const count of [0,1,2,17,255]) for(const lanes of [15,5]) {
    const program=compile([
      ins(1,dst(0),constant(0)),ins(38,operand(7,15)),
      ins(2,dst(0),source(0),constant(1)),ins(39),
      ins(48,operand(7,15,15),...[count,0xffffffff,0x80000000,0x7fc00000].map(v=>operand(255,v,0,0)))
    ]);
    const ctx=e.d3d_shader_vm_context(program,lanes);assert(ctx);
    f.fill(1,register(ctx,2,1),register(ctx,2,1)+16);
    f.fill(77,register(ctx,0,0),register(ctx,0,0)+16);
    let status=1,ticks=0;
    while(status===1){status=e.d3d_shader_vm_run(ctx,1);assert(++ticks<=515);}
    assert.strictEqual(status,0);
    assert.strictEqual(ticks,count?3+count*2:3);
    for(let component=0;component<4;component++)for(let lane=0;lane<4;lane++)
      assert.strictEqual(f[register(ctx,0,0)+component*4+lane],lanes&(1<<lane)?count:77);
    assert.strictEqual(u[(ctx+73760)/4+15*4],count,'REP does not alter i.x');
    assert.strictEqual(u[(ctx+74088)/4],0,'loop is inactive after completion');
    release(ctx,program);cases++;
  }
  for(const condition of [0,1]) for(const outside of [false,true]) {
    const body=ins(2,dst(0),source(0),constant(1));
    const program=compile(outside?
      [ins(40,operand(14,0)),ins(38,operand(7,0)),body,ins(39),ins(43)]:
      [ins(38,operand(7,0)),ins(40,operand(14,0)),body,ins(42),ins(2,dst(0),source(0),constant(2)),ins(43),ins(39)]);
    const ctx=e.d3d_shader_vm_context(program,15);seedConstants(ctx);
    u[(ctx+73760)/4]=3;u[(ctx+74016)/4]=condition;
    assert.strictEqual(e.d3d_shader_vm_run(ctx,100),0);
    assert.strictEqual(x(ctx,0,0)[0],outside?(condition?3:0):(condition?3:6));
    release(ctx,program);cases++;
  }
  for(let index=0;index<16;index++) {
    const program=compile([ins(38,operand(7,index)),ins(2,dst(0),source(0),constant(1)),ins(39)]);
    const ctx=e.d3d_shader_vm_context(program,15);seedConstants(ctx);
    u[(ctx+73760)/4+index*4]=3;
    assert.strictEqual(e.d3d_shader_vm_run(ctx,1),1);
    // Loop count is sampled once on entry, not reread across scheduling slices.
    u[(ctx+73760)/4+index*4]=255;
    assert.strictEqual(e.d3d_shader_vm_run(ctx,100),0);
    assert.strictEqual(x(ctx,0,0)[0],3);
    const cancelled=e.d3d_shader_vm_context(program,15);
    u[(cancelled+73760)/4+index*4]=255;
    assert.strictEqual(e.d3d_shader_vm_run(cancelled,2),1);
    const pc=u[(cancelled+8)/4],remaining=u[(cancelled+74088)/4];
    e.d3d_shader_vm_cancel(cancelled);assert.strictEqual(e.d3d_shader_vm_run(cancelled,100),-2);
    assert.strictEqual(u[(cancelled+8)/4],pc);assert.strictEqual(u[(cancelled+74088)/4],remaining);
    release(cancelled,ctx,program);cases++;
  }
  for(const count of [256,0xffffffff,0x80000000,0x7fffffff]) {
    const program=compile([ins(38,operand(7,0)),ins(39)]);
    const ctx=e.d3d_shader_vm_context(program,15);u[(ctx+73760)/4]=count;
    assert.strictEqual(e.d3d_shader_vm_run(ctx,100),-5);
    assert.strictEqual(u[(ctx+20)/4],0);release(ctx,program);cases++;
  }
  for(const instructions of [
    [ins(39)],[ins(38,operand(7,0))],
    [ins(38,operand(7,0)),ins(38,operand(7,0)),ins(39),ins(39)],
    [ins(40,operand(14,0)),ins(38,operand(7,0)),ins(43),ins(39)],
    [ins(38,operand(7,0)),ins(40,operand(14,0)),ins(39),ins(43)],
    [ins(40,operand(14,0)),ins(38,operand(7,0)),ins(42),ins(39),ins(43)],
    [ins(38,operand(2,0)),ins(39)],[ins(38,operand(7,16)),ins(39)],
    [ins(38,operand(7,0,0)),ins(39)],[ins(38,operand(7,0,228,1)),ins(39)],
    Array.from({length:17},()=>[ins(38,operand(7,0)),ins(39)]).flat()
  ]) {
    const p=ir(instructions);assert.strictEqual(e.d3d_shader_vm_compile_vs20(p),0);release(p);cases++;
  }
  for(const [packet,target] of [[0,0],[0,1],[0,4],[1,0],[1,2]]) {
    const program=compile([ins(38,operand(7,0)),ins(39)]);
    u[(program+16+packet*64+8)/4]=target;
    const ctx=e.d3d_shader_vm_context(program,15);u[(ctx+73760)/4]=1;
    assert.strictEqual(e.d3d_shader_vm_run(ctx,100),-1);release(ctx,program);cases++;
  }
  for (const lanes of [15,5]) for(let index=0;index<16;index++) {
    const words=[0x80000000,0x7fffffff,0x7fc00000,0xffffffff];
    const raw=word=>operand(255,word,0,0);
    const program=compile([
      ins(1,dst(0),constant(0)),
      ins(47,operand(14,index,15),raw(0)),
      ins(48,operand(7,index,15),...words.map(raw)),
      ins(47,operand(14,index,15),raw(index%2?0x80000000:0))
    ]);
    const ctx=e.d3d_shader_vm_context(program,lanes);assert(ctx);
    assert.strictEqual(e.d3d_shader_vm_context_bytes(),74176);
    assert(u.slice((ctx+73760)/4,(ctx+74080)/4).every(v=>v===0));
    assert.deepStrictEqual(Array.from({length:4},(_,i)=>u[(program+16+i*64)/4]),[60,61,60,0]);
    u.fill(123,(ctx+73760)/4,(ctx+74080)/4);
    assert.strictEqual(e.d3d_shader_vm_run(ctx,1),1);
    assert.strictEqual(u[(ctx+74016)/4+index],0);
    assert.strictEqual(e.d3d_shader_vm_run(ctx,1),1);
    assert.deepStrictEqual(Array.from(u.slice((ctx+73760)/4+index*4,(ctx+73760)/4+index*4+4)),words);
    assert.strictEqual(e.d3d_shader_vm_run(ctx,2),0);
    assert.strictEqual(u[(ctx+74016)/4+index],index%2);
    const fresh=e.d3d_shader_vm_context(program,lanes);assert(fresh);
    assert(u.slice((fresh+73760)/4,(fresh+74080)/4).every(v=>v===0));
    release(fresh,ctx,program);cases++;
  }
  assert.strictEqual(e.d3d_shader_vm_context_bytes(), 74176);
  for(const outer of [0,1,0x80000000]) for(const inner of [0,1]) for(const lanes of [15,5]) {
    const program=compile([
      ins(40,operand(14,0)),ins(40,operand(14,1)),ins(1,dst(0),constant(1)),
      ins(42),ins(1,dst(0),constant(2)),ins(43),
      ins(42),ins(1,dst(0),constant(3)),ins(43),
      // Late local definitions are hoisted outside both branches.
      ins(47,operand(14,0,15),operand(255,outer,0,0)),
      ins(47,operand(14,1,15),operand(255,inner,0,0))
    ]);
    const ctx=e.d3d_shader_vm_context(program,lanes);seedConstants(ctx);
    f.fill(77,register(ctx,0,0),register(ctx,0,0)+16);
    let result=1,ticks=0;
    while(result===1){result=e.d3d_shader_vm_run(ctx,1);assert(++ticks<=11);}
    assert.strictEqual(result,0);
    for(let component=0;component<4;component++)for(let lane=0;lane<4;lane++)
      assert.strictEqual(f[register(ctx,0,0)+component*4+lane],lanes&(1<<lane)?(outer?(inner?1:2):3)+component/4:77);
    assert.strictEqual(u[(ctx+20)/4],ticks,'only visited packets retire');
    release(ctx,program);cases++;
  }
  for(const condition of [0,2]) {
    const program=compile([ins(40,operand(14,15)),ins(1,dst(0),constant(1)),ins(43)]);
    const ctx=e.d3d_shader_vm_context(program,15);seedConstants(ctx);
    u[(ctx+74016)/4+15]=condition;
    assert.strictEqual(e.d3d_shader_vm_run(ctx,1),condition?1:0);
    assert.strictEqual(e.d3d_shader_vm_run(ctx,10),0);
    assert.strictEqual(x(ctx,0,0)[0],condition?1:0);
    release(ctx,program);cases++;
  }
  {
    const program=compile([
      ...Array.from({length:16},(_,index)=>ins(40,operand(14,index))),
      ins(1,dst(0),constant(1)),...Array.from({length:16},()=>ins(43))
    ]);
    for(let falseIndex=-1;falseIndex<16;falseIndex++) {
      const ctx=e.d3d_shader_vm_context(program,15);seedConstants(ctx);
      u.fill(1,(ctx+74016)/4,(ctx+74080)/4);
      if(falseIndex>=0)u[(ctx+74016)/4+falseIndex]=0;
      assert.strictEqual(e.d3d_shader_vm_run(ctx,100),0);
      assert.strictEqual(x(ctx,0,0)[0],falseIndex<0?1:0);
      release(ctx);cases++;
    }
    const cancelled=e.d3d_shader_vm_context(program,15);
    u.fill(1,(cancelled+74016)/4,(cancelled+74080)/4);
    assert.strictEqual(e.d3d_shader_vm_run(cancelled,1),1);
    const pc=u[(cancelled+8)/4];e.d3d_shader_vm_cancel(cancelled);
    assert.strictEqual(e.d3d_shader_vm_run(cancelled,100),-2);
    assert.strictEqual(u[(cancelled+8)/4],pc);
    release(cancelled,program);cases++;
  }
  for(const target of [0,4,0xffffffff]) {
    const program=compile([ins(40,operand(14,0)),ins(1,dst(0),constant(1)),ins(43)]);
    u[(program+16+8)/4]=target;
    const ctx=e.d3d_shader_vm_context(program,15);
    assert.strictEqual(e.d3d_shader_vm_run(ctx,1),-1);
    assert.strictEqual(u[(ctx+20)/4],0);release(ctx,program);cases++;
  }
  for(const instructions of [
    [ins(42)],[ins(43)],[ins(40,operand(14,0))],
    [ins(40,operand(14,0)),ins(42),ins(42),ins(43)],
    [ins(40,operand(2,0)),ins(43)],
    [ins(40,operand(14,16)),ins(43)],
    [ins(40,operand(14,0,0)),ins(43)],
    [ins(40,operand(14,0,228,1)),ins(43)],
    Array.from({length:17},()=>[ins(40,operand(14,0)),ins(43)]).flat()
  ]) {
    const p=ir(instructions);assert.strictEqual(e.d3d_shader_vm_compile_vs20(p),0);release(p);cases++;
  }
  for(const opcode of [47,48]) {
    const bank=opcode===47?14:7;
    const definition=()=>ins(opcode,operand(bank,0,15),...Array.from({length:opcode===47?1:4},()=>operand(255,0xffffffff,0,0)));
    for(const [arg,field,value] of [[0,0,2],[0,1,16],[0,2,1],[0,3,1],[1,0,2],[1,2,1],[1,3,1]]) {
      const item=definition();item.operands[arg][field]=value;
      const p=ir([item]);assert.strictEqual(e.d3d_shader_vm_compile_vs20(p),0);
      release(p);cases++;
    }
    const p=ir([definition()],0xfffe0101);
    assert.strictEqual(e.d3d_shader_vm_compile(p),0);release(p);cases++;
  }
  for (const mask of [1,2,3]) for (const lanes of [15,5])
  for (const selector of [0,85,170,255]) for (const negate of [0,1]) {
    const destination = 1;
    const program = compile([ins(37,dst(destination,mask),operand(0,0,selector,negate),constant(254),constant(255))]);
    const ctx=e.d3d_shader_vm_context(program,lanes);assert(ctx);
    seedSincosCoefficients(ctx);
    f.fill(77,register(ctx,0,1),register(ctx,0,1)+16);
    f.fill(9,register(ctx,0,0),register(ctx,0,0)+16);
    const angles=[-0,0,-Math.PI/2,Math.PI];
    f.set(angles,register(ctx,0,0)+(selector&3)*4);
    const previous=Array.from(f.slice(register(ctx,0,destination),register(ctx,0,destination)+16));
    assert.strictEqual(e.d3d_shader_vm_run(ctx,1),0);
    for(let component=0;component<4;component++)for(let lane=0;lane<4;lane++){
      const actual=f[register(ctx,0,destination)+component*4+lane];
      if((mask&(1<<component))&&(lanes&(1<<lane))){
        const angle=Math.fround(angles[lane])*(negate?-1:1);
        const expected=component===0?Math.cos(angle):Math.sin(angle);
        assert(Math.abs(actual-expected)<=2e-6,`SINCOS component${component} ${angle}: ${actual} vs${expected}`);
        if(expected===0)assert.strictEqual(actual,expected);
      }else if(component===3 || !(lanes&(1<<lane)))assert.strictEqual(actual,previous[component*4+lane]);
      // Unwritten XYZ are undefined for VS2; do not constrain their values.
    }
    release(ctx,program);cases++;
  }
  {
    const program=compile([ins(37,dst(1,3),operand(0,0,0),constant(254),constant(255))]);
    let worst=0;
    for(let batch=0;batch<256;batch++){
      const ctx=e.d3d_shader_vm_context(program,15);assert(ctx);
      seedSincosCoefficients(ctx);
      const angles=Array.from({length:4},(_,lane)=>Math.fround(-Math.PI+2*Math.PI*(batch*4+lane)/1023));
      f.set(angles,register(ctx,0,0));
      assert.strictEqual(e.d3d_shader_vm_run(ctx,1),0);
      for(let component=0;component<2;component++)for(let lane=0;lane<4;lane++){
        const expected=component?Math.sin(angles[lane]):Math.cos(angles[lane]);
        const error=Math.abs(f[register(ctx,0,1)+component*4+lane]-expected);
        worst=Math.max(worst,error);assert(error<=2e-6,`SINCOS sweep ${angles[lane]} error${error}`);
      }
      release(ctx);cases++;
    }
    release(program);console.log(`SINCOS 1024 angles max absolute error ${worst}`);
  }
  for (let mask = 1; mask < 16; mask++) for (const lanes of [15, 5])
  for (const selector of [228, 27, 0, 255]) for (const negate of [0, 1]) {
    const program = compile([ins(34, dst(1, mask), operand(0, 0, selector, negate), source(2), source(3))]);
    const ctx = e.d3d_shader_vm_context(program, lanes); assert(ctx);
    const values = [[-1,0,-0,1],[-Infinity,Infinity,NaN,-2],[3,-4,5,-6],[0,-0,1,-1]];
    f.set(values.flat(), register(ctx, 0, 0));
    f.fill(77, register(ctx, 0, 1), register(ctx, 0, 1)+16);
    f.fill(NaN, register(ctx, 0, 2), register(ctx, 0, 3)+16);
    assert.strictEqual(e.d3d_shader_vm_run(ctx, 1), 0);
    for (let component = 0; component < 4; component++) for (let lane = 0; lane < 4; lane++) {
      let input = values[(selector >>> (2*component)) & 3][lane];
      if (negate) input = -input;
      // NaN->1 follows the documented ordered-comparison pseudocode; it is
      // an adapter policy, not a measured historic driver guarantee.
      const expected = !(mask & (1<<component)) || !(lanes & (1<<lane)) ? 77 : input < 0 ? -1 : input === 0 ? 0 : 1;
      assert.strictEqual(f[register(ctx,0,1)+component*4+lane], expected);
    }
    release(ctx, program); cases++;
  }
  // Overlap is not prohibited by the primary SGN page. Evaluate src0 before
  // destination writes; undefined scratch contents are deliberately not tested.
  for (const destination of [0, 1, 2]) for (const scratches of [[2,3],[0,3]]) {
    const program = compile([ins(34, dst(destination, 5), operand(0,0,27), ...scratches.map(source))]);
    const ctx = e.d3d_shader_vm_context(program, 15); assert(ctx);
    f.fill(77, register(ctx,0,destination), register(ctx,0,destination)+16);
    f.set([1,1,1,1,-2,-2,-2,-2,3,3,3,3,-4,-4,-4,-4], register(ctx,0,0));
    assert.strictEqual(e.d3d_shader_vm_run(ctx,1),0);
    for (const component of [0,2])
      assert.deepStrictEqual(Array.from(f.slice(register(ctx,0,destination)+component*4,register(ctx,0,destination)+component*4+4)),[-1,-1,-1,-1]);
    release(ctx,program); cases++;
  }
  for (const [bases, powers] of [
    [[-2,.25,0,-0],[3,.5,2,-2]], [[0,-0,1,-4],[0,0,123,.5]],
    [[2,16,.5,-9],[-2,.25,2,.5]], [[.7,1.1,3.3,8.1],[.125,-.5,2.5,-3]],
  ]) for (const mask of [1, 8, 15]) for (const lanes of [15, 5])
  for (const selector of [0,85,170,255]) for (const destination of [0,1]) {
    const program = compile([ins(32, dst(destination, mask), operand(0, 0, selector), operand(0, 2, 255-selector))]);
    const ctx = e.d3d_shader_vm_context(program, lanes); assert(ctx);
    f.fill(9, register(ctx, 0, 0), register(ctx, 0, 0) + 16);
    f.fill(7, register(ctx, 0, 2), register(ctx, 0, 2) + 16);
    f.fill(77, register(ctx, 0, 1), register(ctx, 0, 1) + 16);
    f.set(bases, register(ctx, 0, 0) + (selector & 3) * 4);
    f.set(powers, register(ctx, 0, 2) + ((255-selector) & 3) * 4);
    const previous = Array.from(f.slice(register(ctx, 0, destination), register(ctx, 0, destination) + 16));
    assert.strictEqual(e.d3d_shader_vm_run(ctx, 1), 0);
    for (let component=0; component<4; component++) for(let lane=0;lane<4;lane++) {
      const active=(mask & (1<<component)) && (lanes & (1<<lane));
      const expected=active ? Math.pow(Math.abs(Math.fround(bases[lane])), Math.fround(powers[lane])) : previous[component*4+lane];
      const actual=f[register(ctx,0,destination)+component*4+lane];
      if (!active || expected===0 || !Number.isFinite(expected)) assert.strictEqual(actual,expected);
      else assert(Math.abs(actual-expected)<=Math.abs(expected)*2**-15,
        `POW ${bases[lane]}^${powers[lane]} mask${mask} lanes${lanes} selector${selector} dst${destination}: ${actual} vs ${expected}`);
    }
    release(ctx,program);cases++;
  }
  {
    // Composite POW accuracy, independent of the standalone LOG/EXP sweeps.
    // Keep results normal; subnormal relative precision is a separate policy.
    const program = compile([ins(32, dst(1), operand(0, 0, 0), operand(0, 2, 0))]);
    let worst = 0;
    for (let batch = 0; batch < 256; batch++) {
      const ctx = e.d3d_shader_vm_context(program, 15); assert(ctx);
      const expected = [];
      for (let lane = 0; lane < 4; lane++) {
        const n = batch * 4 + lane;
        const base = Math.fround(2 ** (-12 + 24 * n / 1023));
        const power = Math.fround(-8 + 16 * ((n * 317) % 1024) / 1023);
        f[register(ctx, 0, 0) + lane] = base;
        f[register(ctx, 0, 2) + lane] = power;
        expected.push(Math.pow(base, power));
      }
      assert.strictEqual(e.d3d_shader_vm_run(ctx, 1), 0);
      for (let lane = 0; lane < 4; lane++) {
        const actual = f[register(ctx, 0, 1) + lane];
        const error = Math.abs(actual / expected[lane] - 1);
        worst = Math.max(worst, error);
        assert(error <= 2 ** -15, `POW composite sample ${batch*4+lane}: relative error ${error}`);
      }
      release(ctx); cases++;
    }
    release(program);
    console.log(`POW composite 1024 samples max relative error ${worst}`);
  }
  for (const opcode of [33, 36]) for (let mask = 1; mask < (opcode === 33 ? 8 : 16); mask++)
  for (const lanes of [15, 5]) for (const negate of [0, 1])
  for (const swizzle of opcode === 33 ? [228] : [228, 27, 0, 85, 170, 255]) {
    const a = [[3,0,-0,1],[4,0,0,2],[0,0,-0,2],[10,1,-1,3]];
    const b = [[0,1,2,3],[0,2,1,4],[1,3,4,5],[99,99,99,99]];
    const sources = [operand(0, 0, swizzle, negate)];
    if (opcode === 33) sources.push(source(2));
    const program = compile([ins(opcode, dst(1, mask), ...sources)]);
    const ctx = e.d3d_shader_vm_context(program, lanes); assert(ctx);
    f.set(a.flat(), register(ctx, 0, 0)); f.set(b.flat(), register(ctx, 0, 2));
    f.fill(77, register(ctx, 0, 1), register(ctx, 0, 1) + 16);
    assert.strictEqual(e.d3d_shader_vm_run(ctx, 1), 0);
    for (let component = 0; component < 4; component++) for (let lane = 0; lane < 4; lane++) {
      const av = a.map((_, c) => {
        const value = a[(swizzle >>> (c * 2)) & 3][lane]; return negate ? -value : value;
      });
      const j = (component + 1) % 3, k = (component + 2) % 3;
      const squared = Math.fround(Math.fround(Math.fround(av[0]*av[0]) + Math.fround(av[1]*av[1])) + Math.fround(av[2]*av[2]));
      const factor = squared === 0 ? Math.fround(3.4028234663852886e38) : Math.fround(1 / Math.fround(Math.sqrt(squared)));
      let expected = opcode === 33 ? Math.fround(Math.fround(av[j]*b[k][lane]) - Math.fround(av[k]*b[j][lane])) : Math.fround(av[component]*factor);
      if (!(mask & (1 << component)) || !(lanes & (1 << lane))) expected = 77;
      assert.strictEqual(f[register(ctx, 0, 1) + component * 4 + lane], expected,
        `vector opcode=${opcode} mask=${mask} lanes=${lanes} negate=${negate} swizzle=${swizzle} component=${component} lane=${lane}`);
    }
    release(ctx, program); cases++;
  }
  {
    // The documented difference form must not overflow an intermediate product
    // when both endpoints are identical finite large values.
    const program = compile([ins(18, dst(1), source(0), constant(255), constant(255))]);
    const ctx = e.d3d_shader_vm_context(program, 15); assert(ctx);
    f.fill(2, register(ctx, 0, 0), register(ctx, 0, 0) + 16);
    const endpoint = Math.fround(2e38);
    f.fill(endpoint, register(ctx, 2, 255), register(ctx, 2, 255) + 16);
    assert.strictEqual(e.d3d_shader_vm_run(ctx, 1), 0);
    assert.deepStrictEqual(Array.from(f.slice(register(ctx, 0, 1), register(ctx, 0, 1) + 16)),
      Array(16).fill(endpoint), 'VS2 LRP preserves identical finite endpoints despite extrapolation');
    release(ctx, program); cases++;
  }
  // Independent mathematical expectations for the reuse-first VS2 arithmetic
  // slice. Each component is a vector of four independent invocations.
  for (const opcode of [14, 15, 16, 17, 18, 79])
  for (const mask of [15, 1, 6, 8]) for (const lanes of [15, 5]) {
    const scalar = [14, 15, 79].includes(opcode);
    const sources = [operand(0, 0, scalar ? 0 : 228)];
    if (opcode === 17 || opcode === 18) sources.push(source(2));
    if (opcode === 18) sources.push(source(3));
    const program = compile([ins(opcode, dst(1, mask), ...sources)]);
    const ctx = e.d3d_shader_vm_context(program, lanes); assert(ctx);
    const a = [[0, -0, -2, 4], [2, 1, 4, 9], [.25, .5, .75, 1], [2, 3, .5, 1]];
    const b = [[1, 2, 3, 4], [4, 3, 2, 1], [5, 6, 7, 8], [8, 7, 6, 5]];
    const c = [[-1, -2, -3, -4], [1, 2, 3, 4], [2, 3, 4, 5], [3, 4, 5, 6]];
    f.set(a.flat(), register(ctx, 0, 0)); f.set(b.flat(), register(ctx, 0, 2));
    f.set(c.flat(), register(ctx, 0, 3)); f.fill(77, register(ctx, 0, 1), register(ctx, 0, 1) + 16);
    assert.strictEqual(e.d3d_shader_vm_run(ctx, 1), 0);
    for (let component = 0; component < 4; component++) for (let lane = 0; lane < 4; lane++) {
      const x = a[0][lane], av = a[component][lane], bv = b[component][lane], cv = c[component][lane];
      let expected = opcode === 14 ? 2 ** x : opcode === 15 || opcode === 79 ?
        x === 0 ? -Math.fround(3.4028234663852886e38) : Math.log2(Math.abs(x)) :
        opcode === 16 ? [1, Math.max(x, 0), x > 0 && a[1][lane] > 0 ? a[1][lane] ** a[3][lane] : 0, 1][component] :
        opcode === 17 ? [1, a[1][lane] * b[1][lane], a[2][lane], b[3][lane]][component] :
        av * (bv - cv) + cv;
      if (!(mask & (1 << component)) || !(lanes & (1 << lane))) expected = 77;
      const actual = f[register(ctx, 0, 1) + component * 4 + lane];
      assert(Math.abs(actual - expected) <= Math.max(1, Math.abs(expected)) * 1e-6,
        `VS2 opcode=${opcode} mask=${mask} lanes=${lanes} component=${component} lane=${lane}: ${actual} vs ${expected}`);
    }
    release(ctx, program); cases++;
  }
  // EXPP changes semantics between VS1 and VS2: the latter replicates exp2,
  // including .w, instead of the VS1 floor/fraction/exp2/one vector.
  for (const legacy of [false, true]) for (const mask of [15, 8])
  for (const lanes of [15, 5]) for (let scalar = 0; scalar < 4; scalar++) {
    const program = compile([ins(78, dst(1, mask), operand(0, 0, scalar * 85))], legacy);
    const ctx = e.d3d_shader_vm_context(program, lanes); assert(ctx);
    f.fill(9, register(ctx, 0, 0), register(ctx, 0, 0) + 16);
    const values = [-1.5, -.5, .5, 1.5];
    f.set(values, register(ctx, 0, 0) + scalar * 4);
    f.fill(77, register(ctx, 0, 1), register(ctx, 0, 1) + 16);
    assert.strictEqual(e.d3d_shader_vm_run(ctx, 1), 0);
    for (let component = 0; component < 4; component++) for (let lane = 0; lane < 4; lane++) {
      const v = values[lane], power = Math.fround(2 ** v);
      const expected = !(mask & (1 << component)) || !(lanes & (1 << lane)) ? 77 :
        legacy ? [2 ** Math.floor(v), v - Math.floor(v), power, 1][component] : power;
      const actual = f[register(ctx, 0, 1) + component * 4 + lane];
      assert(Math.abs(actual - expected) <= Math.abs(expected) * 1e-6,
        `EXPP legacy=${legacy} mask=${mask} lanes=${lanes} scalar=${scalar}: ${actual} vs ${expected}`);
    }
    release(ctx, program); cases++;
  }
  {
    const program = compile([ins(46, addr, source(0)), ins(1, dst(1), constant(128, true)),
      ins(1, dst(2), constant(255)), ins(1, dst(3), constant(127)), ins(1, dst(4), constant(128)),
      ins(35, dst(5), source(0))]);
    const ctx = e.d3d_shader_vm_context(program, 15); assert(ctx); seedConstants(ctx);
    f.set([.5, 1.5, 2.5, -1.5], register(ctx, 0, 0));
    b.fill(0x5a, ctx + 62848, ctx + 65568);
    assert.strictEqual(e.d3d_shader_vm_run(ctx, 1), 1, 'budget stops after MOVA');
    assert.deepStrictEqual(x(ctx, 3, 0), [0, 2, 2, -2], 'nearest-even tie policy');
    assert.strictEqual(e.d3d_shader_vm_run(ctx, 20), 0);
    assert.deepStrictEqual(x(ctx, 0, 1), [128, 130, 130, 126], 'relative gather spans appended and legacy constants');
    assert.deepStrictEqual(x(ctx, 0, 2), [255, 255, 255, 255]);
    assert.deepStrictEqual(x(ctx, 0, 3), [127, 127, 127, 127]);
    assert.deepStrictEqual(x(ctx, 0, 4), [128, 128, 128, 128]);
    assert.deepStrictEqual(x(ctx, 0, 5), [.5, 1.5, 2.5, 1.5], 'ABS foundation');
    assert(b.subarray(ctx + 62848, ctx + 65568).every(v => v === 0x5a), 'stage4/5 sampler records unchanged');
    release(ctx, program); cases++;
  }
  for (const addresses of [[-1, 255, 256, 1000000], [NaN, Infinity, -Infinity, 0]]) {
    const program = compile([ins(46, addr, source(0)), ins(1, dst(1), constant(0, true))]);
    const ctx = e.d3d_shader_vm_context(program, 15); seedConstants(ctx);
    f.set(addresses, register(ctx, 0, 0));
    assert.strictEqual(e.d3d_shader_vm_run(ctx, 8), 0);
    assert.deepStrictEqual(x(ctx, 0, 1), addresses[0] === -1 ? [0, 255, 0, 0] : [0, 0, 0, 0], 'bounded nonfinite/overflow gather');
    release(ctx, program); cases++;
  }
  {
    const program = compile([ins(46, addr, source(0)), ins(1, dst(1), constant(128, true))]);
    const ctx = e.d3d_shader_vm_context(program, 5); seedConstants(ctx);
    f.set([1.6, 1.6, -1.6, -1.6], register(ctx, 0, 0));
    f.fill(99, register(ctx, 3, 0), register(ctx, 3, 0) + 4);
    f.fill(77, register(ctx, 0, 1), register(ctx, 0, 1) + 4);
    assert.strictEqual(e.d3d_shader_vm_run(ctx, 8), 0);
    assert.deepStrictEqual(x(ctx, 3, 0), [2, 99, -2, 99]);
    assert.deepStrictEqual(x(ctx, 0, 1), [130, 77, 126, 77], 'inactive lanes retained');
    release(ctx, program); cases++;
  }
  {
    const word = value => { const v = new DataView(new ArrayBuffer(4)); v.setFloat32(0, value, true); return v.getUint32(0, true); };
    const program = compile([ins(1, dst(0), constant(255)),
      ins(81, operand(2, 255, 15), ...[9, 8, 7, 6].map(v => operand(255, word(v), 0)))]);
    const ctx = e.d3d_shader_vm_context(program, 15); seedConstants(ctx);
    assert.strictEqual(e.d3d_shader_vm_run(ctx, 8), 0);
    assert.deepStrictEqual(Array.from(f.slice(register(ctx, 0, 0), register(ctx, 0, 0) + 16)), [9, 9, 9, 9, 8, 8, 8, 8, 7, 7, 7, 7, 6, 6, 6, 6], 'high DEF hoisted and mapped');
    release(ctx, program); cases++;
  }
  {
    const program = compile([ins(1, addr, source(0)), ins(1, dst(1), constant(95, true))], true);
    const ctx = e.d3d_shader_vm_context(program, 15); seedConstants(ctx);
    f.set([1.6, -.1, .9, -1.6], register(ctx, 0, 0));
    assert.strictEqual(e.d3d_shader_vm_run(ctx, 8), 0);
    assert.deepStrictEqual(x(ctx, 3, 0), [1, -1, 0, -2], 'legacy MOV-a0 still floors');
    assert.deepStrictEqual(x(ctx, 0, 1), [0, 94, 95, 93], 'legacy relative limit remains96');
    release(ctx, program); cases++;
  }
  for (const bad of [ins(46, dst(0), source(0)), ins(46, operand(3, 0, 0), source(0)),
    ...[0,4,8,15].map(mask=>ins(37,dst(1,mask),operand(0,0,0),constant(254),constant(255))),
    ins(37,dst(0,3),operand(0,0,0),constant(254),constant(255)),
    ins(37,operand(5,0,3),operand(0,0,0),constant(254),constant(255)),
    ins(37,dst(1,3),source(0),constant(254),constant(255)),
    ins(37,dst(1,3),operand(0,0,0),source(2),constant(255)),
    ins(37,dst(1,3),operand(0,0,0),constant(254),source(2)),
    ins(37,dst(1,3),operand(0,0,0),constant(254),constant(254)),
    ins(37,dst(1,3),operand(0,0,0),constant(254),constant(256)),
    ins(34, dst(0), source(1), source(2), source(2)),
    ins(34, dst(0), source(1), constant(2), source(3)),
    ins(34, dst(0), source(1), source(2), operand(1, 3)),
    ins(34, dst(0), source(1), source(12), source(3)),
    ins(34, dst(0), source(1), operand(0, 2, 228, 256), source(3)),
    ins(1, addr, source(0)), ins(1, dst(0), constant(256)), ins(1, dst(0), operand(3, 0)),
    ins(1, dst(0), operand(0, 0, 0xe4, 256)), ins(1, dst(0), operand(2, 0, 0xe4, 512)),
    ins(20, dst(0), source(0), constant(0)), ins(35, dst(0), operand(0, 0, 0xe4, 2)),
    ...[14, 15, 78, 79].map(opcode => ins(opcode, dst(0), source(1))),
    ins(33, dst(0, 7), source(0), source(1)), ins(33, dst(0, 7), source(1), source(0)),
    ins(33, dst(0, 8), source(1), source(2)), ins(33, dst(0, 7), operand(0, 1, 27), source(2)),
    ins(33, operand(5, 0, 7), source(1), source(2)),
    ins(36, dst(0), source(0)), ins(36, operand(5, 0, 15), source(1)),
    ins(32, dst(0), operand(0, 1, 0), operand(0, 0, 255)),
    ins(32, operand(5, 0, 15), operand(0, 1, 0), operand(0, 2, 0)),
    ins(32, dst(0), source(1), operand(0, 2, 0)),
    ins(32, dst(0), operand(0, 1, 0), source(2)),
    ins(1, operand(4, 1, 15), source(0)), ins(46, operand(3, 0, 1, 1), source(0))]) {
    const p = ir([bad]); assert.strictEqual(e.d3d_shader_vm_compile_vs20(p), 0, 'private unsupported/malformed IR rejected');
    release(p); cases++;
  }
  for (const [word, value] of [[2, 1], [3, 0xfffe0101], [7, 2], [7, 4]]) {
    const p = ir([ins(1, dst(0), constant(0))]); u[p / 4 + word] = value;
    assert.strictEqual(e.d3d_shader_vm_compile_vs20(p), 0, 'private header profile/flags checked');
    release(p); cases++;
  }
  {
    // Real private decoder -> packet compiler -> SIMD execution; public decoder remains closed.
    const tokens = [0xfffe0200, 0x0200001f, 0x80000000, 0x900f0000,
      0x0200002e, 0xb0010000, 0x90000000,
      0x03000001, 0xc00f0000, 0xa0e42080, 0xb0000000, 0xffff];
    const baseline = e.ir20_live_bytes();
    const p = e.alloc20(tokens.length * 4); u.set(tokens, p / 4);
    const nativeIR = e.compile20(p, tokens.length); assert(nativeIR, 'private decoder accepts test');
    const program = e.d3d_shader_vm_compile_vs20(nativeIR); assert(program, 'native IR matches VM contract');
    const ctx = e.d3d_shader_vm_context(program, 15); seedConstants(ctx);
    f.set([0, 1, 2, -1], register(ctx, 1, 0));
    assert.strictEqual(e.d3d_shader_vm_run(ctx, 8), 0);
    assert.deepStrictEqual(x(ctx, 4, 0), [128, 129, 130, 127]);
    release(ctx, program, p);
    e.d3d_shader_ir_free(nativeIR);
    assert.strictEqual(e.ir20_live_bytes(), baseline, 'decoder-owned IR lifetime returns to baseline');
    cases++;
  }
  console.log(`Private VS2 VM PASS ${cases} cases; public admission unchanged`);
})().catch(error => { console.error(error); process.exitCode = 1; });
