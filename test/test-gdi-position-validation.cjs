#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const { bootRenderHarness } = require('./render-helper');
const apiTable = require('../src/api_table.json');

// GetCurrentPositionEx returns two signed LONG logical coordinates.
// Known invalid DCs fail without writing output. Supported lazy window DCs
// remain valid; arbitrary nonzero handles are not all classified as invalid.
// https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-getcurrentpositionex
// https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-movetoex
// https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-lineto
// https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-polylineto
// https://learn.microsoft.com/en-us/windows/win32/api/windef/ns-windef-point
const extraWat = String.raw`
 (func (export "position_init")
  (global.set $thunk_guest_base (i32.add (global.get $image_base)
   (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
  (call $update_thunk_end))
 (func (export "position_regs") (result i32) (global.get $reg_base))
 (func (export "position_module") (param $p i32) (result i32)
  (call $handle_GetModuleHandleA (local.get $p) (i32.const 0) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0))
  (i32.load (global.get $reg_base)))
 (func (export "position_resolve") (param $m i32) (param $p i32) (result i32)
  (call $handle_GetProcAddress (local.get $m) (local.get $p) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0))
  (i32.load (global.get $reg_base)))
 (func (export "position_call") (param $p i32)
  (global.set $eip (i32.const 0x456789ab))
  (call $win32_dispatch (i32.shr_u
   (i32.sub (local.get $p) (global.get $thunk_guest_base)) (i32.const 3))))
 (func (export "position_table") (result i32) (global.get $GDI_DC_STATE_TABLE))
 (func (export "position_table_bytes") (result i32)
  (i32.mul (global.get $GDI_DC_STATE_COUNT) (global.get $GDI_DC_STATE_STRIDE)))
 (func (export "position_marks") (result i32) (global.get $GDI_TABLE_MARKS))
 (func (export "position_next_dc") (result i32) (global.get $gdi_next_dc_handle))
 (func (export "position_window") (result i32)
  (local $h i32)
  (local.set $h (global.get $next_hwnd))
  (global.set $next_hwnd (i32.add (local.get $h) (i32.const 1)))
  (call $wnd_table_set (local.get $h) (global.get $WNDPROC_CTRL_NATIVE))
  (local.get $h))
`;

async function main() {
 const { exports: e, memory } = await bootRenderHarness({ extraWat, fonts: 'none', width: 16, height: 16 });
 e.init_thread(1, 0x400000, 0, 0, 0, 0, 0); e.heap_init(0x800000); e.position_init(); e.set_api_log(0);
 const mem = new Uint8Array(memory.buffer), view = new DataView(memory.buffer), regs = e.position_regs() >>> 0;
 const wa = p => e.guest_to_wasm(p) >>> 0, alloc = n => e.guest_alloc(n) >>> 0;
 const read = (p, n) => Buffer.from(Array.from({ length: n }, (_, i) => e.guest_read8(p + i)));
 const put = (p, b) => b.forEach((v, i) => e.guest_write8(p + i, v));
 const text = s => { const p = alloc(s.length + 1); put(p, Buffer.from(s + '\0')); return p; };
 const stackArea = alloc(256), stack = stackArea + 64, direct = alloc(128), unrelated = alloc(128);
 const thunks = new Map();
 for (const [dll, names] of [['GDI32.DLL', ['CreateCompatibleDC', 'CreateDCA', 'DeleteDC',
  'GetCurrentPositionEx', 'MoveToEx', 'LineTo', 'PolylineTo', 'SetMapMode', 'SetWindowOrgEx', 'SetViewportOrgEx', 'SetWindowExtEx', 'SetViewportExtEx', 'LPtoDP', 'CreateDIBSection', 'SelectObject', 'DeleteObject', 'CreatePen', 'SaveDC', 'RestoreDC']], ['USER32.DLL', ['GetDC', 'ReleaseDC']]]) {
  view.setUint32(regs + 16, stack, true); const module = e.position_module(text(dll)) >>> 0; assert.ok(module);
  for (const name of names) {
   view.setUint32(regs + 16, stack, true); const thunk = e.position_resolve(module, text(name)) >>> 0;
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
  seed.forEach((v, i) => view.setUint32(regs + i * 4, v, true)); e.position_call(entry.thunk); calls++;
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
 const base = 0x30000000, decoy = 0x28000000, decoy2 = 0x29000000, adjacent = 0x31000000;
 for (const p of [base, decoy, base + 4096, decoy2]) assert.equal(e.test_virtual_map_commit(p, 4096) >>> 0, p);
 assert.equal(e.test_virtual_map_commit(adjacent, 8192) >>> 0, adjacent);
 assert.equal(wa(decoy), wa(base) + 4096); assert.notEqual(wa(base + 4096), wa(base) + 4096);
 assert.equal(wa(adjacent + 4096), wa(adjacent) + 4096);
 // Cache NULL's physical sentinel before testing; translating a miss again
 // deliberately clears its first DWORD and would corrupt the observation.
 const nullPhysical = wa(0);
 const spans = [[wa(direct), 128], [wa(base), 4096], [wa(decoy), 4096], [wa(decoy2), 4096], [wa(base + 4096), 4096], [wa(adjacent), 8192], [nullPhysical, 32]];
 const snapshot = () => spans.map(([p, n]) => Buffer.from(mem.subarray(p, p + n)));
 const state = () => [e.get_flag_op(), e.get_flag_a(), e.get_flag_b(), e.get_flag_res(), e.get_flag_sign_shift(), e.get_current_thread_id(), e.get_yield_reason(), e.heap_stat(0), e.heap_stat(1), e.position_next_dc(), ...mem.subarray(e.position_marks(), e.position_marks() + 16)];
 function query(name, dc, p, hex, label, kind = 'valid') {
  spans.forEach(([s, n], i) => mem.fill(0x95 + i, s, s + n));
  const expected = snapshot(), literal = hex && Buffer.from(hex, 'hex');
  if (literal) for (let i = 0; i < 8; i++) { const physical = wa(p + i), j = spans.findIndex(([s, n]) => physical >= s && physical < s + n); assert.ok(j >= 0); expected[j][physical - spans[j][0]] = literal[i]; }
  const beforeState = state(), table = Buffer.from(mem.subarray(e.position_table(), e.position_table() + e.position_table_bytes()));
  const result = invoke(name, [dc, p]); queries++;
  compare(result, literal ? 1 : 0, label + ' BOOL', kind);
  if (kind === 'invalid') invalidObservations.push({ name, dc: dc >>> 0, output: p >>> 0, result, bytes: p ? read(p, 8).toString('hex') : null });
  if (literal) compare(read(p, 8), literal, label + ' literal POINT', kind);
  snapshot().forEach((b, i) => compare(b, expected[i], label + ' full backing ' + i, kind));
  assert.deepEqual(state(), beforeState, label + ' flags/thread/yield/allocator');
  assert.deepEqual(Buffer.from(mem.subarray(e.position_table(), e.position_table() + e.position_table_bytes())), table, label + ' complete DC state unchanged');
 }
 const getters = ['GetCurrentPositionEx'];
 const defaultHex = '0000000000000000';
 // Required outputs and known invalid inputs are independent of output mapping.
 for (const name of getters) {
  for (const dc of [memoryA, memoryB, screen, independent]) {
   query(name, dc, direct + 16, defaultHex, name + ' default ' + dc);
   query(name, dc, 0, null, name + ' NULL output ' + dc, 'invalid');
  }
  for (const dc of [0, 0x7fffffff, 0xffffffff, deleted]) for (const p of [direct + 17, base + 4093, 0])
   query(name, dc, p, null, name + ' invalid/deleted DC ' + dc + ' output ' + p, 'invalid');
 }
 const getter = getters[0];
 const locations = [direct + 17, ...Array.from({length:7},(_,i)=>base+4095-i), ...Array.from({length:7},(_,i)=>adjacent+4095-i)];
 for (const dc of [0, 0x7fffffff, 0xffffffff, deleted]) for (const output of locations)
  query(getter, dc, output, null, 'invalid full boundary '+dc+'/'+output, 'invalid');
 const pairs = [[memoryA, [-17, 123], 'efffffff7b000000'], [memoryB, [456, -70123], 'c801000015eefeff'],
  [screen, [-2147483648, 2147483647], '00000080ffffff7f'], [independent, [2147483647, -2147483648], 'ffffff7f00000080']];
 for (const [dc, xy] of pairs) ok('MoveToEx', [dc, ...xy, 0], 1);
 for (let repeat=0;repeat<2;repeat++) for (const [dc,,hex] of pairs) for (const output of locations)
  query(getter,dc,output,hex,'signed logical position '+dc+'/'+output+'/'+repeat);
 for (const [dc,,hex] of pairs) {
  ok('SaveDC',[dc],1); ok('MoveToEx',[dc,39,-70123,0],1);
  query(getter,dc,base+4093,'2700000015eefeff','saved replacement '+dc);
  ok('RestoreDC',[dc,-1],1);
  query(getter,dc,adjacent+4091,hex,'restored position '+dc);
 }
 // The first canonical lookup may adopt a supported live legacy window DC.
 for(const offset of [0x40000,0xc0000]) {
 const hwnd=e.position_window()>>>0,legacy=hwnd+offset;
 query(getter,legacy,0,null,'lazy NULL before adoption','invalid');
 spans.forEach(([s,n],i)=>mem.fill(0x95+i,s,s+n));
 const legacyExpected=snapshot(); Buffer.from(defaultHex,'hex').copy(legacyExpected[0],16);
 ok(getter,[legacy,direct+16],1);
 snapshot().forEach((b,i)=>assert.deepEqual(b,legacyExpected[i],'first lazy full backing '+i));
 query(getter,legacy,base+4093,defaultHex,'adopted lazy default');
 ok('MoveToEx',[legacy,-17,123,0],1);
 for(const output of locations) query(getter,legacy,output,pairs[0][2],'lazy signed logical '+output);
 }
 // Mapping changes affect drawing, never the stored logical position.
 for (const mode of [1,2,3,4,5,6,7,8]) {
  ok('SetMapMode',[memoryA,mode]);
  ok('SetWindowOrgEx',[memoryA,2,3,0],1); ok('SetViewportOrgEx',[memoryA,8,9,0],1);
  if(mode>=7){ok('SetWindowExtEx',[memoryA,2,2,0],1);ok('SetViewportExtEx',[memoryA,4,4,0],1);}
  for(const output of locations) query(getter,memoryA,output,pairs[0][2],'mapping retains logical '+mode+'/'+output);
 }
 // Public line commands draw into an authored top-down DIB. A horizontal then
 // vertical segment has a literal pixel oracle, including excluded endpoints.
 const bmi=alloc(40),bitsOut=alloc(4),points=alloc(16),mapped=alloc(8);
 put(bmi,Buffer.alloc(40)); e.guest_write32(bmi,40);e.guest_write32(bmi+4,64);e.guest_write32(bmi+8,-64);
 e.guest_write16(bmi+12,1);e.guest_write16(bmi+14,32);
 const bitmap=ok('CreateDIBSection',[memoryA,bmi,0,bitsOut,0,0]),stock=ok('SelectObject',[memoryA,bitmap]);
 const bits=e.guest_read32(bitsOut)>>>0,physical=wa(bits),pixelBytes=64*64*4;
 assert.ok(bits);assert.equal(wa(bits+pixelBytes-1),physical+pixelBytes-1);
 const pen=ok('CreatePen',[0,1,0x00332211]),oldPen=ok('SelectObject',[memoryA,pen]);
 const renderProof=[];
 for(const mode of [1,8]) {
  ok('SetMapMode',[memoryA,mode]);
  ok('SetWindowOrgEx',[memoryA,mode===8?2:0,mode===8?3:0,0],1);
  ok('SetViewportOrgEx',[memoryA,mode===8?8:0,mode===8?9:0,0],1);
  if(mode===8){ok('SetWindowExtEx',[memoryA,2,2,0],1);ok('SetViewportExtEx',[memoryA,4,4,0],1);}
  mem.fill(0x6d,physical,physical+pixelBytes);
  const expected=Buffer.alloc(pixelBytes,0x6d),transform=([x,y])=>mode===8?[(x-2)*2+8,(y-3)*2+9]:[x,y];
  const color=(x,y)=>{const p=(y*64+x)*4;expected[p]=0x33;expected[p+1]=0x22;expected[p+2]=0x11;expected[p+3]=0;};
  const start=transform([4,5]),middle=transform([10,5]),end=transform([10,11]);
  ok('MoveToEx',[memoryA,4,5,0],1);
  query(getter,memoryA,base+4093,'0400000005000000','MoveToEx logical '+mode);
  ok('LineTo',[memoryA,10,5],1);
  query(getter,memoryA,adjacent+4091,'0a00000005000000','LineTo logical '+mode);
  for(let x=start[0];x<middle[0];x++)color(x,start[1]);
  assert.deepEqual(Buffer.from(mem.subarray(physical,physical+pixelBytes)),expected,'LineTo complete DIB '+mode);
  e.guest_write32(points,10);e.guest_write32(points+4,8);e.guest_write32(points+8,10);e.guest_write32(points+12,11);
  ok('PolylineTo',[memoryA,points,2],1);
  query(getter,memoryA,base+4095,'0a0000000b000000','PolylineTo final logical '+mode);
  for(let y=middle[1];y<end[1];y++)color(middle[0],y);
  assert.deepEqual(Buffer.from(mem.subarray(physical,physical+pixelBytes)),expected,'PolylineTo complete DIB '+mode);
  e.guest_write32(mapped,10);e.guest_write32(mapped+4,11);ok('LPtoDP',[memoryA,mapped,1],1);
  assert.deepEqual([e.guest_read32(mapped),e.guest_read32(mapped+4)],end,'literal device coordinates');
  query(getter,memoryA,direct+17,'0a0000000b000000','LPtoDP does not change logical position '+mode);
  renderProof.push({mode,start,middle,end,logicalEnd:[10,11],fullDIB:true});
  if(process.env.GDI_POSITION_CAPTURE_DIR){
   const canvas=require('../lib/canvas-compat').createCanvas(64,64),ctx=canvas.getContext('2d'),image=ctx.createImageData(64,64);
   for(let i=0;i<pixelBytes;i+=4){image.data[i]=mem[physical+i+2];image.data[i+1]=mem[physical+i+1];image.data[i+2]=mem[physical+i];image.data[i+3]=255;}
   ctx.putImageData(image,0,0);require('node:fs').writeFileSync(process.env.GDI_POSITION_CAPTURE_DIR+'/line-mode-'+mode+'.png',canvas.toBuffer('image/png'));
  }
 }
 console.log(JSON.stringify({renderProof}));
 ok('SelectObject',[memoryA,oldPen]);ok('SelectObject',[memoryA,stock]);ok('DeleteObject',[pen],1);ok('DeleteObject',[bitmap],1);
 ok('ReleaseDC', [0, screen], 1);
 for (const dc of [memoryA, memoryB, independent]) ok('DeleteDC', [dc], 1);
 const validFailures = failures.filter(f => f.kind === 'valid'), invalidFailures = failures.filter(f => f.kind === 'invalid');
 console.log(JSON.stringify({ calls, queries, failureCount: failures.length, validFailures: validFailures.length, invalidFailures: invalidFailures.length, invalidObservations, failures: failures.slice(0, 14), validFailureDetails: validFailures, allSevenBoundaries: true, literal8Bytes: true, fullBackingCanaries: true, ABI: true }));
 assert.equal(validFailures.length, 0, 'valid DC controls and signed logical positions');
 assert.equal(invalidFailures.length, 0, 'invalid/null/deleted DC and NULL output fail without output writes');
 console.log('PASS public GDI current position validation, independent DCs, signed origins, SaveDC/RestoreDC, all seven byte boundaries and ABI');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
