'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const {bootRenderHarness}=require('./render-helper');
const apis=require('../src/api_table.json');
const {interfaces}=require('../tools/d3dim-methods');
const methods=['Release','Lock','ProcessVertices','GetVertexBufferDesc'];
const source=fs.readFileSync(path.join(__dirname,'../src/09aa-handlers-d3dim.wat'),'utf8');
for(const method of methods){
  const name=`IDirect3DVertexBuffer7_${method}`;
  assert.strictEqual(apis.find(a=>a.name===name).handler,`IDirect3DVertexBuffer_${method}`);
  assert.strictEqual(interfaces.find(i=>i.prefix==='IDirect3DVertexBuffer7').methods.find(m=>m.name===method).handler,
    `IDirect3DVertexBuffer_${method}`,'generator spec matches dispatch alias');
  assert(!source.includes(`(func $handle_${name} `));
}
const extraWat=String.raw`
  (func (export "vb_create") (param $version i32) (param $desc i32) (param $out i32)
    (call $d3dim_create_vb (local.get $desc) (local.get $out)
      (select (global.get $DX_VTBL_D3DVB7) (global.get $DX_VTBL_D3DVB) (local.get $version))))
  (func (export "vb_entry") (param $obj i32) (result i32) (call $dx_from_this (local.get $obj)))
  (func (export "vb_pack") (param $fvf i32) (param $src i32) (param $count i32) (result i32)
    (call $d3dim_pack_fvf_vertices (local.get $fvf) (local.get $src) (local.get $count) (i32.const 0)))
  (func (export "vb_unpack") (param $fvf i32) (param $src i32) (param $dst i32)
    (call $d3dim_unpack_tl_vertex (local.get $fvf) (call $g2w (local.get $src)) (call $g2w (local.get $dst))))
  (func (export "vb_copy_texcoords") (param $fvf i32) (param $src i32) (param $dst i32)
    (call $d3dim_vb_copy_texcoords (local.get $fvf) (call $g2w (local.get $src))
      (local.get $fvf) (call $g2w (local.get $dst)) (i32.const 0)))
  (func (export "vb_call") (param $id i32) (param $obj i32) (param $a i32)
      (param $b i32) (param $c i32) (param $stack i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $dispatch_api_table (local.get $id) (local.get $obj) (local.get $a)
      (local.get $b) (local.get $c) (i32.const 0) (i32.const 0))
    (i32.load (global.get $reg_base)))
`;
(async()=>{
  const {exports:e,memory}=await bootRenderHarness({fonts:'none',extraWat});
  e.init_dx_com_thunks();
  const v=new DataView(memory.buffer), stack=e.guest_alloc(64),desc=e.guest_alloc(32),out=e.guest_alloc(40);
  [16,0,2,4].forEach((x,i)=>e.guest_write32(desc+i*4,x));
  const base=0x36000000,sparse=base+4094,neighbor=base+0x10000;
  for(const page of [base,neighbor,base+4096])e.test_virtual_map_commit(page,4096);
  assert.notStrictEqual(e.guest_to_wasm(base+4096),e.guest_to_wasm(base)+4096);
  for(let i=0;i<64;i++)e.guest_write8(neighbor+i,0xa7);
  for(const [version,prefix] of [[0,'IDirect3DVertexBuffer'],[1,'IDirect3DVertexBuffer7']]){
    e.vb_create(version,desc,out);
    let obj=e.guest_read32(out);
    const entry=e.vb_entry(obj);
    assert(obj);assert.strictEqual(v.getUint32(entry,true),22);
    const call=(method,pop,a=0,b=0,c=0)=>{
      e.guest_write32(stack+pop,0xdeadbeef);
      const r=e.vb_call(apis.find(x=>x.name===`${prefix}_${method}`).id,obj,a,b,c,stack)>>>0;
      assert.strictEqual(e.get_esp()>>>0,stack+pop);
      assert.strictEqual(e.guest_read32(stack+pop)>>>0,0xdeadbeef);
      return r;
    };
    assert.strictEqual(call('Lock',20,0,out,out+4),0);
    const backing=e.guest_read32(out);assert(backing);
    assert.strictEqual(e.guest_read32(out+4),48);
    e.guest_write32(backing,0x12345678);
    e.guest_write32(out,16); e.guest_write32(out+16,0xcafebabe);
    assert.strictEqual(call('GetVertexBufferDesc',12,out),0);
    assert.deepStrictEqual([0,4,8,12].map(i=>e.guest_read32(out+i)),[16,0,2,4]);
    assert.strictEqual(e.guest_read32(out+16)>>>0,0xcafebabe);
    const sparseDesc=(size,words)=>{
      for(let i=-4;i<size+4;i++)e.guest_write8(sparse+i,0xcc);
      e.guest_write32(sparse,size);
      assert.strictEqual(call('GetVertexBufferDesc',12,sparse),0);
      assert.deepStrictEqual(Array.from({length:size/4},(_,i)=>e.guest_read32(sparse+i*4)),words);
      for(let i=1;i<=4;i++)assert.strictEqual(e.guest_read8(sparse-i),0xcc);
      for(let i=0;i<4;i++)assert.strictEqual(e.guest_read8(sparse+size+i),0xcc);
      for(let i=0;i<64;i++)assert.strictEqual(e.guest_read8(neighbor+i),0xa7,'adjacent backing belongs to another guest page');
    };
    sparseDesc(16,[16,0,2,4]);
    sparseDesc(32,[32,0,2,4,0,0,0,0]);
    assert.strictEqual(call('AddRef',8),2);
    assert.strictEqual(call('Release',8),1);
    assert.strictEqual(v.getUint32(entry,true),22);
    assert.strictEqual(e.guest_read32(backing)>>>0,0x12345678);
    assert.strictEqual(call('Release',8),0);
    assert.strictEqual(v.getUint32(entry,true),0);
    // Preserve the existing no-input-descriptor path while checking its fill.
    e.vb_create(version,0,out);obj=e.guest_read32(out);assert(obj);
    sparseDesc(16,[16,0,0,0]);
    sparseDesc(32,[32,0,0,0,0,0,0,0]);
    assert.strictEqual(call('Release',8),0);
  }
  console.log('PASS D3DIM VB/VB7 alias dispatch, lock/descriptor outputs, lifetime and stack guards');
  // AoWII requests D3DFVF_LVERTEX (0x1e2), then writes 160 32-byte
  // vertices. Omitting RESERVED1 allocated 4480 bytes and corrupted the
  // next Miles audio stream. Exercise real Create/Lock dispatch, not a
  // JavaScript copy of the FVF size calculation.
  for(const version of [3,7]) for(const [fvf,stride] of [[0x1e2,32],[0x1c2,28],[0x1c4,32],[0x112,32]]) {
    const prefix=version===7?'IDirect3DVertexBuffer7':'IDirect3DVertexBuffer';
    const invoke=(name,obj,a,b,c,pop)=>{
      e.guest_write32(stack+pop,0xdeadbeef);
      const r=e.vb_call(apis.find(x=>x.name===name).id,obj,a,b,c,stack)>>>0;
      assert.strictEqual(e.get_esp()>>>0,stack+pop);
      assert.strictEqual(e.guest_read32(stack+pop)>>>0,0xdeadbeef);
      assert.strictEqual(r,0,name);
    };
    [16,0x10800,fvf,160].forEach((x,i)=>e.guest_write32(desc+4*i,x));
    invoke(`IDirect3D${version}_CreateVertexBuffer`,0,desc,out,0,version===3?24:20);
    const obj=e.guest_read32(out)>>>0;assert(obj);
    invoke(`${prefix}_Lock`,obj,0,out,out+4,20);
    const data=e.guest_read32(out)>>>0;
    assert.strictEqual(e.guest_read32(out+4),160*stride,`FVF ${fvf.toString(16)} Lock storage`);
    const neighbor=e.guest_alloc(0x114)>>>0;assert(neighbor);
    for(let i=0;i<0x114;i++)e.guest_write8(neighbor+i,0xa7);
    for(let i=0;i<160*stride;i+=4)e.guest_write32(data+i,0x12345678);
    for(let i=0;i<0x114;i++)assert.strictEqual(e.guest_read8(neighbor+i),0xa7,'neighbor survives full advertised vertex upload');
    if(fvf===0x1e2 || fvf===0x1c2) {
      const reserved=fvf===0x1e2;
      for(let i=0;i<2;i++){
        const words=[0x3f800000+i,0x40000000+i,0x40400000+i];
        if(reserved)words.push(0xdeadbeef);
        words.push(0xff123456+i,0xffabcdef+i,0x3e800000+i,0x3f400000+i);
        words.forEach((x,j)=>e.guest_write32(data+i*stride+j*4,x));
      }
      const packed=e.vb_pack(fvf,data,2)>>>0;assert(packed);
      for(let i=0;i<2;i++)assert.deepStrictEqual(
        Array.from({length:8},(_,j)=>e.guest_read32(packed+i*32+j*4)>>>0),
        [0x3f800000+i,0x40000000+i,0x40400000+i,0,0xff123456+i,0xffabcdef+i,0x3e800000+i,0x3f400000+i],
        'packing preserves second-vertex stride, color and UV offsets');
      const dst=e.guest_alloc(stride+8)>>>0;
      for(let i=0;i<stride+8;i++)e.guest_write8(dst+i,0xcc);
      e.vb_unpack(fvf,packed,dst+4);
      const expected=[0x3f800000,0x40000000,0x40400000];
      if(reserved)expected.push(0);
      const header=expected.concat([0xff123456,0xffabcdef,0xcccccccc,0xcccccccc]);
      assert.deepStrictEqual(header.map((_,j)=>e.guest_read32(dst+4+j*4)>>>0),header,
        'header unpack leaves texture components for the separate dimensional copy');
      e.vb_copy_texcoords(fvf,data,dst+4);
      expected.push(0xff123456,0xffabcdef,0x3e800000,0x3f400000);
      assert.deepStrictEqual(expected.map((_,j)=>e.guest_read32(dst+4+j*4)>>>0),expected,'unpack and dimensional copy write reserved slot and correct colors/UV');
      assert.strictEqual(e.guest_read32(dst)>>>0,0xcccccccc);
      assert.strictEqual(e.guest_read32(dst+stride+4)>>>0,0xcccccccc);
    }
    invoke(`${prefix}_Release`,obj,0,0,0,8);
  }
  console.log('PASS legacy FVF Create/Lock capacity, neighbor integrity, packing and unpacking');
})().catch(error=>{console.error(error);process.exitCode=1;});
