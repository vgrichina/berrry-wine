'use strict';
const assert=require('assert'),{Bridge}=require('../lib/d3d9-host');
// Explicit transformed fixture, never a shared compiler monkeypatch or a
// canonical render artifact. The negative control must fail the OOM assertion.
const {compileSrcWasm}=require('./compile-src');
const inject=!process.argv.includes('--without-allocation-injection');
const {bootRenderHarness}=require('./render-helper');
(async()=>{
 let bridge;
 const names=['CreateStateBlock','BeginStateBlock','EndStateBlock','Reset','Release','SetRenderState','GetRenderState','SetFVF','GetFVF','SetMaterial','GetMaterial','SetLight','GetLight','LightEnable','GetLightEnable','SetTransform','GetTransform','SetSamplerState','GetSamplerState','SetTextureStageState','GetTextureStageState','SetTexture','GetTexture','SetIndices','GetIndices','SetViewport','GetViewport','SetScissorRect','GetScissorRect'];
 for(const stage of ['Vertex','Pixel'])for(const type of ['F','I','B'])for(const op of ['Set','Get'])names.push(op+stage+'ShaderConstant'+type);
 const extraWat=`
 (global $test_fail (mut i32) (i32.const -1))
 (global $test_live (mut i32) (i32.const 0))
 (global $test_attempts (mut i32) (i32.const 0))
 (global $test_failures (mut i32) (i32.const 0))
 (global $test_failed_size (mut i32) (i32.const 0))
 (func (export "fail") (param $n i32) (global.set $test_fail (local.get $n)) (global.set $test_live (i32.const 0))
   (global.set $test_attempts (i32.const 0)) (global.set $test_failures (i32.const 0)) (global.set $test_failed_size (i32.const 0)))
 (func (export "live") (result i32) (global.get $test_live))
 (func (export "attempts") (result i32) (global.get $test_attempts))
 (func (export "failures") (result i32) (global.get $test_failures))
 (func (export "failed_size") (result i32) (global.get $test_failed_size))
 (func $test_alloc (param $n i32) (result i32) (local $p i32)
   (global.set $test_attempts (i32.add (global.get $test_attempts) (i32.const 1)))
   (if (i32.eqz (global.get $test_fail)) (then
     (global.set $test_failures (i32.add (global.get $test_failures) (i32.const 1)))
     (global.set $test_failed_size (local.get $n)) (return (i32.const 0))))
   (local.set $p (call $heap_alloc (local.get $n)))
   (if (i32.gt_s (global.get $test_fail) (i32.const 0)) (then
     (global.set $test_fail (i32.sub (global.get $test_fail) (i32.const 1)))
     (if (local.get $p) (then (global.set $test_live (i32.add (global.get $test_live) (i32.const 1)))))))
   (local.get $p))
 (func $test_free (param $p i32)
   (if (i32.and (i32.ge_s (global.get $test_fail) (i32.const 0)) (i32.ne (local.get $p) (i32.const 0))) (then
     (global.set $test_live (i32.sub (global.get $test_live) (i32.const 1)))))
   (call $heap_free (local.get $p)))
 (func (export "refs") (param $d i32) (result i32) (load.field DxObject refcount (call $dx_from_this (local.get $d))))
 (func (export "texture") (param $d i32) (param $out i32) (result i32)
   (call $d3d9_texture_create (local.get $d) (i32.const 2) (i32.const 2) (i32.const 1) (i32.const 0) (i32.const 21) (i32.const 1) (local.get $out)) (i32.load offset=0 (global.get $reg_base)))
 (func (export "releaseResource") (param $r i32) (result i32)
   (call $handle_IDirect3DShader9_Release (local.get $r) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
 (func (export "state") (param $d i32) (result i32) (call $d3d9_program_state (local.get $d)))
 (func (export "device") (param $pp i32) (param $out i32) (result i32)
   (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
   (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)) (local.get $pp))
   (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)) (local.get $out))
   (call $handle_IDirect3D9_CreateDevice (i32.const 0) (i32.const 0) (i32.const 1) (i32.const 1) (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
 ${[...names.map(n=>['Device9',n]),...['Apply','Capture','Release'].map(n=>['StateBlock9',n])].map(([t,n])=>`
 (func (export "${t}_${n}") (param $a i32) (param $b i32) (param $c i32) (param $d i32) (result i32)
   (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
   (call $handle_${require('../src/api_table.json').find(a=>a.name===`IDirect3D${t}_${n}`).handler||`IDirect3D${t}_${n}`} (local.get $a) (local.get $b) (local.get $c) (local.get $d) (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))`).join('\n')}`;
 assert(process.env.WINE_RENDER_ARTIFACT===undefined&&process.env.WINE_RENDER_ARTIFACT_PREPARE===undefined,
  'transformed fixture cannot prepare or consume a canonical render artifact');
 let resources=0,exports=0;
 const wasm=compileSrcWasm((file,source)=>{
  if(file==='09ae-d3d9-resources.wat'){
   resources++;
   assert.strictEqual(source.split('(call $heap_alloc ').length-1,7,'resource allocation transform sites');
   assert.strictEqual(source.split('(call $heap_free ').length-1,4,'resource free transform sites');
   if(inject)return source.replaceAll('(call $heap_alloc ','(call $test_alloc ').replaceAll('(call $heap_free ','(call $test_free ');
  }
  if(file==='13-exports.wat'){exports++;return source+'\n'+extraWat;}
  return source;
 });
 assert.strictEqual(resources,1);assert.strictEqual(exports,1);
 const {exports:e,memory}=await bootRenderHarness({fonts:'none',extraHostOverrides:{gpu_gl_call:(...args)=>bridge.call(...args)},
  prebuiltModule:new WebAssembly.Module(wasm)});
 e.d3dim_worker_init(0x400000);e.init_dx_com_thunks();
 const alloc=n=>e.guest_alloc(n)>>>0,wa=p=>e.guest_to_wasm(p)>>>0,read=p=>e.guest_read32(p)>>>0;
 bridge=new Bridge({backend:'software',enableProgrammable:true,getExports:()=>e,getMemory:()=>memory.buffer,guestToWasm:wa});
 const pp=alloc(64),out=alloc(8),input=alloc(4096),output=alloc(4104),invalid=0x8876086c;
 const bytes=(p,n)=>new Uint8Array(memory.buffer,wa(p),n),words=(p,n)=>new Uint32Array(memory.buffer,wa(p),n);
 const parameters=()=>{bytes(pp,64).fill(0);words(pp,9).set([8,8,21,1,0,0,1,1,1]);e.guest_write32(pp+52,0x80000000);};
 const ok=v=>assert.strictEqual(v>>>0,0,bridge.lastError||'HRESULT');
 const call=(d,n,...args)=>e['Device9_'+n](d,...args)>>>0;
 parameters();ok(e.device(pp,out));const d=read(out);parameters();ok(e.device(pp,out));const other=read(out);
 let cases=0;

 const rs=id=>{ok(call(d,'GetRenderState',id,output));return read(output);};
 for(const type of [1,2,3]){
  ok(call(d,'SetRenderState',22,2));ok(call(d,'SetRenderState',14,1));
  words(input,1024).fill(0x3f000000);ok(call(d,'SetVertexShaderConstantF',0,input,256));ok(call(d,'SetPixelShaderConstantF',0,input,8));
  ok(call(d,'CreateStateBlock',type,out));const block=read(out);assert(block);
  ok(call(d,'SetRenderState',22,1));ok(call(d,'SetRenderState',14,0));
  words(input,1024).fill(0x3f800000);ok(call(d,'SetVertexShaderConstantF',0,input,256));ok(call(d,'SetPixelShaderConstantF',0,input,8));
  ok(e.StateBlock9_Apply(block));
  assert.strictEqual(rs(22),type===2?1:2,'cull vertex membership');assert.strictEqual(rs(14),type===3?0:1,'zwrite pixel membership');
  ok(call(d,'GetVertexShaderConstantF',255,output,1));assert.strictEqual(read(output),type===2?0x3f800000:0x3f000000);
  ok(call(d,'GetPixelShaderConstantF',7,output,1));assert.strictEqual(read(output),type===3?0x3f800000:0x3f000000);
  ok(e.StateBlock9_Release(block));cases+=4;
 }
 // Detailed-table policy: shared material-source/local-viewer states really
 // belong to both. Enum summary disagrees; absent fog/normal entries stay ALL.
 // https://learn.microsoft.com/en-us/windows/win32/direct3d9/saving-vertex-states-with-a-stateblock
 // https://learn.microsoft.com/en-us/windows/win32/direct3d9/saving-pixel-states-with-a-stateblock
 for(const type of[1,2,3]){
  const baseline=e.refs(d);
  for(const id of[142,145,28,143])ok(call(d,'SetRenderState',id,1));
  ok(call(d,'SetSamplerState',5,1,3));ok(call(d,'SetSamplerState',5,13,0)); // only supported DMAPOFFSET
  ok(call(d,'SetTextureStageState',7,11,3));ok(call(d,'SetTextureStageState',7,1,2));ok(call(d,'SetTextureStageState',7,32,123));
  for(const stage of['Vertex','Pixel'])for(const kind of['I','B']){
   words(input,64).fill(123);ok(call(d,'Set'+stage+'ShaderConstant'+kind,0,input,16));
  }
  ok(call(d,'CreateStateBlock',type,out));const block=read(out);assert.strictEqual(e.refs(d),baseline+1);
  assert.strictEqual(bytes(block+22109,1)[0],type===2?0:1,'DMAPOFFSET membership, invariant value zero');
  for(const id of[142,145,28,143])ok(call(d,'SetRenderState',id,0));
  ok(call(d,'SetSamplerState',5,1,1));ok(call(d,'SetSamplerState',5,13,0));
  ok(call(d,'SetTextureStageState',7,11,0));ok(call(d,'SetTextureStageState',7,1,1));ok(call(d,'SetTextureStageState',7,32,0));
  for(const stage of['Vertex','Pixel'])for(const kind of['I','B']){
   words(input,64).fill(456);ok(call(d,'Set'+stage+'ShaderConstant'+kind,0,input,16));
  }
  ok(e.StateBlock9_Apply(block));
  for(const id of[142,145])assert.strictEqual(rs(id),1);
  for(const id of[28,143])assert.strictEqual(rs(id),type===1?1:0);
  ok(call(d,'GetSamplerState',5,1,output));assert.strictEqual(read(output),type===3?1:3);
  ok(call(d,'GetSamplerState',5,13,output));assert.strictEqual(read(output),0);
  for(const [field,expected]of[[11,3],[1,type===3?1:2],[32,type===1?123:0]]){
   ok(call(d,'GetTextureStageState',7,field,output));assert.strictEqual(read(output),expected);
  }
  for(const stage of['Vertex','Pixel'])for(const kind of['I','B']){
   ok(call(d,'Get'+stage+'ShaderConstant'+kind,15,output,1));
   assert.strictEqual(read(output),(stage==='Vertex'?type!==2:type!==3)?123:456);
  }
  ok(e.StateBlock9_Capture(block));ok(e.StateBlock9_Release(block));assert.strictEqual(e.refs(d),baseline);cases+=13;
 }
 // ALL-only material/matrices/texture references and vertex-only declaration.
 ok(e.texture(d,out));const texture=read(out);
 for(const type of[1,2,3]){
  bytes(input,104).fill(0);new Float32Array(memory.buffer,wa(input),17).fill(.25);ok(call(d,'SetMaterial',input));
  new Float32Array(memory.buffer,wa(input),16).fill(.5);ok(call(d,'SetTransform',256,input));
  ok(call(d,'SetFVF',0x42));ok(call(d,'SetTexture',5,texture));
  ok(call(d,'CreateStateBlock',type,out));const block=read(out);
  assert.strictEqual(read(texture+20),type===1?2:1);
  bytes(input,104).fill(0);ok(call(d,'SetMaterial',input));ok(call(d,'SetTransform',256,input));
  ok(call(d,'SetFVF',2));ok(call(d,'SetTexture',5,0));ok(e.StateBlock9_Apply(block));
  ok(call(d,'GetMaterial',output));assert.strictEqual(read(output),type===1?0x3e800000:0);
  ok(call(d,'GetTransform',256,output));assert.strictEqual(read(output),type===1?0x3f000000:0);
  ok(call(d,'GetFVF',output));assert.strictEqual(read(output),type===2?2:0x42);
  assert.strictEqual(read(texture+20),type===1?2:0);
  ok(e.StateBlock9_Release(block));ok(call(d,'SetTexture',5,0));assert.strictEqual(read(texture+20),0);cases+=4;
 }
 ok(e.releaseResource(texture));
 // Rectangle values are ALL-only even though the enable is pixel state.
 for(const type of[1,2,3]){
  words(input,6).set([1,1,4,4,0,0x3f800000]);ok(call(d,'SetViewport',input));
  words(input,4).set([1,1,5,5]);ok(call(d,'SetScissorRect',input));
  ok(call(d,'CreateStateBlock',type,out));const block=read(out);
  words(input,6).set([0,0,8,8,0,0x3f800000]);ok(call(d,'SetViewport',input));
  words(input,4).set([0,0,8,8]);ok(call(d,'SetScissorRect',input));
  ok(e.StateBlock9_Apply(block));ok(call(d,'GetViewport',output));
  assert.deepStrictEqual(Array.from(words(output,4)),type===1?[1,1,4,4]:[0,0,8,8]);
  ok(call(d,'GetScissorRect',output));assert.deepStrictEqual(Array.from(words(output,4)),type===1?[1,1,5,5]:[0,0,8,8]);
  ok(e.StateBlock9_Release(block));cases+=2;
 }
 // Light membership freezes at creation; Capture never discovers later lights.
 const light=(index,enabled)=>{bytes(input,104).fill(0);words(input,1)[0]=3;ok(call(d,'SetLight',index,input));ok(call(d,'LightEnable',index,enabled));};
 light(100,1);light(200,1);
 ok(call(d,'CreateStateBlock',3,out));const lights=read(out);light(300,1);
 ok(call(d,'LightEnable',100,0));ok(e.StateBlock9_Capture(lights));
 ok(call(d,'LightEnable',100,1));ok(call(d,'LightEnable',300,0));ok(e.StateBlock9_Apply(lights));
 ok(call(d,'GetLightEnable',100,output));assert.strictEqual(read(output),0);
 ok(call(d,'GetLightEnable',300,output));assert.strictEqual(read(output),0);
 ok(e.StateBlock9_Release(lights));cases+=2;
 // Block plus three light-node allocation failures are atomic and reclaim all.
 const ref=e.refs(d),state=e.state(d),saved=bytes(state,25244).slice();
 for(const fail of[0,1,2,3]){
  e.fail(fail);words(out,1)[0]=0xdeadbeef;
  const result=call(d,'CreateStateBlock',1,out);
  console.log(`allocation injection=${inject} fail=${fail} attempts=${e.attempts()} failures=${e.failures()} failedSize=${e.failed_size()} HRESULT=${result.toString(16)}`);
  assert.strictEqual(result,0x8007000e,'injected CreateStateBlock must return E_OUTOFMEMORY');assert.strictEqual(read(out),0);
  assert.strictEqual(e.attempts(),fail+1,'reached the selected block/light allocation');
  assert.strictEqual(e.failures(),1,'exactly one allocation rejected');
  assert.strictEqual(e.failed_size(),fail===0?25892:120,'block then three light-node fail points');
  assert.strictEqual(e.live(),0,'unpublished allocations reclaimed');assert.strictEqual(e.refs(d),ref);
  assert.deepStrictEqual(bytes(state,25244),saved,'failed creation does not change device state');
  e.fail(-1);ok(call(d,'CreateStateBlock',1,out));ok(e.StateBlock9_Release(read(out)));cases++;
 }
 for(const type of[0,4,0xffffffff]){words(out,1)[0]=123;assert.strictEqual(call(d,'CreateStateBlock',type,out),invalid);assert.strictEqual(read(out),0);cases++;}
 for(const target of[0,0xfffffffe])assert.strictEqual(call(d,'CreateStateBlock',1,target),invalid);
 ok(call(d,'BeginStateBlock'));const recording=read(state+1740);
 assert.strictEqual(call(d,'CreateStateBlock',1,out),invalid);assert.strictEqual(read(state+1740),recording);
 ok(call(d,'EndStateBlock',out));ok(e.StateBlock9_Release(read(out)));cases+=3;
 ok(call(d,'Release'));ok(call(other,'Release'));for(const p of[pp,out,input,output])e.guest_free(p);
 console.log('PASS typed CreateStateBlock '+cases+' cases');
})().catch(error=>{console.error(error);process.exitCode=1;});
