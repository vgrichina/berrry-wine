#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const { bootRenderHarness } = require('./render-helper');
const { REGIONS } = require('../lib/region-map.generated');
const apiTable = require('../src/api_table.json');

// Both getters return zero on failure, and preserve each valid DC's mode.
// https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-getpolyfillmode
// https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-getstretchbltmode
const extraWat = String.raw`
 (func (export "mode_gdi_dc_state_hint") (result i32) (global.get $gdi_dc_state_hint))
 (func (export "mode_gdi_dc_clip_hint") (result i32) (global.get $gdi_dc_clip_hint))
 (func (export "mode_gdi_dc_system_clip_hint") (result i32) (global.get $gdi_dc_system_clip_hint))
 (func (export "mode_gdi_object_hint") (result i32) (global.get $gdi_object_hint))
 (func (export "mode_gdi_object_hint2") (result i32) (global.get $gdi_object_hint2))
 (func (export "mode_gdi_window_surface_hint") (result i32) (global.get $gdi_window_surface_hint))
 (func (export "mode_gdi_next_object_handle") (result i32) (global.get $gdi_next_object_handle))
 (func (export "mode_init")
  (global.set $thunk_guest_base (i32.add (global.get $image_base)
   (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
  (call $update_thunk_end))
 (func (export "mode_regs") (result i32) (global.get $reg_base))
 (func (export "mode_module") (param $p i32) (result i32)
  (call $handle_GetModuleHandleA (local.get $p) (i32.const 0) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0))
  (i32.load (global.get $reg_base)))
 (func (export "mode_resolve") (param $m i32) (param $p i32) (result i32)
  (call $handle_GetProcAddress (local.get $m) (local.get $p) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0))
  (i32.load (global.get $reg_base)))
 (func (export "mode_call") (param $p i32)
  (global.set $eip (i32.const 0x456789ab))
  (call $win32_dispatch (i32.shr_u
   (i32.sub (local.get $p) (global.get $thunk_guest_base)) (i32.const 3))))
 (func (export "mode_table") (result i32) (global.get $GDI_DC_STATE_TABLE))
 (func (export "mode_table_bytes") (result i32)
  (i32.mul (global.get $GDI_DC_STATE_COUNT) (global.get $GDI_DC_STATE_STRIDE)))
 (func (export "mode_marks") (result i32) (global.get $GDI_TABLE_MARKS))
 (func (export "mode_next_dc") (result i32) (global.get $gdi_next_dc_handle))
 (func (export "mode_window") (result i32)
  (local $h i32)
  (local.set $h (global.get $next_hwnd))
  (global.set $next_hwnd (i32.add (local.get $h) (i32.const 1)))
  (call $wnd_table_set (local.get $h) (global.get $WNDPROC_CTRL_NATIVE))
  (local.get $h))
`;

async function main() {
 const { exports: e, memory } = await bootRenderHarness({ extraWat, fonts: 'none', width: 16, height: 16 });
 e.init_thread(1, 0x400000, 0, 0, 0, 0, 0); e.heap_init(0x800000); e.mode_init(); e.set_api_log(0);
 const mem = new Uint8Array(memory.buffer), view = new DataView(memory.buffer), regs = e.mode_regs() >>> 0;
 const wa = p => e.guest_to_wasm(p) >>> 0, alloc = n => e.guest_alloc(n) >>> 0;
 const read = (p, n) => Buffer.from(Array.from({ length: n }, (_, i) => e.guest_read8(p + i)));
 const put = (p, b) => b.forEach((v, i) => e.guest_write8(p + i, v));
 const text = s => { const p = alloc(s.length + 1); put(p, Buffer.from(s + '\0')); return p; };
 const stackArea = alloc(256), stack = stackArea + 64, direct = alloc(128), unrelated = alloc(128);
 const thunks = new Map();
 for (const [dll, names] of [['GDI32.DLL', ['CreateCompatibleDC', 'CreateDCA', 'DeleteDC',
  'GetPolyFillMode', 'GetStretchBltMode', 'SetPolyFillMode', 'SetStretchBltMode', 'CreateDIBSection', 'SelectObject', 'DeleteObject', 'CreateSolidBrush', 'GetStockObject', 'Polygon', 'StretchBlt', 'SaveDC', 'RestoreDC']], ['USER32.DLL', ['GetDC', 'ReleaseDC']]]) {
  view.setUint32(regs + 16, stack, true); const module = e.mode_module(text(dll)) >>> 0; assert.ok(module);
  for (const name of names) {
   view.setUint32(regs + 16, stack, true); const thunk = e.mode_resolve(module, text(name)) >>> 0;
   assert.ok(thunk, name + ' public resolver'); const row = apiTable.find(r => r.name === name);
   assert.equal(row.convention, 'stdcall'); assert.equal(view.getUint32(wa(thunk) + 4, true), row.id);
   thunks.set(name, { thunk, nargs: row.nargs });
  }
 }
 let calls = 0, queries = 0; const failures = [], invalidObservations = [];
 function compare(actual, expected, label, kind) {
  if (Buffer.isBuffer(actual)) { actual = actual.toString('hex'); expected = expected.toString('hex'); }
  if (JSON.stringify(actual) !== JSON.stringify(expected)) failures.push({ label, kind, actual: typeof actual === 'string' && actual.length > 256 ? require('node:crypto').createHash('sha256').update(actual).digest('hex') : actual, expected: typeof expected === 'string' && expected.length > 256 ? require('node:crypto').createHash('sha256').update(expected).digest('hex') : expected });
 }
 function invoke(name, args) {
  const entry = thunks.get(name); assert.equal(args.length, entry.nargs, name + ' arity');
  mem.fill(0x5a, wa(stackArea), wa(stackArea) + 256);
  e.guest_write32(stack, 0x12345678); args.forEach((v, i) => e.guest_write32(stack + 4 + i * 4, v));
  const before = read(stackArea, 256), other = read(unrelated, 128);
  const seed = [0xa0123456, 0x11223344, 0x22334455, 0x33445566, stack, 0x44556677, 0x55667788, 0x66778899];
  seed.forEach((v, i) => view.setUint32(regs + i * 4, v, true)); e.mode_call(entry.thunk); calls++;
  assert.equal(e.get_esp() >>> 0, stack + 4 + args.length * 4, name + ' ESP');
  assert.equal(e.get_eip() >>> 0, 0x456789ab, name + ' EIP');
  for (const i of [1, 2, 3, 5, 6, 7]) assert.equal(view.getUint32(regs + i * 4, true), seed[i], name + ' register ' + i);
  assert.deepEqual(read(stackArea, 256), before, name + ' complete stack frame');
  assert.deepEqual(read(unrelated, 128), other, name + ' unrelated bytes');
  return e.get_eax();
 }
 const ok = (name, args, expected) => { const result = invoke(name, args); if (expected === undefined) assert.ok(result, name); else assert.equal(result, expected, name); return result >>> 0; };
 const memoryA = ok('CreateCompatibleDC', [0]), memoryB = ok('CreateCompatibleDC', [0]);
 const screen = ok('GetDC', [0]), independent = ok('CreateDCA', [text('DISPLAY'), 0, 0, 0]);
 assert.equal(new Set([memoryA, memoryB, screen, independent]).size, 4, 'independent live DC handles');
 const deleted = ok('CreateCompatibleDC', [0]); ok('DeleteDC', [deleted], 1);
 const state = () => [e.get_flag_op(), e.get_flag_a(), e.get_flag_b(), e.get_flag_res(), e.get_flag_sign_shift(), e.get_current_thread_id(), e.get_yield_reason(), e.heap_stat(0), e.heap_stat(1), e.mode_next_dc(), ...mem.subarray(e.mode_marks(), e.mode_marks() + 16)];
 const observedBuffers=[];
 const protectedRegions=Object.values(REGIONS).filter(r=>/^GDI_.*(TABLE|MARKS|GEN|HWM|LOCK)$/.test(r.name)||['HEAP_SHARED','HEAP_ARENAS'].includes(r.name));
 const tableSnapshot=()=>[...protectedRegions.map(r=>Buffer.from(mem.subarray(r.base,r.end))),...observedBuffers.map(([p,n])=>read(p,n))];
 function query(name, dc, expected, label, invalid = false) {
  const invalidGlobals=()=>["gdi_dc_state_hint","gdi_dc_clip_hint","gdi_dc_system_clip_hint","gdi_object_hint","gdi_object_hint2","gdi_window_surface_hint","gdi_next_object_handle"].map(n=>e['mode_'+n]()>>>0);
  const beforeGlobals=invalid?invalidGlobals():null;
  const before = state(), table = tableSnapshot();
  const result = invoke(name, [dc]); queries++;
  compare(result, expected, label, invalid ? 'invalid' : 'valid');
  assert.deepEqual(state(), before, label + ' flags/thread/yield/allocator/table marks');
  assert.deepEqual(tableSnapshot(), table, label + ' full GDI tables and allocator bytes');
  if(invalid)assert.deepEqual(invalidGlobals(),beforeGlobals,label+' invalid DC caches/object allocator');
  if (invalid) invalidObservations.push({name, dc: dc >>> 0, expected, result});
 }
 const wrongType=ok('GetStockObject',[8]); // Actual public NULL_PEN handle, not a DC.
 const getters = ['GetPolyFillMode', 'GetStretchBltMode'];
 const dcs = [memoryA, memoryB, screen, independent];
 function invalids(label) {
  // These values miss the canonical table and live-window namespaces; this
  // does not classify every arbitrary nonzero handle as invalid.
  for (const name of getters) for (const dc of [0, deleted, wrongType, 0x7fffffff, 0xffffffff])
   for (let repeat = 0; repeat < 3; repeat++) query(name, dc, 0, label + '/' + name + '/' + dc + '/' + repeat, true);
 }
 invalids('defaults');
 for (const dc of dcs) for (const name of getters) query(name, dc, 1, name + ' default ' + dc);
 const modes = [[1, 1], [2, 2], [1, 3], [2, 4]];
 for (let i = 0; i < dcs.length; i++) {
  ok('SetPolyFillMode', [dcs[i], modes[i][0]], 1);
  ok('SetStretchBltMode', [dcs[i], modes[i][1]], 1);
 }
 function all(label) {dcs.forEach((dc,i) => getters.forEach((name,j) => query(name,dc,modes[i][j],label+'/'+name+'/'+dc)));}
 all('independent');
 for(const dc of dcs)for(const [name,values]of [['SetPolyFillMode',[0,3,-1,0x7fffffff]],['SetStretchBltMode',[0,5,-1,0x7fffffff]]])for(const value of values){const before=tableSnapshot(),flags=state();ok(name,[dc,value],0);assert.deepEqual(tableSnapshot(),before,'rejected mode full table preservation');assert.deepEqual(state(),flags,'rejected mode allocator/flags');}
 all('after rejected setters'); invalids('configured'); all('after invalid');
 for (let i = 0; i < dcs.length; i++) {
  const dc = dcs[i], saved = ok('SaveDC', [dc]);
  let poly = modes[i][0], stretch = modes[i][1];
  for (const value of [2, 1, 2]) {ok('SetPolyFillMode',[dc,value],poly);poly=value;query(getters[0],dc,value,'set poly '+dc+'/'+value);}
  for (const value of [4, 3, 2, 1]) {ok('SetStretchBltMode',[dc,value],stretch);stretch=value;query(getters[1],dc,value,'set stretch '+dc+'/'+value);}
  const inner = ok('SaveDC',[dc]);
  ok('SetPolyFillMode',[dc,1],poly);ok('SetStretchBltMode',[dc,4],stretch);
  ok('RestoreDC',[dc,-1],1);query(getters[0],dc,poly,'nested poly restore');query(getters[1],dc,stretch,'nested stretch restore');
  ok('RestoreDC',[dc,saved],1);all('absolute restore '+dc);
  assert.ok(inner > saved);
 }
 // Lazy window DCs must still be adopted by canonical create=0 lookup.
 for (const [index, name] of getters.entries()) {
  const hwnd = e.mode_window() >>> 0;
  const lazy = hwnd + (index ? 0xc0000 : 0x40000);
  assert.equal(invoke(name,[lazy]),1,name+' first-use lazy default');
  for (const getter of getters) query(getter,lazy,1,'adopted lazy '+getter);
  ok('SetPolyFillMode',[lazy,2],1);ok('SetStretchBltMode',[lazy,3],1);
  const saved = ok('SaveDC',[lazy]);
  ok('SetPolyFillMode',[lazy,1],2);ok('SetStretchBltMode',[lazy,4],3);
  ok('RestoreDC',[lazy,saved],1);
  query(getters[0],lazy,2,'lazy restored poly');query(getters[1],lazy,3,'lazy restored stretch');all('lazy isolation');
 }
 function dib(dc,w,h) {
  const info=alloc(40),out=alloc(4);
  put(info,Buffer.alloc(40)); e.guest_write32(info,40);e.guest_write32(info+4,w);e.guest_write32(info+8,-h);
  e.guest_write16(info+12,1);e.guest_write16(info+14,32);
  const bitmap=ok('CreateDIBSection',[dc,info,0,out,0,0]),bits=e.guest_read32(out)>>>0;
  assert.ok(bits);const previous=ok('SelectObject',[dc,bitmap]);observedBuffers.push([bits,w*h*4]);
  return {dc,w,h,bits,bitmap,previous,pixel:(x,y)=>e.guest_read32(bits+4*(y*w+x))>>>0};
 }
 const renderDC = ok('CreateCompatibleDC',[0]), sourceDC = ok('CreateCompatibleDC',[0]);
 const target = dib(renderDC,16,16), source = dib(sourceDC,2,2);
 const brush = ok('CreateSolidBrush',[0x000000ff]);
 const oldBrush = ok('SelectObject',[renderDC,brush]), nullPen = ok('GetStockObject',[8]),oldPen = ok('SelectObject',[renderDC,nullPen]);
 const points = alloc(64);
 const vertices=[[2,2],[13,2],[13,13],[2,13],[2,2],[13,2],[13,13],[2,13]];
 vertices.forEach(([x,y],i)=>{e.guest_write32(points+8*i,x);e.guest_write32(points+8*i+4,y);});
 const rendered=[];
 for (const mode of [1,2]) {
  put(target.bits,Buffer.alloc(16*16*4,0xff));
  invoke('SetPolyFillMode',[renderDC,mode]);
  query(getters[0],renderDC,mode,'polygon mode '+mode);
  invalids('polygon '+mode);
  ok('Polygon',[renderDC,points,vertices.length],1);
  assert.equal(target.pixel(7,7)&0xffffff,mode===1?0xffffff:0xff0000,'double winding polygon center '+mode);
  assert.equal(target.pixel(0,0)&0xffffff,0xffffff,'polygon outside');
  for(let y=0;y<16;y++)for(let x=0;x<16;x++)assert.equal(target.pixel(x,y)&0xffffff,mode===2&&x>=2&&x<13&&y>=2&&y<13?0xff0000:0xffffff,'literal whole polygon DIB '+mode+'/'+x+'/'+y);
  rendered.push({kind:'polygon',mode,width:16,height:16,dibHex:read(target.bits,1024).toString('hex'),center:target.pixel(7,7),outside:target.pixel(0,0)});
 }
 // Expansion has an unambiguous literal nearest-pixel control in every
 // supported mode; reduction/filtering behavior is outside this getter repair.
 const colors=[0x00112233,0x00445566,0x00778899,0x00aabbcc];
 colors.forEach((v,i)=>e.guest_write32(source.bits+4*i,v));
 for (const mode of [1,2,3,4]) {
  put(target.bits,Buffer.alloc(16*16*4,0xff));
  invoke('SetStretchBltMode',[renderDC,mode]);
  query(getters[1],renderDC,mode,'stretch mode '+mode);invalids('stretch '+mode);
  const sourceBefore=read(source.bits,16);
  ok('StretchBlt',[renderDC,4,4,4,4,sourceDC,0,0,2,2,0x00cc0020],1);
  assert.deepEqual(read(source.bits,16),sourceBefore,'StretchBlt source unchanged');
  for(let y=0;y<16;y++)for(let x=0;x<16;x++)assert.equal(target.pixel(x,y)&0xffffff,x>=4&&x<8&&y>=4&&y<8?colors[((y-4)>>1)*2+((x-4)>>1)]:0xffffff,'literal whole stretched DIB '+mode+'/'+x+'/'+y);
  assert.equal(target.pixel(0,0)&0xffffff,0xffffff,'stretch outside');
  rendered.push({kind:'stretch',mode,width:16,height:16,dibHex:read(target.bits,1024).toString('hex'),pixels:Array.from({length:16},(_,i)=>target.pixel(4+i%4,4+(i>>2)))});
 }
 all('after rendered controls');
 observedBuffers.length=0;
 ok('SelectObject',[renderDC,oldBrush]);ok('SelectObject',[renderDC,oldPen]);
 for(const surface of [source,target]) {ok('SelectObject',[surface.dc,surface.previous]);ok('DeleteObject',[surface.bitmap],1);ok('DeleteDC',[surface.dc],1);}
 ok('DeleteObject',[brush],1);
 console.log(JSON.stringify({calls,queries,rendered,invalidObservations,failures},null,2));
 assert.equal(failures.length,0,'mode getter public API mismatches');
 console.log('PASS GDI public mode getters, invalid state preservation, DC isolation, SaveDC/RestoreDC, ABI and polygon/stretch DIB controls');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
