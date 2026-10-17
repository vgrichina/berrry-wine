'use strict';
// Explicit prebuilt full-module allocator proof. No compilation or guest API
// dispatch substitutes; NE initialization/QT remain intentionally unactivated.
const assert = require('node:assert/strict'), fs = require('node:fs'), crypto = require('node:crypto');
const { createHostImports } = require('../lib/host-imports');
const R = require('../lib/region-map.generated');
const SIZE = 944 * 65536, BASE = 0x400000;
function fixture() {
  const b = Buffer.alloc(0x400), p = 0x80, o = p + 24, s = o + 0xe0;
  b.write('MZ'); b.writeUInt32LE(p, 0x3c); b.writeUInt32LE(0x4550, p);
  b.writeUInt16LE(0x14c, p + 4); b.writeUInt16LE(1, p + 6); b.writeUInt16LE(0xe0, p + 20);
  b.writeUInt16LE(0x10e, p + 22); b.writeUInt16LE(0x10b, o); b.writeUInt32LE(0x1000, o + 16);
  b.writeUInt32LE(BASE, o + 28); b.writeUInt32LE(0x1000, o + 32); b.writeUInt32LE(0x200, o + 36);
  b.writeUInt32LE(0x2000, o + 56); b.writeUInt32LE(0x200, o + 60); b.writeUInt16LE(3, o + 68);
  b.writeUInt32LE(0x100000, o + 72); b.writeUInt32LE(0x1000, o + 76); b.writeUInt32LE(16, o + 92);
  b.write('.text', s); b.writeUInt32LE(0x1000, s + 8); b.writeUInt32LE(0x1000, s + 12);
  b.writeUInt32LE(0x200, s + 16); b.writeUInt32LE(0x200, s + 20); b.writeUInt32LE(0xe0000060, s + 36);
  b[0x200] = 0xc3; return b;
}
async function boot(module, memory, init) {
  const imports = createHostImports({ getMemory: () => memory.buffer, renderer: null, resourceJson: {} });
  imports.host.memory = memory;
  for (const item of WebAssembly.Module.imports(module)) {
    assert.equal(item.module, 'host');
    if (item.kind === 'function' && !imports.host[item.name])
      imports.host[item.name] = () => { throw Error('Unexpected host import ' + item.name); };
  }
  const e = (await WebAssembly.instantiate(module, imports)).exports;
  if (init) e.init_thread(...init);
  return e;
}
async function main() {
  assert(process.env.WA_TEST_WASM, 'explicit prebuilt module required');
  const module = await WebAssembly.compile(fs.readFileSync(process.env.WA_TEST_WASM));
  const memory = new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
  const bytes = new Uint8Array(memory.buffer), view = new DataView(memory.buffer);
  const first = await boot(module,memory), pe = fixture();
  const load = () => { bytes.set(pe,first.get_staging()); return first.load_pe(pe.length); };
  assert.equal(load(),BASE+0x1000);
  const second = await boot(module,memory,[1,first.get_image_base(),first.get_code_start(),first.get_code_end(),first.get_thunk_base(),first.get_thunk_end(),first.get_num_thunks(),0]);
  // Use named region placement; MMX is a documented subregion of UOP_CSCRATCH.
  const header = fs.readFileSync(require('node:path').join(__dirname,'../src/01-header.wat'),'utf8');
  const mmx = header.match(/\(global \$MMX_FILE i32 \(region.addr \$([^ ]+) (0x[0-9a-f]+)\)\)/);
  assert(mmx);
  const files = slot => [[R.BASE.REGFILE+slot*64,32],[R.BASE.FPU_FILE+slot*128,128],
    [R.BASE.XMM_FILE+slot*128,128],[R.BASE[mmx[1]]+Number(mmx[2])+slot*128,128]];
  const getters = ['get_eip','get_esp','get_fs_base','get_sreg_cs','get_sreg_ss','get_sreg_ds','get_sreg_es','get_fpu_top','get_fpu_sw','get_fpu_tags'];
  const snapshot = (e,slot) => ({globals:getters.map(n=>e[n]()),files:files(slot).map(([p,n])=>Buffer.from(bytes.slice(p,p+n)))});
  const seed = (e,slot,value) => {for(const [p,n] of files(slot))bytes.fill(value,p,p+n);e.set_eip(BASE+0x1000);e.set_esp(0x7408000+slot*0x1000);e.set_fs_base(0x12340000+slot*0x10000);};
  seed(first,0,0x51);seed(second,1,0x62);
  const original = snapshot(first,0), foreignOriginal = snapshot(second,1);
  bytes.fill(0xa7,R.BASE.GUEST_STACK,R.BASE.GUEST_STACK+R.SIZE.GUEST_STACK);
  first.guest_write32(BASE+0x1100,0x12345678);
  const outer = first.win16_bridge_frame_begin();assert(outer);assert.deepEqual(snapshot(first,0),original);
  const base = view.getUint32(R.BASE.WIN16_PROCESS_ARENA,true);
  const backing = first.guest_to_wasm(base)>>>0, shared = backing+943*65536+0xf000;
  assert.equal(view.getUint32(shared+36,true),1);
  assert.equal(second.win16_bridge_frame_end(outer),0);
  assert.equal(first.win16_process_arena_release(),0);
  assert.equal(load(),-4,'process reset refuses live context');assert.equal(first.get_image_base(),BASE);
  assert.equal(first.win16_bridge_stack_enter(outer),1);
  const stack = first.get_esp()>>>0;assert(stack>base&&stack<=base+SIZE);
  assert.notEqual(first.get_sreg_ss(),original.globals[4]);
  const nestedCaller = snapshot(first,0), inner = first.win16_bridge_frame_begin();assert(inner!==outer);
  assert.equal(first.win16_bridge_stack_enter(inner),1);assert.notEqual(first.get_esp(),stack);
  assert.equal(first.win16_bridge_frame_end(outer),0);
  seed(first,0,0x73);assert.equal(first.win16_bridge_frame_end(inner),1);assert.deepEqual(snapshot(first,0),nestedCaller);
  const foreign = second.win16_bridge_frame_begin();assert(foreign);assert.equal(second.win16_bridge_stack_enter(foreign),1);
  assert.equal(first.win16_bridge_abort(),1);assert.deepEqual(snapshot(first,0),original);
  assert.equal(view.getUint32(shared+36,true),1);assert.equal(first.win16_process_arena_release(),0);
  assert.equal(second.win16_bridge_frame_end(foreign),1);assert.deepEqual(snapshot(second,1),foreignOriginal);
  const recycled = first.win16_bridge_frame_begin();assert(recycled!==outer);assert.equal(first.win16_bridge_frame_end(outer),0);
  assert.equal(first.win16_bridge_frame_end(recycled),1);
  assert.equal(view.getUint32(shared+36,true),0);
  assert.equal(first.guest_read32(BASE+0x1100)>>>0,0x12345678);
  assert(bytes.subarray(R.BASE.GUEST_STACK,R.BASE.GUEST_STACK+R.SIZE.GUEST_STACK).every(v=>v===0xa7),'PE stack untouched');
  assert.equal(first.is_win16(),0);assert.equal(first.get_image_base(),BASE);
  assert.equal(first.win16_process_arena_release(),1);assert.equal(view.getUint32(R.BASE.WIN16_PROCESS_ARENA,true),0);
  assert.equal(load(),BASE+0x1000);const fresh=first.win16_bridge_frame_begin();assert(fresh);assert.equal(first.win16_bridge_frame_end(fresh),1);assert.equal(first.win16_process_arena_release(),1);
  console.log(JSON.stringify({passed:true,fixtureSha256:crypto.createHash('sha256').update(pe).digest('hex'),guestExecution:false,neDllInitialization:false}));
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
