#!/usr/bin/env node
'use strict';
const assert=require('assert');
const {bootRenderHarness}=require('./render-helper');
const {Bridge}=require('../lib/d3d9-host');
(async()=>{
  const methods=['BeginStateBlock','EndStateBlock','SetRenderState','GetRenderState','SetFVF','GetFVF','SetSamplerState','GetSamplerState','SetTexture','GetTexture','SetTransform','GetTransform','GetGammaRamp','SetGammaRamp','CreateVertexDeclaration','SetVertexDeclaration','GetVertexDeclaration'];
  const blockMethods=['Capture','Apply','Release','QueryInterface','GetDevice'];
  methods.push('SetTextureStageState','GetTextureStageState');
  methods.push('SetNPatchMode','MultiplyTransform');
  methods.push('SetIndices','GetIndices','SetStreamSource','GetStreamSource');
  for(const stage of ['Vertex','Pixel'])for(const op of ['Create','Set','Get'])methods.push(op+stage+'Shader');
  for(const stage of ['Vertex','Pixel'])for(const op of ['Set','Get'])methods.push(op+stage+'ShaderConstantF');
  let traceEnabled=true;
  const provenance=new Bridge({backend:'software',worldProvenance:true});
  const {exports:e}=await bootRenderHarness({fonts:'none',extraHostOverrides:{
    gpu_gl_call:(op,p,aux)=>op===0x30017&&aux===24&&traceEnabled?1:0,
    dx_trace:(...args)=>provenance.noteWorldTrace(...args)},extraWat:`
    (func (export "traceProbe") (param $p i32) (result i32) (call $d3d9_world_probe_matrix (local.get $p)))
    (func (export "traceMissingSetup")
      (global.set $d3d9_world_trace_enabled (i32.const -1))
      (global.set $api_handler_depth (i32.const 1))
      (i32.store (global.get $NULL_SENTINEL) (i32.const 0x12345678)))
    (func (export "traceMissingFinish") (result i32)
      (global.set $api_handler_depth (i32.const 0))
      (i32.load (global.get $NULL_SENTINEL)))
    (func (export "buffer") (param $device i32) (param $kind i32) (param $out i32) (result i32)
      (call $d3d9_buffer_create (local.get $device) (i32.const 128) (i32.const 0)
        (select (i32.const 101) (i32.const 0) (i32.eq (local.get $kind) (i32.const 7)))
        (i32.const 1) (local.get $out) (local.get $kind)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "npatch") (param $device i32) (result f64)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
      (call $handle_IDirect3DDevice9_GetNPatchMode (local.get $device) (i32.const 0)
        (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
      (call $fpu_pop))
    (func (export "texture") (param $device i32) (param $out i32) (result i32)
      (call $d3d9_texture_create (local.get $device) (i32.const 2) (i32.const 2)
        (i32.const 1) (i32.const 0) (i32.const 21) (i32.const 1) (local.get $out))
      (i32.load offset=0 (global.get $reg_base)))
    (func (export "releaseTexture") (param $texture i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
      (call $handle_IDirect3DShader9_Release (local.get $texture) (i32.const 0)
        (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "device") (param $out i32) (result i32)
      (local $d i32)
      (call $d3dim_create_device (i32.const 0) (i32.const 0) (local.get $out) (global.get $DX_VTBL_D3DDEV9))
      (local.set $d (call $gl32 (local.get $out)))
      (store.field DxObject type (call $dx_from_this (local.get $d)) (i32.const 20))
      (store.field DxObject misc1 (call $dx_from_this (local.get $d)) (call $d3d9_program_alloc))
      (local.get $d))
    ${[...methods.map(n=>['IDirect3DDevice9',n]),...blockMethods.map(n=>['IDirect3DStateBlock9',n])].map(([type,name])=>`
    (func (export "${name}") (param $a i32) (param $b i32) (param $c i32) (param $d i32) (param $f i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
      (call $handle_${require('../src/api_table.json').find(a=>a.name===`${type}_${name}`).handler||`${type}_${name}`} (local.get $a) (local.get $b) (local.get $c)
        (local.get $d) (local.get $f) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))`).join('\n')}
  `});
  e.init_dx_com_thunks();
  const out=0x00409000,d=e.device(out),invalid=0x8876086c;
  assert.strictEqual(e.npatch(d),0);
  assert.strictEqual(e.get_esp()>>>0,0x074ff008);
  for(const bits of [0x3f800000,0x40000000,0xbf800000,0x7fc00000])
    assert.strictEqual(e.SetNPatchMode(d,bits)>>>0,0x8876086a);
  assert.strictEqual(e.SetNPatchMode(d,0),0);
  assert.strictEqual(e.SetNPatchMode(d,0x80000000),0);
  const read=p=>e.guest_read32(p)>>>0;
  const buffers=[6,6,7,7].map(kind=>{assert.strictEqual(e.buffer(d,kind,out),0);return read(out);});
  const [v1,v2,i1,i2]=buffers,refs=b=>read(b+20);
  assert.strictEqual(e.BeginStateBlock(d),0);
  assert.strictEqual(e.SetIndices(d,i1),0);assert.strictEqual(refs(i1),1);
  assert.strictEqual(e.SetIndices(d,i2),0);assert.strictEqual(refs(i1),0);
  assert.strictEqual(e.SetStreamSource(d,0,v1,8,16),0);
  assert.strictEqual(e.SetStreamSource(d,0,v2,16,32),0);assert.strictEqual(refs(v1),0);
  assert.strictEqual(e.SetStreamSource(d,0,v1,128,16)>>>0,invalid);
  assert.strictEqual(refs(v2),1,'invalid write preserves recorded buffer');
  assert.strictEqual(e.GetIndices(d,out),0);assert.strictEqual(read(out),0,'recording leaves live IB alone');
  assert.strictEqual(e.GetStreamSource(d,0,out,out+4,out+8),0);assert.strictEqual(read(out),0);
  assert.strictEqual(e.EndStateBlock(d,out),0);const buffersBlock=read(out);
  assert.strictEqual(e.Apply(buffersBlock),0);
  assert.strictEqual(refs(i2),2);assert.strictEqual(refs(v2),2);
  assert.strictEqual(e.GetStreamSource(d,0,out,out+4,out+8),0);
  assert.deepStrictEqual([read(out),read(out+4),read(out+8)],[v2,16,32]);
  e.releaseTexture(v2); // balance getter's external AddRef
  assert.strictEqual(e.SetIndices(d,i1),0);
  assert.strictEqual(e.Capture(buffersBlock),0);assert.strictEqual(refs(i2),0);assert.strictEqual(refs(i1),2);
  assert.strictEqual(e.SetIndices(d,0),0);
  assert.strictEqual(e.Apply(buffersBlock),0);
  assert.strictEqual(e.GetIndices(d,out),0);assert.strictEqual(read(out),i1);e.releaseTexture(i1);
  assert.strictEqual(e.Release(buffersBlock),0);
  assert.strictEqual(refs(i1),1);assert.strictEqual(refs(v2),1);
  assert.strictEqual(e.SetIndices(d,0),0);assert.strictEqual(e.SetStreamSource(d,0,0,0,0),0);
  for(const b of buffers){assert.strictEqual(refs(b),0);assert.strictEqual(e.releaseTexture(b),0);}
  for(const stage of[4,5]){
    const sampler=type=>{assert.strictEqual(e.GetSamplerState(d,stage,type,out),0);return read(out);};
    assert.strictEqual(sampler(1),1);assert.strictEqual(sampler(5),1);
    assert.strictEqual(e.texture(d,out),0);const texture=read(out);
    assert.strictEqual(e.BeginStateBlock(d),0);
    assert.strictEqual(e.SetTexture(d,stage,texture),0);
    assert.strictEqual(e.SetTexture(d,stage,texture),0);assert.strictEqual(refs(texture),1);
    assert.strictEqual(e.SetSamplerState(d,stage,1,3),0);
    assert.strictEqual(e.SetSamplerState(d,stage,5,2),0);
    assert.strictEqual(sampler(1),1,'recording leaves appended live sampler unchanged');
    assert.strictEqual(e.GetTexture(d,stage,out),0);assert.strictEqual(read(out),0);
    assert.strictEqual(e.EndStateBlock(d,out),0);const block=read(out);
    assert.strictEqual(e.Apply(block),0);assert.strictEqual(refs(texture),2);
    assert.strictEqual(sampler(1),3);assert.strictEqual(sampler(5),2);
    assert.strictEqual(e.GetTexture(d,stage,out),0);assert.strictEqual(read(out),texture);e.releaseTexture(texture);
    assert.strictEqual(e.SetSamplerState(d,stage,1,2),0);
    assert.strictEqual(e.Capture(block),0);assert.strictEqual(refs(texture),2);
    assert.strictEqual(e.SetSamplerState(d,stage,1,1),0);
    assert.strictEqual(e.Apply(block),0);assert.strictEqual(sampler(1),2);
    assert.strictEqual(e.SetTexture(d,stage,0),0);assert.strictEqual(refs(texture),1);
    assert.strictEqual(e.Release(block),0);assert.strictEqual(refs(texture),0);
    assert.strictEqual(e.releaseTexture(texture),0);
  }
  assert.strictEqual(e.SetTexture(d,6,0)>>>0,invalid);
  assert.strictEqual(e.SetSamplerState(d,6,1,1)>>>0,invalid);
  const state=id=>{assert.strictEqual(e.GetRenderState(d,id,out),0);return read(out);};
  const tss=(stage,type)=>{assert.strictEqual(e.GetTextureStageState(d,stage,type,out),0);return read(out);};
  for(let stage=0;stage<8;stage++) {
    assert.strictEqual(tss(stage,1),stage?1:4);
    assert.strictEqual(tss(stage,4),stage?1:2);
    assert.strictEqual(tss(stage,11),stage);
    assert.strictEqual(tss(stage,28),1);
  }
  assert.strictEqual(e.SetTextureStageState(d,8,1,2)>>>0,invalid);
  assert.strictEqual(e.SetTextureStageState(d,0,12,2)>>>0,invalid);
  for(const value of[0,2,3,4,6,17,21,0xffffffff]){
    assert.strictEqual(e.SetTextureStageState(d,0,28,value)>>>0,invalid);
    assert.strictEqual(tss(0,28),1,'invalid RESULTARG preserves CURRENT');
  }
  assert.strictEqual(e.SetTextureStageState(d,0,28,5),0);assert.strictEqual(tss(0,28),5);
  assert.strictEqual(e.SetTextureStageState(d,0,28,1),0);
  assert.strictEqual(e.GetTextureStageState(d,0,1,0)>>>0,invalid);
  assert.strictEqual(e.BeginStateBlock(d),0);
  assert.strictEqual(e.SetNPatchMode(d,0),0,'recording disabled N-patches preserves linear rendering');
  assert.strictEqual(e.SetTextureStageState(d,0,1,2),0);
  assert.strictEqual(e.SetTextureStageState(d,0,1,3),0);
  assert.strictEqual(e.SetTextureStageState(d,7,32,0x11223344),0);
  assert.strictEqual(tss(0,1),4,'recording leaves texture-stage state untouched');
  assert.strictEqual(e.EndStateBlock(d,out),0);const tssBlock=read(out);
  assert.strictEqual(e.Apply(tssBlock),0);
  assert.strictEqual(tss(0,1),3);assert.strictEqual(tss(7,32),0x11223344);
  assert.strictEqual(e.SetTextureStageState(d,0,1,4),0);
  assert.strictEqual(e.Capture(tssBlock),0);
  assert.strictEqual(e.SetTextureStageState(d,0,1,2),0);
  assert.strictEqual(e.SetTextureStageState(d,1,1,6),0);
  assert.strictEqual(e.Apply(tssBlock),0);
  assert.strictEqual(tss(0,1),4);assert.strictEqual(tss(1,1),6,'uncaptured stage survives Apply');
  assert.strictEqual(e.Release(tssBlock),0);
  const mat=out+64,copy=mat+64;
  const ramp=out+256,rampCopy=ramp+1536;
  e.GetGammaRamp(d,0,ramp);
  for(let channel=0;channel<3;channel++)for(let i=0;i<256;i+=2)
    assert.strictEqual(read(ramp+channel*512+i*2),i|((i+1)<<16),'default WORD ramp 0..255');
  e.guest_write32(ramp,0x12345678);e.SetGammaRamp(d,0,0,ramp);
  e.guest_write32(ramp,0);e.GetGammaRamp(d,0,rampCopy);
  assert.strictEqual(read(rampCopy),0x12345678,'gamma data is copied, independent of caller memory');
  e.GetGammaRamp(d,1,ramp);assert.strictEqual(read(ramp),0,'invalid swap chain leaves output untouched');
  const matrix=()=>Array.from({length:16},(_,i)=>read(copy+i*4));
  const identity=Array.from({length:16},(_,i)=>i%5===0?0x3f800000:0);
  for(const type of [2,3,16,23,256,511]) {
    assert.strictEqual(e.GetTransform(d,type,copy),0);assert.deepStrictEqual(matrix(),identity);
  }
  assert.strictEqual(e.SetTransform(d,24,mat)>>>0,invalid);
  assert.strictEqual(e.SetTransform(d,16,0)>>>0,invalid);
  for(let i=0;i<16;i++)e.guest_write32(mat+i*4,0x3f000000+i);
  const recorded=Array.from({length:16},(_,i)=>read(mat+i*4));
  assert.strictEqual(e.texture(d,out),0);const t=read(out);
  assert.strictEqual(e.SetTexture(d,1,t),0);
  assert.strictEqual(e.SetRenderState(d,22,1),0);assert.strictEqual(e.SetRenderState(d,27,0),0);
  assert.strictEqual(e.EndStateBlock(d,out)>>>0,invalid);assert.strictEqual(read(out),0);
  assert.strictEqual(e.BeginStateBlock(d),0);
  assert.strictEqual(e.BeginStateBlock(d)>>>0,invalid,'nested recording rejected');
  assert.strictEqual(e.SetRenderState(d,22,2),0);assert.strictEqual(e.SetRenderState(d,22,3),0);
  assert.strictEqual(e.SetSamplerState(d,2,5,2),0);
  assert.strictEqual(e.SetTransform(d,23,mat),0);
  assert.strictEqual(e.GetTransform(d,23,copy),0);assert.deepStrictEqual(matrix(),identity);
  e.guest_write32(mat,0); // immutable recorded copy, not a retained guest pointer
  assert.strictEqual(e.SetTexture(d,0,t),0);assert.strictEqual(e.SetTexture(d,0,0),0);
  assert.strictEqual(e.SetTexture(d,0,t),0);
  assert.strictEqual(read(t+20),2,'one live and one recorded reference despite repeated writes');
  assert.strictEqual(e.GetTexture(d,0,out),0);assert.strictEqual(read(out),0,'recording leaves live binding unchanged');
  assert.strictEqual(e.releaseTexture(t),0,'recorded allocation survives external release');
  assert.strictEqual(e.GetSamplerState(d,2,5,out),0);assert.strictEqual(read(out),1,'sampler recording leaves live state unchanged');
  assert.strictEqual(state(22),1,'recording does not mutate live render state');
  assert.strictEqual(e.EndStateBlock(d,0)>>>0,invalid,'null output retains recording');
  assert.strictEqual(e.EndStateBlock(d,out),0);const b=read(out);assert.ok(read(b));
  assert.strictEqual(e.SetRenderState(d,27,1),0);
  assert.strictEqual(e.Apply(b),0);assert.strictEqual(state(22),3,'last recorded value wins');
  assert.strictEqual(e.GetSamplerState(d,2,5,out),0);assert.strictEqual(read(out),2);
  assert.strictEqual(e.GetTransform(d,23,copy),0);assert.deepStrictEqual(matrix(),recorded);
  assert.strictEqual(e.GetTransform(d,16,copy),0);assert.deepStrictEqual(matrix(),identity,'transform slots are independent');
  assert.strictEqual(e.GetTexture(d,0,out),0);assert.strictEqual(read(out),t);
  assert.strictEqual(e.releaseTexture(t),0);
  assert.strictEqual(read(t+20),3,'Apply adds live reference and preserves unrecorded stage');
  assert.strictEqual(state(27),1,'unrecorded state preserved');
  assert.strictEqual(e.SetRenderState(d,22,2),0);assert.strictEqual(e.SetSamplerState(d,2,5,1),0);
  assert.strictEqual(e.SetTexture(d,0,0),0);
  assert.strictEqual(e.SetTransform(d,23,mat),0);
  assert.strictEqual(e.Capture(b),0);assert.strictEqual(read(t+20),1,'Capture drops old recorded texture reference');
  assert.strictEqual(e.SetTexture(d,0,t),0);
  e.guest_write32(mat,0x40000000);assert.strictEqual(e.SetTransform(d,23,mat),0);
  assert.strictEqual(e.SetSamplerState(d,2,5,2),0);
  assert.strictEqual(e.SetRenderState(d,22,1),0);assert.strictEqual(e.SetRenderState(d,27,0),0);
  assert.strictEqual(e.Apply(b),0);assert.strictEqual(state(22),2);assert.strictEqual(state(27),0);
  assert.strictEqual(e.GetSamplerState(d,2,5,out),0);assert.strictEqual(read(out),1,'Capture refreshes selected sampler values');
  assert.strictEqual(e.GetTransform(d,23,copy),0);assert.strictEqual(read(copy),0,'Capture refreshes selected transform');
  assert.strictEqual(e.GetTexture(d,0,out),0);assert.strictEqual(read(out),0,'Apply restores captured null binding');
  assert.strictEqual(e.SetTexture(d,0,t),0);assert.strictEqual(e.Capture(b),0);
  assert.strictEqual(read(t+20),3);
  assert.strictEqual(e.Release(b),0);
  assert.strictEqual(read(t+20),2,'block destruction releases captured texture');
  assert.strictEqual(e.SetTexture(d,0,0),0);assert.strictEqual(e.SetTexture(d,1,0),0);
  const elements=out+4096;
  e.guest_write32(elements,0);e.guest_write32(elements+4,3); // FLOAT4 POSITION0
  e.guest_write32(elements+8,255);e.guest_write32(elements+12,17); // END
  assert.strictEqual(e.CreateVertexDeclaration(d,elements,out),0);const decl=read(out);
  assert.strictEqual(e.SetFVF(d,0x4002),0);
  // Native D3D9 preserves both FVF and declaration selection on SetFVF(0).
  // Wine conformance: dlls/d3d9/tests/device.c, test_fvf_decl_conversion.
  assert.strictEqual(e.SetFVF(d,0),0);
  assert.strictEqual(e.GetFVF(d,out),0);assert.strictEqual(read(out),0x4002,'zero FVF preserves live FVF');
  assert.strictEqual(e.BeginStateBlock(d),0);
  assert.strictEqual(e.SetVertexDeclaration(d,decl),0);
  assert.strictEqual(e.SetVertexDeclaration(d,0),0);assert.strictEqual(e.SetVertexDeclaration(d,decl),0);
  assert.strictEqual(e.SetFVF(d,0),0,'zero FVF does not replace a recorded declaration');
  assert.strictEqual(read(decl+20),1,'recorded declaration keeps only one reference');
  assert.strictEqual(e.GetVertexDeclaration(d,out),0);assert.strictEqual(read(out),0);
  assert.strictEqual(e.GetFVF(d,out),0);assert.strictEqual(read(out),0x4002,'recording does not clear live FVF');
  assert.strictEqual(e.EndStateBlock(d,out),0);const db=read(out);
  assert.strictEqual(e.releaseTexture(decl),0); // common resource Release helper
  assert.strictEqual(e.Apply(db),0);assert.strictEqual(read(decl+20),2);
  assert.strictEqual(e.SetFVF(d,0),0);
  assert.strictEqual(e.get_esp()>>>0,0x074ff00c,'zero FVF retains stdcall cleanup');
  assert.strictEqual(read(decl+20),2,'zero FVF preserves declaration lifetime');
  assert.strictEqual(e.GetVertexDeclaration(d,out),0);assert.strictEqual(read(out),decl,'zero FVF preserves live declaration');
  e.releaseTexture(decl); // balance GetVertexDeclaration AddRef
  assert.strictEqual(e.GetFVF(d,out),0);assert.strictEqual(read(out),0);
  assert.strictEqual(e.SetFVF(d,0x4002),0);assert.strictEqual(e.Capture(db),0);
  assert.strictEqual(e.SetFVF(d,0x102),0);assert.strictEqual(e.Apply(db),0);
  assert.strictEqual(e.GetFVF(d,out),0);assert.strictEqual(read(out),0x4002,'Capture restores FVF and declaration as one selection');
  assert.strictEqual(e.Release(db),0);
  for(const stage of ['Vertex','Pixel']) {
    const set=e['Set'+stage+'ShaderConstantF'],get=e['Get'+stage+'ShaderConstantF'];
    for(let i=0;i<12;i++)e.guest_write32(elements+i*4,100+i);
    assert.strictEqual(set(d,0,elements,3),0);
    assert.strictEqual(e.BeginStateBlock(d),0);
    for(let i=0;i<8;i++)e.guest_write32(elements+i*4,200+i);
    assert.strictEqual(set(d,1,elements,2),0);
    assert.strictEqual(set(d,2,elements,1),0);
    assert.strictEqual(get(d,1,copy,1),0);assert.strictEqual(read(copy),104);
    assert.strictEqual(e.EndStateBlock(d,out),0);const cb=read(out);
    assert.strictEqual(e.Apply(cb),0);
    assert.strictEqual(get(d,0,copy,3),0);
    assert.strictEqual(read(copy),100,'unrecorded constant register preserved');
    assert.strictEqual(read(copy+16),200);assert.strictEqual(read(copy+32),200,'overlapping final write wins');
    e.guest_write32(elements,300);assert.strictEqual(set(d,1,elements,1),0);
    assert.strictEqual(e.Capture(cb),0);
    e.guest_write32(elements,400);assert.strictEqual(set(d,1,elements,1),0);
    assert.strictEqual(e.Apply(cb),0);assert.strictEqual(get(d,1,copy,1),0);assert.strictEqual(read(copy),300);
    assert.strictEqual(e.Release(cb),0);
    const words=stage==='Vertex'?[0xfffe0101,1,0xc00f0000,0x90e40000,0xffff]:[0xffff0101,1,0x800f0000,0x90e40000,0xffff];
    words.forEach((v,i)=>e.guest_write32(elements+i*4,v));
    assert.strictEqual(e['Create'+stage+'Shader'](d,elements,out),0);const shader=read(out);
    assert.strictEqual(e.BeginStateBlock(d),0);
    assert.strictEqual(e['Set'+stage+'Shader'](d,shader),0);
    assert.strictEqual(e['Set'+stage+'Shader'](d,shader),0);assert.strictEqual(read(shader+20),1);
    assert.strictEqual(e['Get'+stage+'Shader'](d,out),0);assert.strictEqual(read(out),0);
    assert.strictEqual(e.EndStateBlock(d,out),0);const sb=read(out);
    assert.strictEqual(e.releaseTexture(shader),0);
    assert.strictEqual(e.Apply(sb),0);assert.strictEqual(read(shader+20),2);
    assert.strictEqual(e['Get'+stage+'Shader'](d,out),0);assert.strictEqual(read(out),shader);
    assert.strictEqual(e.releaseTexture(shader),0);
    assert.strictEqual(e['Set'+stage+'Shader'](d,0),0);
    assert.strictEqual(e.Capture(sb),0);assert.strictEqual(e.Apply(sb),0);
    assert.strictEqual(e['Get'+stage+'Shader'](d,out),0);assert.strictEqual(read(out),0);
    assert.strictEqual(e.Release(sb),0);
  }
  // SetFVF records as "no declaration, this FVF" (D3D8 SetVertexShader(FVF)
  // inside BeginStateBlock is how MilkDrop builds its blocks).
  assert.strictEqual(e.SetFVF(d,0x102),0);
  assert.strictEqual(e.BeginStateBlock(d),0);
  assert.strictEqual(e.SetFVF(d,0x4002),0,'SetFVF records while a block is open');
  assert.strictEqual(e.SetFVF(d,0),0,'zero FVF does not replace a recorded FVF');
  assert.strictEqual(e.GetFVF(d,out),0);assert.strictEqual(read(out),0x102,'recording SetFVF leaves live FVF');
  assert.strictEqual(e.EndStateBlock(d,out),0);const fb=read(out);
  assert.strictEqual(e.Apply(fb),0);
  assert.strictEqual(e.GetFVF(d,out),0);assert.strictEqual(read(out),0x4002,'Apply restores the recorded FVF');
  assert.strictEqual(e.Release(fb),0);
  // Actual handlers emit copied scalar bits. Later source writes and Apply
  // cannot alter previous provenance, and recording never masquerades as live.
  identity.forEach((v,i)=>e.guest_write32(mat+4*i,v));
  e.guest_write32(mat,0x40000000);assert.strictEqual(e.SetTransform(d,256,mat),0);
  const retained=provenance.worldTraceHistory.get(d).at(-1),serialized=JSON.stringify(retained);
  e.guest_write32(mat,0x40400000);assert.strictEqual(e.MultiplyTransform(d,256,mat),0);
  assert.strictEqual(e.GetTransform(d,256,copy),0);const multipliedWord=read(copy);
  assert.strictEqual(provenance.worldTraceHistory.get(d).at(-1).sourceBits[0],0x40400000);
  assert.strictEqual(provenance.worldTraceHistory.get(d).at(-1).destinationBits[0],multipliedWord,'trace matches actual API state');
  assert.strictEqual(e.BeginStateBlock(d),0);assert.strictEqual(e.SetTransform(d,256,mat),0);
  assert.strictEqual(e.GetTransform(d,256,copy),0);assert.strictEqual(read(copy),multipliedWord);
  assert.strictEqual(e.EndStateBlock(d,out),0);const worldBlock=read(out);
  e.guest_write32(mat,0x40800000);assert.strictEqual(e.Apply(worldBlock),0);
  assert.strictEqual(e.GetTransform(d,256,copy),0);assert.strictEqual(read(copy),0x40400000);
  assert.strictEqual(e.Capture(worldBlock),0);assert.strictEqual(e.Release(worldBlock),0);
  assert.strictEqual(JSON.stringify(retained),serialized,'later guest and stateblock writes preserve copied provenance');
  assert.strictEqual(retained.sourceBits[0],0x40000000);assert.strictEqual(retained.destinationBits[0],0x40000000);
  assert(Object.isFrozen(retained)&&Object.isFrozen(retained.sourceBits));
  for(const op of[1,2,3,4,5,6,7,8,9,10])assert(provenance.worldTraceHistory.get(d).some(r=>r.operation===op),'WORLD route '+op);
  for(let i=0;i<24;i++)assert.strictEqual(e.SetTransform(d,256,mat),0);
  assert.strictEqual(provenance.worldTraceHistory.get(d).length,32,'history bounded');
  const liveWriter=provenance.worldLiveWriters.get(d);
  assert.strictEqual(e.BeginStateBlock(d),0);
  for(let i=0;i<40;i++)assert.strictEqual(e.SetTransform(d,256,mat),0);
  assert.strictEqual(provenance.worldLiveWriters.get(d),liveWriter,'recorded writes cannot evict the last live writer');
  assert.strictEqual(e.EndStateBlock(d,out),0);assert.strictEqual(e.Release(read(out)),0);
  assert.strictEqual(provenance.worldTracePackets.size,0);assert.strictEqual(provenance.worldTraceErrors,0);
  // MultiplyTransform currently ignores its source. Diagnostics must not fault
  // it in or write the quiet-miss sentinel, even when the pointer is unmapped.
  const reserved=0xf0000000;assert.strictEqual(e.traceProbe(reserved),0);
  for(const enabled of [false,true]){
    traceEnabled=enabled;e.traceMissingSetup();
    const errors=provenance.worldTraceErrors||0;
    assert.strictEqual(e.MultiplyTransform(d,256,reserved),0);
    assert.strictEqual(e.traceMissingFinish()>>>0,0x12345678,'passive trace must preserve unread unmapped source/sentinel, enabled='+enabled);
    assert.strictEqual(provenance.worldTraceErrors,errors+(enabled?2:0),'unavailable source is explicit only when enabled');
  }
  console.log('PASS D3D9 selective state recording, last-write wins, Capture/Apply and lifetime');
})().catch(error=>{console.error(error);process.exitCode=1;});
