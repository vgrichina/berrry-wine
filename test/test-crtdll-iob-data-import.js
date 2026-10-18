#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const { bootRenderHarness } = require('./render-helper');

// Minimal original-style PE fixture; two named imports reserve adjacent slots.
function makePe(dll = 'CrTdLl.DlL', symbol = '_iob') {
  const bytes = Buffer.alloc(0x600);
  const pe = 0x80;
  const opt = pe + 24;
  const section = opt + 0xE0;

  bytes.writeUInt16LE(0x5A4D, 0);
  bytes.writeUInt32LE(pe, 0x3C);
  bytes.writeUInt32LE(0x00004550, pe);
  bytes.writeUInt16LE(0x014C, pe + 4);       // IMAGE_FILE_MACHINE_I386
  bytes.writeUInt16LE(1, pe + 6);
  bytes.writeUInt16LE(0xE0, pe + 20);
  bytes.writeUInt16LE(0x010F, pe + 22);

  bytes.writeUInt16LE(0x010B, opt);          // PE32
  bytes.writeUInt32LE(0x400, opt + 4);
  bytes.writeUInt32LE(0x1000, opt + 16);     // AddressOfEntryPoint
  bytes.writeUInt32LE(0x1000, opt + 20);     // BaseOfCode
  bytes.writeUInt32LE(0x400000, opt + 28);   // ImageBase
  bytes.writeUInt32LE(0x1000, opt + 32);     // SectionAlignment
  bytes.writeUInt32LE(0x200, opt + 36);      // FileAlignment
  bytes.writeUInt32LE(0x2000, opt + 56);     // SizeOfImage
  bytes.writeUInt32LE(0x200, opt + 60);      // SizeOfHeaders
  bytes.writeUInt32LE(16, opt + 92);         // NumberOfRvaAndSizes
  bytes.writeUInt32LE(0x1100, opt + 104);    // Import directory RVA
  bytes.writeUInt32LE(40, opt + 108);

  bytes.write('.text\0\0\0', section, 'ascii');
  bytes.writeUInt32LE(0x400, section + 8);
  bytes.writeUInt32LE(0x1000, section + 12);
  bytes.writeUInt32LE(0x400, section + 16);
  bytes.writeUInt32LE(0x200, section + 20);
  bytes.writeUInt32LE(0xE0000060, section + 36);

  // mov eax,[0x401140]; add eax,64; mov eax,[eax+16]; ret
  Buffer.from([0xA1, 0x40, 0x11, 0x40, 0x00, 0x83, 0xC0, 0x40, 0x8B, 0x40, 0x10, 0xC3])
    .copy(bytes, 0x200);

  bytes.writeUInt32LE(0x1130, 0x300);        // OriginalFirstThunk
  bytes.writeUInt32LE(0x1180, 0x30C);        // DLL name RVA
  bytes.writeUInt32LE(0x1140, 0x310);        // FirstThunk / IAT
  bytes.writeUInt32LE(0x1190, 0x330);        // _iob lookup
  bytes.writeUInt32LE(0x11A0, 0x334);        // ordinary function lookup
  bytes.writeUInt32LE(0x1190, 0x340);
  bytes.writeUInt32LE(0x11A0, 0x344);
  bytes.write(dll+'\0', 0x380, 'ascii');
  bytes.writeUInt16LE(143, 0x390);
  bytes.write(symbol+'\0', 0x392, 'ascii');
  bytes.writeUInt16LE(183, 0x3A0);
  bytes.write('_controlfp\0', 0x3A2, 'ascii');
  return bytes;
}

const extraWat = String.raw`
 (func (export "t_iob") (result i32) (call $crt_iob_ensure))
 (func (export "t_lookup") (param $f i32) (result i32) (call $crt_stream_lookup (local.get $f)))
 (func (export "t_import_dll") (param $base i32)
   (call $process_dll_imports (local.get $base) (i32.const 0x1100)))
 (func (export "t_resolve") (param $dll i32) (param $name i32) (result i32)
   (call $resolve_crtdll_iob_import (call $g2w (local.get $dll)) (call $g2w (local.get $name))))
 (func (export "t_freopen") (param $path i32) (param $mode i32) (param $f i32) (result i32)
   (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
   (call $handle_freopen (local.get $path) (local.get $mode) (local.get $f)
     (i32.const 0) (i32.const 0) (i32.const 0))
   (i32.load (global.get $reg_base)))
 (func (export "t_fputs") (param $text i32) (param $f i32) (result i32)
   (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
   (call $handle_fputs (local.get $text) (local.get $f)
     (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
   (i32.load (global.get $reg_base)))
`;

(async()=>{
 const h=await bootRenderHarness({extraWat,fonts:'none'}),e=h.exports;
 // Instantiate both before populating shared memory; active data segments
 // are initialization, not a simulation of worker attachment.
 const sibling=new WebAssembly.Instance(h.module,{host:h.host,gdi:h.gdi}).exports;
 const pe=makePe(),mem=new Uint8Array(h.memory.buffer);
 mem.set(pe,e.get_staging());
 assert.equal(e.load_pe(pe.length),0x401000);
 sibling.init_thread(1,0x400000,0,0,0,0,0);
 const iob=e.guest_read32(0x401140)>>>0,thunk=e.get_thunk_base()>>>0;
 assert(iob && (iob<thunk || iob >= (e.get_thunk_end()>>>0)),'_iob resolves outside callable thunk range');
 assert.equal(iob,e.t_iob()>>>0,'loader and CRT accessor share one array');
 assert.equal(iob,sibling.t_iob()>>>0,'sibling instance shares process publication');
 assert.equal(e.guest_read32(0x401144)>>>0,thunk+8,'ordinary import slot stays stable');
 for(let i=0;i<3;i++){
   const f=iob+i*32;
   assert(e.t_lookup(f),'each FILE has registered ownership');
   assert.equal(e.guest_read32(f+12),i===0?1:2,'initial read/write flags');
   assert.equal(e.guest_read32(f+16),i,'stdin/stdout/stderr descriptor');
 }
 assert.equal(e.t_lookup(iob+1),0,'interior/non-FILE pointer not owned');
 e.call_func(0x401000,0,0,0,0);
 for(let i=0;i<20&&e.get_eip();i++)e.run(1000);
 assert.equal(e.get_eip(),0);
 assert.equal(e.get_eax(),2,'guest dereferences stderr FILE instead of a thunk');

 // A loaded caller's system-DLL imports must see the identical array.
 for(let i=0;i<0x400;i++)e.guest_write8(0x501000+i,pe[0x200+i]);
 e.t_import_dll(0x500000);
 assert.equal(e.guest_read32(0x501140)>>>0,iob);
 const put=(addr,text)=>{for(let i=0;i<=text.length;i++)e.guest_write8(addr+i,i===text.length?0:text.charCodeAt(i));};
 put(0x401280,'vendor.dll');put(0x4012a0,'_iob');
 assert.equal(e.t_resolve(0x401280,0x4012a0),0,'other module not captured');
 put(0x401280,'crtdll.dll.extra');
 assert.equal(e.t_resolve(0x401280,0x4012a0),0,'module suffix not captured');
 put(0x401280,'CRTDLL.DLL');put(0x4012a0,'_iob_extra');
 assert.equal(e.t_resolve(0x401280,0x4012a0),0,'symbol suffix not captured');
 put(0x4012a0,'_iob');
 assert.equal(e.t_resolve(0x401280,0x4012a0)>>>0,iob,'case-insensitive DLL and exact symbol');

 // Imported stderr is accepted by stdio, unlike the old thunk+64 pointer.
 put(0x401280,'c:\\iob-stderr.txt');put(0x4012a0,'w');put(0x4012b0,'stderr data');
 const stderr=iob+64;
 assert.equal(e.t_freopen(0x401280,0x4012a0,stderr)>>>0,stderr,'freopen preserves imported FILE identity');
 assert.equal(e.t_fputs(0x4012b0,stderr),0);
 const file=[...h.hostCtx.vfs.files.entries()].find(([name])=>/iob-stderr\.txt$/i.test(name));
 assert(file);assert.equal(Buffer.from(file[1].data).toString(),'stderr data');
 assert.equal(sibling.t_iob()>>>0,iob,'reopening does not replace process array');
 assert(sibling.t_lookup(stderr),'shared ownership persists after reopening');

 // A distinct guest process has distinct linear memory and ownership state.
 // Equal virtual addresses are legal; mutations must not cross that boundary.
 const other=await bootRenderHarness({extraWat,fonts:'none'}),o=other.exports;
 assert.notEqual(other.memory,h.memory);
 new Uint8Array(other.memory.buffer).set(pe,o.get_staging());
 o.load_pe(pe.length);
 const otherIob=o.guest_read32(0x401140)>>>0;
 assert(o.t_lookup(otherIob+64));
 const oldFlags=e.guest_read32(iob+64+12);
 o.guest_write32(otherIob+64+12,0x12345678);
 assert.equal(e.guest_read32(iob+64+12),oldFlags,'separate process FILE state is isolated');
 assert.equal(other.hostCtx.vfs.files.size,0,'stderr file belongs only to first process VFS');

 // Map an actual PE DLL with a named data export, then a caller importing it.
 // The native export must win over the builtin CRT table.
 const native=makePe(),opt=0x80+24;
 native.fill(0,0x300,0x600);
 native.writeUInt16LE(0x210F,0x80+22);
 native.writeUInt32LE(0,opt+16);
 native.writeUInt32LE(0,opt+104);native.writeUInt32LE(0,opt+108);
 native.writeUInt32LE(0x1100,opt+96);native.writeUInt32LE(0x80,opt+100);
 native.writeUInt32LE(0x1180,0x30C); // export DLL name
 native.writeUInt32LE(1,0x310); // ordinal base
 native.writeUInt32LE(1,0x314);native.writeUInt32LE(1,0x318);
 native.writeUInt32LE(0x1140,0x31C);native.writeUInt32LE(0x1144,0x320);
 native.writeUInt32LE(0x1148,0x324);
 native.writeUInt32LE(0x1300,0x340); // exported data RVA, outside export directory
 native.writeUInt32LE(0x1190,0x344);native.writeUInt16LE(0,0x348);
 native.write('crtdll.dll\0',0x380);native.write('_iob\0',0x390);
 new Uint8Array(other.memory.buffer).set(native,o.get_staging());
 o.load_dll(native.length,0x600000);
 assert(o.get_dll_index(0x600000)>=0,'native CRT fixture mapped');
 new Uint8Array(other.memory.buffer).set(pe,o.get_staging());
 o.load_dll(pe.length,0x700000);
 assert.equal(o.guest_read32(0x701140)>>>0,0x601300,'real DLL data export takes precedence');
 assert.notEqual(o.guest_read32(0x701140)>>>0,otherIob);
 console.log('PASS CRTDLL _iob static EXE/DLL identity, FILE ownership, shared instances, distinct processes and native export precedence');
})().catch(error=>{console.error(error.stack||error);process.exitCode=1;});

