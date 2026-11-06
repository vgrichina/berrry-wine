#!/usr/bin/env node

'use strict';

// IDirect3DDevice3::DrawPrimitiveVB and ::DrawIndexedPrimitiveVB must draw.
//
// Both were silent-success stubs: they stored S_OK, popped the right number of
// bytes, and rasterized nothing. That shape is invisible to every check we
// have except a picture -- the guest sees a healthy HRESULT, no API is
// unimplemented, no trap fires, and the stack stays balanced -- so the only
// symptom is geometry that never appears.
//
// Diablo II is the app that shows it. Its Direct3D backend batches floor tiles
// through d2direct3d+0x6457 (vtable slot 35, a TRIANGLELIST of 150 indices
// over a vertex buffer it Locks) while sprites and the HUD go through
// DrawPrimitive, which was implemented. So units, text and interface drew
// normally and the ground stayed black -- which reads convincingly as a
// texture or palette bug rather than as a draw call that was thrown away.
//
// An earlier fix (fb397db1) corrected only the *pop arity* of the indexed
// entry: the v3 signature is (primType, lpVB, lpwIndices, dwIndexCount,
// dwFlags), six dwords with `this`, and it had been given the v7 count of
// eight. That stopped the crash and left the empty body behind, so this test
// asserts both halves -- the frame size AND that pixels changed.
//
// The v3 indexed form has no dwStartVertex/dwNumVertices, so the whole buffer is in
// play; the core clamps the vertex count down to the buffer's real capacity.
// The indexed wrapper uses an internal capacity sentinel, which this historical
// excerpt checks. --public-ranges adds full-module public COM pixel coverage.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "test_v3vb_seed")
      (param $ddraw_vtbl i32) (param $surface_vtbl i32)
      (param $device_vtbl i32) (param $vb_vtbl i32)
    (global.set $DX_VTBL_DDRAW (local.get $ddraw_vtbl))
    (global.set $DX_VTBL_DDSURF2 (local.get $surface_vtbl))
    (global.set $DX_VTBL_D3DDEV3 (local.get $device_vtbl))
    (global.set $DX_VTBL_D3DVB (local.get $vb_vtbl)))

  (func (export "test_v3vb_create_surface") (param $desc i32) (param $out i32) (result i32)
    (local $ddraw i32)
    (local.set $ddraw (call $dx_create_com_obj (i32.const 1) (global.get $DX_VTBL_DDRAW)))
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $handle_IDirectDraw_CreateSurface
      (local.get $ddraw) (local.get $desc) (local.get $out) (i32.const 0)
      (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))

  (func (export "test_v3vb_create_device") (param $surface i32) (param $out i32) (result i32)
    (call $d3dim_create_device
      (i32.const 0) (local.get $surface) (local.get $out) (global.get $DX_VTBL_D3DDEV3))
    (i32.load offset=0 (global.get $reg_base)))

  (func (export "test_v3vb_viewport") (param $device i32) (param $desc i32) (result i32)
    (local $vp i32)
    (local.set $vp (call $dx_create_com_obj (i32.const 23) (i32.const 0x54000000)))
    (i32.store offset=8 (call $dx_from_this (local.get $vp)) (local.get $device))
    (call $d3dim_set_current_viewport (local.get $device) (local.get $vp))
    (call $d3dim_viewport_set (local.get $vp) (local.get $desc))
    (local.get $vp))

  ;; IDirect3D3::CreateVertexBuffer(lpVBDesc, lplpVB, dwFlags, pUnkOuter).
  (func (export "test_v3vb_create") (param $desc i32) (param $out i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $handle_IDirect3D3_CreateVertexBuffer
      (i32.const 0) (local.get $desc) (local.get $out) (i32.const 0)
      (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))

  ;; IDirect3DVertexBuffer::Lock(dwFlags, lplpData, lpdwSize).
  (func (export "test_v3vb_lock") (param $vb i32) (param $ppData i32) (param $pSize i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $handle_IDirect3DVertexBuffer_Lock
      (local.get $vb) (i32.const 0x21) (local.get $ppData) (local.get $pSize)
      (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))

  ;; Both v3 VB draws take five arguments plus this, so the sixth dword --
  ;; dwFlags -- lives at esp+24 and the handler must leave esp 28 higher.
  ;; Returning the new esp is what lets the caller check that arity, which is
  ;; the half of this bug that was already fixed once.
  (func (export "test_v3vb_draw_indexed")
      (param $device i32) (param $primType i32) (param $vb i32)
      (param $indices i32) (param $index_count i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $gs32 (i32.const 0x30018) (i32.const 0))
    (call $handle_IDirect3DDevice3_DrawIndexedPrimitiveVB
      (local.get $device) (local.get $primType) (local.get $vb)
      (local.get $indices) (local.get $index_count) (i32.const 0))
    (i32.load offset=16 (global.get $reg_base)))

  (func (export "test_v3vb_draw")
      (param $device i32) (param $primType i32) (param $vb i32)
      (param $start i32) (param $count i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $gs32 (i32.const 0x30018) (i32.const 0))
    (call $handle_IDirect3DDevice3_DrawPrimitiveVB
      (local.get $device) (local.get $primType) (local.get $vb)
      (local.get $start) (local.get $count) (i32.const 0))
    (i32.load offset=16 (global.get $reg_base)))

  (func (export "test_v3vb_dib") (param $surface i32) (result i32)
    (i32.load offset=20 (call $dx_from_this (local.get $surface))))
`;

const RT = 32;                 // render target edge, in pixels
const FVF_TLVERTEX = 0x1c4;    // XYZRHW | DIFFUSE | SPECULAR | TEX1
const VB_VERTICES = 4;
const TL_STRIDE = 32;

function makeSurface(wat, desc, out, width, height) {
  for (let i = 0; i < 128; i += 4) wat.guest_write32(desc + i, 0);
  wat.guest_write32(desc, 108);
  wat.guest_write32(desc + 4, 0x1007); // CAPS|HEIGHT|WIDTH|PIXELFORMAT
  wat.guest_write32(desc + 8, height);
  wat.guest_write32(desc + 12, width);
  wat.guest_write32(desc + 72, 32);
  wat.guest_write32(desc + 76, 0x40);  // DDPF_RGB
  wat.guest_write32(desc + 84, 16);    // bpp
  wat.guest_write32(desc + 88, 0xf800);
  wat.guest_write32(desc + 92, 0x07e0);
  wat.guest_write32(desc + 96, 0x001f);
  wat.guest_write32(desc + 104, 0x40);
  assert.strictEqual(wat.test_v3vb_create_surface(desc, out) >>> 0, 0);
  return wat.guest_read32(out) >>> 0;
}

function writeFloat(wat, addr, value) {
  const bits = new ArrayBuffer(4);
  new DataView(bits).setFloat32(0, value, true);
  wat.guest_write32(addr, new DataView(bits).getUint32(0, true));
}

if (!process.argv.includes('--public-ranges')) (async () => {
  const h = await bootRenderHarness({ extraWat, width: 640, height: 480 });
  const { exports: wat, memory } = h;
  const mem = new DataView(memory.buffer);

  const desc = 0x410000;
  const out = 0x410100;
  const devOut = 0x410110;
  const vbOut = 0x410120;
  const dataOut = 0x410130;
  const sizeOut = 0x410140;
  const vpDesc = 0x410200;
  const vbDesc = 0x410300;
  const indices = 0x411000;

  wat.test_v3vb_seed(0x51000000, 0x52000000, 0x53000000, 0x55000000);

  const rt = makeSurface(wat, desc, out, RT, RT);
  assert(rt, 'render target was not created');
  assert.strictEqual(wat.test_v3vb_create_device(rt, devOut) >>> 0, 0);
  const device = wat.guest_read32(devOut) >>> 0;
  assert(device, 'device was not created');
  const rtDib = wat.test_v3vb_dib(rt) >>> 0;

  wat.guest_write32(vpDesc, 44); // sizeof(D3DVIEWPORT)
  wat.guest_write32(vpDesc + 4, 0);
  wat.guest_write32(vpDesc + 8, 0);
  wat.guest_write32(vpDesc + 12, RT);
  wat.guest_write32(vpDesc + 16, RT);
  writeFloat(wat, vpDesc + 20, RT / 2);
  writeFloat(wat, vpDesc + 24, RT / 2);
  assert(wat.test_v3vb_viewport(device, vpDesc), 'viewport was not created');

  // D3DVERTEXBUFFERDESC: dwSize, dwCaps, dwFVF, dwNumVertices.
  wat.guest_write32(vbDesc, 16);
  wat.guest_write32(vbDesc + 4, 0);
  wat.guest_write32(vbDesc + 8, FVF_TLVERTEX);
  wat.guest_write32(vbDesc + 12, VB_VERTICES);
  assert.strictEqual(wat.test_v3vb_create(vbDesc, vbOut) >>> 0, 0);
  const vb = wat.guest_read32(vbOut) >>> 0;
  assert(vb, 'vertex buffer was not created');

  assert.strictEqual(wat.test_v3vb_lock(vb, dataOut, sizeOut) >>> 0, 0);
  const vbData = wat.guest_read32(dataOut) >>> 0;
  const vbSize = wat.guest_read32(sizeOut) >>> 0;
  assert(vbData, 'Lock returned no buffer pointer');
  assert.strictEqual(vbSize, VB_VERTICES * TL_STRIDE,
    'buffer size does not match FVF stride x vertex count');

  // Four transformed-and-lit vertices spanning the target, written straight
  // into the locked buffer the way the guest does. rhw must be 1: it is 1/w,
  // and a zero there projects every vertex to the same nonsense coordinate.
  const tlvertex = (i, x, y, color) => {
    const p = vbData + i * TL_STRIDE;
    writeFloat(wat, p + 0, x);
    writeFloat(wat, p + 4, y);
    writeFloat(wat, p + 8, 0.5);
    writeFloat(wat, p + 12, 1.0);
    wat.guest_write32(p + 16, color);
    wat.guest_write32(p + 20, 0);
    writeFloat(wat, p + 24, 0);
    writeFloat(wat, p + 28, 0);
  };
  tlvertex(0, 1, 1, 0xffff0000);
  tlvertex(1, RT - 1, 1, 0xff00ff00);
  tlvertex(2, RT - 1, RT - 1, 0xff0000ff);
  tlvertex(3, 1, RT - 1, 0xffffffff);

  const countDrawn = () => {
    let n = 0;
    for (let i = 0; i < RT * RT; i++) if (mem.getUint16(rtDib + i * 2, true)) n++;
    return n;
  };
  const clearRt = () => {
    for (let i = 0; i < RT * RT; i++) mem.setUint16(rtDib + i * 2, 0, true);
  };

  clearRt();
  assert.strictEqual(countDrawn(), 0, 'render target did not start blank');

  // Indexed: two triangles over the four vertices. dwIndexCount is the fifth
  // argument, and the vertex count is implied -- the core clamps its way to
  // the buffer's capacity from the deliberately over-large value the v3 path
  // hands it.
  // D3D index lists are 16-bit, so pack each pair into one guest dword.
  const indexList = [0, 1, 2, 0, 2, 3];
  for (let i = 0; i < indexList.length; i += 2) {
    wat.guest_write32(indices + (i / 2) * 4,
      (indexList[i] & 0xffff) | ((indexList[i + 1] & 0xffff) << 16));
  }

  const espAfterIndexed = wat.test_v3vb_draw_indexed(device, 4, vb, indices, 6) >>> 0;
  assert.strictEqual(espAfterIndexed - 0x30000, 28,
    'DrawIndexedPrimitiveVB popped the wrong frame: the v3 form is 28, not the v7 36');
  const indexedPixels = countDrawn();
  assert(indexedPixels > 0,
    'DrawIndexedPrimitiveVB drew nothing -- the silent-success stub is back');

  clearRt();
  const espAfterDraw = wat.test_v3vb_draw(device, 4, vb, 0, 3) >>> 0;
  assert.strictEqual(espAfterDraw - 0x30000, 28,
    'DrawPrimitiveVB popped the wrong frame');
  assert(countDrawn() > 0,
    'DrawPrimitiveVB drew nothing -- the silent-success stub is back');

  console.log(`PASS  v3 vertex-buffer draws rasterize (${indexedPixels} px indexed)`);
})();

// --public-ranges uses ordinary x86 COM calls against the two shipped modules.
// Kept separate from the historical excerpt regression above so its arity
// witness remains useful. Expected colors/geometry never use renderer helpers.
async function publicRangeFixture(c) {
  const {mode,negative,evidence,check,eq,read,alloc,words,guard,guid,com,ok,acquire,
    dd,hal,surface,lock,unlock,bits,use,initial,countDraw,queue,rendererInfo}=c;
  const r=evidence.vbRanges={draws:[],pixels:[],held:[],buffers:[]};
  const colors={red:[208,48,32],blue:[32,80,192],poison:[176,32,160],clear:[11,22,33]};
  const argb=rgb=>(0xff000000|rgb[0]<<16|rgb[1]<<8|rgb[2])>>>0;
  // No sample lies on an edge. These triangles occupy different target halves.
  const shapes={left:[[0,0],[4,0],[0,8]],right:[[4,0],[8,0],[8,8]],
    poison:[[-8,-8],[24,-8],[-8,24]]};
  const iid=await guid([0xbb223240,0x11d0e72b,0xaa00b4a9,0x3e99c000]);
  const d3d3=await acquire(out=>com('ranges QI D3D3',dd,0,iid,out));
  const t3={version:3,d3d:d3d3,rt:await surface(8,8,0x2840)};
  const iidSurface4=await guid([0x0b2b8630,0x11d0ad35,0x6000a68e,0x5bea9797]);
  const surface4=await acquire(out=>com('ranges QI Surface4',t3.rt,0,iidSurface4,out));
  t3.device=await acquire(out=>com('ranges CreateDevice3',d3d3,8,hal,surface4,out,0));
  await com('ranges Release Surface4',surface4,2);
  t3.viewport=await acquire(out=>com('ranges CreateViewport3',d3d3,6,out,0));
  const vp=await alloc(44);await words(vp,[44,0,0,8,8,bits(-1),bits(1),bits(2),bits(2),0,bits(1)]);
  await ok(com('ranges AddViewport3',t3.device,5,t3.viewport));
  await ok(com('ranges SetViewport2',t3.viewport,17,vp));
  await ok(com('ranges SetCurrentViewport3',t3.device,12,t3.viewport));
  const t7={...initial,version:7,d3d:evidence.objects.d3d};
  const indices=await alloc(8);
  async function configure(t){
    for(const [id,v] of [[7,0],[14,0],[15,0],[22,1],[27,0],[28,0],[41,0],[137,0]])
      await ok(com('ranges RS'+t.version,t.device,t.version===3?22:20,id,v));
    await ok(com('ranges unbind'+t.version,t.device,t.version===3?38:35,0,0));
  }
  function record(xy,rgb){return [...xy.map(bits),bits(.5),bits(1),argb(rgb),0,0,0];}
  async function makeVB(t,start,indexed,shape,rgb){
    const capacity=15,desc=await guard(16);await words(desc.p,[16,0x800,0x1c4,capacity]);
    const vb=await acquire(out=>com('ranges CreateVB'+t.version,t.d3d,t.version===3?9:5,desc.p,out,0,...(t.version===3?[0]:[])));
    await desc.check();const p=await guard(4),n=await guard(4);
    await ok(com('ranges LockVB',vb,3,0,p.p,n.p));await p.check();await n.check();
    const data=await read(p.p);eq(await read(n.p),capacity*32,'public VB capacity');
    const rows=Array.from({length:capacity},(_,i)=>record(shapes.poison[i%3],colors.poison));
    // Sparse, noncyclic indexing cannot accidentally pass as a triangle reorder.
    const select=indexed?[4,0,2]:[0,1,2];
    select.forEach((j,i)=>{rows[start+j]=record(shapes[shape][i],rgb);});
    await words(data,rows.flat());await ok(com('ranges UnlockVB',vb,4));
    const item={vb,data,capacity,start,count:indexed?5:3,indexed,shape,rgb,select};
    r.buffers.push({...item,version:t.version});return item;
  }
  async function clear(t){const l=await lock(t.rt);
    for(let y=0;y<8;y++)await words(l.pointer+y*l.pitch,Array(8).fill(argb(colors.clear)));
    await unlock(t.rt);}
  async function draw(t,b,label){
    await words(indices,[4,2]); // WORDs 4,0,2; Device3 uses absolute buffer indices.
    if(t.version===3&&b.indexed)await words(indices,[(b.start+4)|b.start<<16,b.start+2]);
    let start=b.start,count=b.count;
    if(negative==='start')start=0;
    if(negative==='capacity'&&!b.indexed)count=b.capacity-start;
    if(negative==='absolute'&&t.version===7&&b.indexed)await words(indices,[(start+4)|start<<16,start+2]);
    await ok(com('ranges BeginScene'+t.version,t.device,t.version===3?9:5));
    if(b.indexed){
      await ok(t.version===3?com('ranges DrawIndexedVB3 '+label,t.device,35,4,b.vb,indices,3,0):
        com('ranges DrawIndexedVB7 '+label,t.device,32,4,b.vb,start,count,indices,3,0));
    }else await ok(com('ranges DrawVB'+t.version+' '+label,t.device,t.version===3?34:31,4,b.vb,start,count,0));
    countDraw();await ok(com('ranges EndScene'+t.version,t.device,t.version===3?10:6));
    r.draws.push({version:t.version,label,vb:b.vb,start,count,indexed:b.indexed});
  }
  // Hand-selected integer pixels strictly inside/outside the authored triangles;
  // both integer and half-integer sampling conventions give identical membership.
  const samples=[[1,1,'left'],[2,1,'left'],[1,3,'left'],[6,1,'right'],[7,2,'right'],
    [7,4,'right'],[3,6,null],[4,4,null],[1,7,null],[5,6,null]];
  async function witness(t,label,drawn){
    use(t);const l=await lock(t.rt),pixels=[];
    for(const [x,y,shape] of samples){const value=await read(l.pointer+y*l.pitch+x*4);
      const actual=[value>>>16&255,value>>>8&255,value&255];
      const expected=drawn.findLast(b=>b.shape===shape)?.rgb||colors.clear;
      pixels.push({x,y,actual,expected});
    }
    const rgba=[];
    for(let y=0;y<8;y++)for(let x=0;x<8;x++){const v=await read(l.pointer+y*l.pitch+x*4);rgba.push(v>>>16&255,v>>>8&255,v&255,255);}
    await unlock(t.rt);r.pixels.push({version:t.version,label,pixels,rgba});
    if(mode!=='software'){
      const tile=document.createElement('figure'),caption=document.createElement('figcaption'),canvas=document.createElement('canvas');
      tile.style.cssText='display:inline-block;margin:8px';caption.textContent='Device'+t.version+' '+label;
      canvas.width=canvas.height=8;canvas.style.cssText='width:128px;height:128px;image-rendering:pixelated';
      canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(rgba),8,8),0,0);
      tile.append(caption,canvas);document.body.append(tile);
    }
    for(const p of pixels)eq(p.actual,p.expected,'VB RANGE PIXEL ORACLE '+label+' '+p.x+','+p.y);
  }
  for(const t of [t3,t7]){
    await configure(t);
    for(const indexed of [false,true]){
      const a=await makeVB(t,3,indexed,'left',colors.red),b=await makeVB(t,8,indexed,'right',colors.blue);
      await clear(t);await draw(t,a,'first');await witness(t,'selected first '+indexed,[a]);
      await clear(t);await draw(t,b,'second');await witness(t,'selected second '+indexed,[b]);
      await clear(t);
      if(mode==='worker'){
        use(t);queue.hold('ranges two buffers '+t.version+' '+indexed);
        await draw(t,a,'held first');const first=await queue.packet();
        const before=queue.snapshot();await draw(t,b,'held second');const after=queue.snapshot();
        // Small subsequent draws remain producer-buffered until the held
        // submission completes. Do not equate enqueue with immediate posting.
        eq(queue.pendingPackets(),1,'one submitted draw plus producer-buffered successor');
        eq(after.submitted,before.submitted,'successor not submitted ahead of held draw');
        const slot=after.buffers.findIndex((s,i)=>s.header[1]===t.device&&s.firstVertex[4]===argb(b.rgb)&&
          s.firstVertex[0]===bits(4)&&JSON.stringify(s)!==JSON.stringify(before.buffers[i]));
        check(slot>=0,'changed producer slot owns second range and color');
        const second=queue.buffers()[slot];
        eq(new DataView(first.vertices.buffer,first.vertices.byteOffset).getUint32(16,true),argb(a.rgb),
          'first queued draw keeps its independent color');
        check(queue.completed()<first.sequence,'both draws remain pending');
        r.held.push({version:t.version,indexed,first:first.sequence,producerSlot:slot,before,after});
        // Public lock/rewrite/unlock proves pending packets own the selected bytes.
        for(const item of [a,b]){const p=await guard(4),n=await guard(4);
          await ok(com('ranges reuse LockVB',item.vb,3,0,p.p,n.p));await p.check();await n.check();
          eq(await read(p.p),item.data,'public reuse pointer');
          await words(item.data,Array(item.capacity*8).fill(0));await ok(com('ranges reuse UnlockVB',item.vb,4));}
        await words(indices,[0,0]);
        if(negative==='queued')second.vertices.fill(0);
        queue.drain();
      }else{await draw(t,a,'paired first');await draw(t,b,'paired second');}
      await witness(t,'two buffers retained '+indexed,[a,b]);
      for(const item of [a,b])await com('ranges ReleaseVB',item.vb,2);
    }
  }
  if(mode==='webgl')evidence.glRenderer=rendererInfo();
  use(initial);
  for(const obj of [t3.device,t3.viewport,t3.rt,d3d3])await com('ranges Release object',obj,2);
}

async function runPublicRanges(){
  const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm'),cp=require('node:child_process');
  const base=require('./test-legacy-texture-rendered-contract'),ROOT=path.resolve(__dirname,'..');
  const dir=process.env.LEGACY_VB_RANGE_EVIDENCE;assert(dir,'LEGACY_VB_RANGE_EVIDENCE required');fs.mkdirSync(dir,{recursive:true});
  const deadline=Date.parse(process.env.LEGACY_VB_RANGE_HARD_CLOSE);assert(Number.isFinite(deadline),'fixed hard close required');
  const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
  let source=base.browserFixture.toString();
  const replace=(a,b)=>{assert.equal(source.split(a).length,2,'unique range fixture seam '+a);source=source.replace(a,b);};
  replace("const module=await WebAssembly.compile(await (await fetch('/legacy-render.wasm')).arrayBuffer());",`
  const moduleBytes=await (await fetch('/legacy-render.wasm')).arrayBuffer();
  const moduleSHA=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',moduleBytes))).map(v=>v.toString(16).padStart(2,'0')).join('');
  eq(moduleSHA,config.moduleSHA,'actual fetched module identity before compile');
  evidence.compiledModule={sha256:moduleSHA,bytes:moduleBytes.byteLength,reusedForCPUAndRenderWorkers:mode==='worker'};
  const module=await WebAssembly.compile(moduleBytes);`);
  replace("if(mode==='webgl')gpu=new D3DIMGpu.D3DIMGpu({getExports:","if(mode==='webgl')gpu=new D3DIMGpu.D3DIMGpu({webglVersion:config.webglVersion,getExports:");
  replace('port=manager.createEndpoint(options);','port=manager.createEndpoint({...options,webglVersion:config.webglVersion});');
  replace('snapshot:transportSnapshot,pendingPackets:',`buffers:()=>queueBuffers.map(buffer=>({
    vertices:new Uint8Array(buffer,32+4096,new DataView(buffer).getUint32(24,true))})),
    snapshot:transportSnapshot,pendingPackets:`);
  const fixture=Function('return ('+source+')')();
  const state={status:'PREPARING',startedAt:new Date().toISOString(),source:cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),modules:{},cells:[],negatives:[]};
  state.productionFiles=Object.fromEntries(['test/test-d3dim-v3-vertex-buffer-draw.js','test/test-legacy-texture-rendered-contract.js',
    ...fs.readdirSync(path.join(ROOT,'lib')).filter(n=>/\.(js|json)$/.test(n)).map(n=>'lib/'+n),
    ...fs.readdirSync(path.join(ROOT,'src')).filter(n=>/\.(wat|watx)$/.test(n)).map(n=>'src/'+n)]
    .map(p=>[p,sha(fs.readFileSync(path.join(ROOT,p)))]));
  const save=()=>fs.writeFileSync(path.join(dir,'range-controls.json'),JSON.stringify(state,null,2)+'\n');
  const cfg=()=>({...base.plan(),immediate:true,noPreview:true,states:[],samples:[],
    immediateSource:publicRangeFixture.toString(),webglVersion:2,
    thunkBase:require('../lib/region-map.generated').BASE.THUNK_BASE,
    factoryId:require('../src/api_table.json').find(x=>x.name==='DirectDrawCreateEx').id,
    imageBase:pe.readUInt32LE(pe.readUInt32LE(0x3c)+52),moduleSHA:sha(wasm)});
  const pe=fs.readFileSync(path.join(ROOT,'test/binaries/calc.exe'));
  state.bootstrapPE={path:'test/binaries/calc.exe',sha256:sha(pe)};
  let wasm,server,browser,page,timer;
  try{
    for(const name of ['wine-assembly.wasm','wine-assembly.compat.wasm']){
      wasm=fs.readFileSync(path.join(ROOT,'build',name));state.modules[name]={bytes:wasm.length,sha256:sha(wasm)};
      const routes=new Map([['/legacy-render.wasm',wasm],['/test/binaries/calc.exe',pe],
        ['/lib/host-import-sigs.generated.json',fs.readFileSync(path.join(ROOT,'lib/host-import-sigs.generated.json'))]]);
      const context=vm.createContext({WebAssembly,performance,setTimeout,crypto:crypto.webcrypto,fetch:async url=>{assert(routes.has(url));const b=routes.get(url);return {
        arrayBuffer:async()=>Uint8Array.from(b).buffer,json:async()=>JSON.parse(b)};}});
      let result;
      try{result=await vm.runInContext('('+source+')',context)('software',cfg(),base.oracle.toString());}
      catch(error){state.cells.push({name,mode:'software',error:String(error),partial:context.legacyTextureEvidence});save();throw error;}
      state.cells.push({name,mode:'software',result});save();console.log('PASS ranges software '+name);
    }
    const scripts=['region-map.generated','gl-command-stream','d3d-command-stream','guest-rpc','guest-thread-host',
      'render-worker','gpu-backend','d3d9-shader','d3d-shader-ir','d3d9-fixed','d3d9-texture','render-clear','d3d9-backend','d3dim-gpu'];
    server=await require('./static-server').startStaticServer({root:ROOT,crossOriginIsolated:true,handleRequest(req,res){
      const url=new URL(req.url,'http://localhost').pathname;
      res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');
      res.setHeader('Cache-Control','no-store');
      if(url==='/legacy-render.wasm'){res.writeHead(200,{'Content-Type':'application/wasm'});res.end(wasm);return true;}
      if(url==='/ranges-fixture'){res.writeHead(200,{'Content-Type':'text/html'});res.end(scripts.map(p=>'<script src="/lib/'+p+'.js"></script>').join('\n'));return true;}
      return false;
    }});state.port=server.address().port;
    const dependency=await import(require('node:url').pathToFileURL(require.resolve('puppeteer')).href),puppeteer=dependency.default||dependency;
    assert(Date.now()<deadline-120000,'cleanup margin before browser');
    browser=await puppeteer.launch({headless:true,executablePath:process.env.CHROME||'/usr/bin/google-chrome',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'],protocolTimeout:120000});
    state.browser={version:await browser.version(),pid:browser.process().pid,profile:browser.process().spawnargs.find(s=>s.startsWith('--user-data-dir='))?.slice(16)};save();
    browser.process().once('exit',(code,signal)=>{state.browserExit={code,signal,at:new Date().toISOString()};});
    timer=setTimeout(()=>browser.close().catch(()=>{}),Math.min(900000,deadline-Date.now()-30000));
    async function cell(name,mode,version,negative=null){
      wasm=fs.readFileSync(path.join(ROOT,'build',name));assert.equal(sha(wasm),state.modules[name].sha256);
      page=await browser.newPage();await page.goto('http://127.0.0.1:'+state.port+'/ranges-fixture');
      assert.equal(await page.evaluate(()=>self.crossOriginIsolated),true,'isolated fixture before any Worker');
      const config=cfg();config.webglVersion=version;let result,error;
      try{result=await page.evaluate(fixture,mode,config,base.oracle.toString(),negative);}catch(e){error=String(e);}
      const row={name,mode,version,negative,result,error};
      if(error)row.partial=await page.evaluate(()=>globalThis.legacyTextureEvidence);
      (negative?state.negatives:state.cells).push(row);save();
      if(negative){assert.match(error||'',/VB RANGE PIXEL ORACLE/);assert(row.partial.vbRanges.draws.length);}
      else{assert.equal(error,undefined);assert.equal(result.status,'PASS');
        assert.match(result.glRenderer.version,new RegExp('^WebGL '+version+'[.]0'));
        if(mode==='worker'){assert.equal(result.stats.requestedBackend,'webgl');assert.equal(result.stats.d3dimSoftwareDrawCallsCompleted,0);
          assert.equal(result.stats.d3dimFallbackSoftwareDrawCallsCompleted,0);assert(result.stats.renderEndpointId);}
        await page.screenshot({path:path.join(dir,name+'-'+mode+'-gl'+version+'.png'),fullPage:true});}
      await page.close();page=null;console.log('PASS ranges '+JSON.stringify({name,mode,version,negative}));
    }
    for(const name of Object.keys(state.modules))for(const mode of ['webgl','worker'])for(const version of [1,2])await cell(name,mode,version);
    for(const negative of ['start','capacity','absolute','queued'])await cell('wine-assembly.wasm',negative==='queued'?'worker':'webgl',2,negative);
    for(const [file,hash] of Object.entries(state.productionFiles))assert.equal(sha(fs.readFileSync(path.join(ROOT,file))),hash,'source drift '+file);
    state.status='PASS';
  }catch(error){state.status='FAIL; subsequent paths UNTESTED';state.error=error.stack;throw error;}
  finally{if(timer)clearTimeout(timer);if(browser)await browser.close();if(server)await require('./static-server').closeServer(server);
    state.closedAt=new Date().toISOString();state.cleanup={pidAbsent:state.browser?!fs.existsSync('/proc/'+state.browser.pid):null,
      profileAbsent:state.browser?!fs.existsSync(state.browser.profile):null,serverClosed:server?!server.listening:null};save();}
}
if(process.argv.includes('--public-ranges'))runPublicRanges().catch(e=>{console.error(e);process.exitCode=1;});
