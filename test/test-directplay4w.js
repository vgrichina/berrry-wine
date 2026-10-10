#!/usr/bin/env node
'use strict';
// Actual canonical WASM contract for bounded local DirectPlay4W support.
// Auxiliary-instance checks characterize inherited per-instance entity limits;
// they do not claim cross-Worker DirectPlay entity/name sharing.
const assert=require('assert/strict'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const apis=require('../src/api_table.json');
const {bootRenderHarness}=require('./render-helper');
const extraWat=String.raw`
(func (export "test_registry_base") (result i32) (global.get $DX_VTBL_REGISTRY))
(func (export "test_registry_size") (result i32) (global.get $DX_VTBL_REGISTRY_SIZE))
(func (export "test_registry_count") (result i32) (global.get $DX_VTBL_REGISTRY_COUNT))
(func (export "test_registry_append") (param $p i32) (call $dx_vtable_registry_append (local.get $p)))
(func (export "test_registry_di7") (result i32) (global.get $DX_VTBL_DIDEV7))
(func (export "test_registry_ds8") (result i32) (global.get $DX_VTBL_DSOUND8))
(func (export "test_dp_object") (result i32) (call $dx_create_com_obj (i32.const 26) (global.get $DX_VTBL_DPLAY3)))
(func (export "test_dp_refs") (param $p i32) (result i32) (load.field DxObject refcount (call $dx_from_this (local.get $p))))
(func (export "test_dp_factory") (param $clsid i32) (param $iid i32) (param $out i32) (param $sp i32) (result i32)
 (i32.store offset=16 (global.get $reg_base) (local.get $sp))
 (call $handle_CoCreateInstance (local.get $clsid) (i32.const 0) (i32.const 1) (local.get $iid) (local.get $out) (i32.const 0))
 (i32.load offset=0 (global.get $reg_base)))

(func (export "test_w_table_sync") (result i32) (global.set $DX_VTBL_DPLAY4W (i32.const 0)) (call $dx_sync_thread_vtables) (global.get $DX_VTBL_DPLAY4W))
(func (export "test_aux_fill") (result i32) (local $old i32) (local.set $old (i32.load (global.get $COM_AUX_NEXT_SHARED))) (i32.store (global.get $COM_AUX_NEXT_SHARED) (global.get $COM_WRAPPERS_AUX_MAX)) (local.get $old))
(func (export "test_aux_restore") (param $old i32) (i32.store (global.get $COM_AUX_NEXT_SHARED) (local.get $old)))
(func (export "test_acp") (param $cp i32) (global.set $ansi_code_page (local.get $cp)))
(func (export "test_net") (param $state i32) (i32.store offset=40 (global.get $DP_SHARED) (local.get $state)))
(func (export "test_w_names") (result i32) (local $i i32) (local $n i32)
 (if (i32.load offset=28 (global.get $DP_SHARED)) (then (loop $scan
  (if (call $gl32 (i32.add (i32.load offset=28 (global.get $DP_SHARED)) (i32.mul (local.get $i) (i32.const 4)))) (then (local.set $n (i32.add (local.get $n) (i32.const 1)))))
  (local.set $i (i32.add (local.get $i) (i32.const 1))) (br_if $scan (i32.lt_u (local.get $i) (global.get $DP_ENTITY_MAX)))))) (local.get $n))
(func (export "test_peer_name") (param $obj i32) (param $id i32) (param $out i32) (param $size i32) (param $sp i32) (param $wide i32) (result i32)
 (i32.store offset=16 (global.get $reg_base) (local.get $sp))
 (if (local.get $wide) (then (call $handle_IDirectPlay4W_GetPlayerName (local.get $obj) (local.get $id) (local.get $out) (local.get $size) (i32.const 0) (i32.const 0)))
 (else (call $handle_IDirectPlay3_GetPlayerName (local.get $obj) (local.get $id) (local.get $out) (local.get $size) (i32.const 0) (i32.const 0)))) (i32.load offset=0 (global.get $reg_base)))
(func (export "test_peer_qi") (param $obj i32) (param $iid i32) (param $out i32) (result i32) (call $dplay_query_interface (call $dpw_owner (local.get $obj)) (local.get $iid) (local.get $out) (i32.const 0)))
(func (export "test_peer_release") (param $obj i32) (param $sp i32) (result i32)
 (i32.store offset=16 (global.get $reg_base) (local.get $sp))
 (call $handle_IDirectPlay4W_Release (local.get $obj) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
(func (export "test_peer_rename") (param $obj i32) (param $id i32) (param $name i32) (param $sp i32) (result i32)
 (i32.store offset=16 (global.get $reg_base) (local.get $sp))
 (call $handle_IDirectPlay4W_SetPlayerName (local.get $obj) (local.get $id) (local.get $name) (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
(func (export "test_peer_close") (param $obj i32) (param $sp i32) (result i32)
 (i32.store offset=16 (global.get $reg_base) (local.get $sp))
 (call $handle_IDirectPlay4W_Close (local.get $obj) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
(func (export "test_provider_start") (param $obj i32) (param $cb i32) (param $ctx i32) (param $sp i32) (result i32)
 (global.set $eip (i32.const 0)) (i32.store offset=16 (global.get $reg_base) (local.get $sp)) (call $gs32 (local.get $sp) (i32.const 0))
 (call $handle_IDirectPlay4W_EnumConnections (local.get $obj) (i32.const 0) (local.get $cb) (local.get $ctx) (i32.const 0) (i32.const 0)) (global.get $eip))
(func (export "test_enum_start") (param $obj i32) (param $wide i32) (param $cb i32) (param $ctx i32) (param $sp i32) (result i32)
 (global.set $eip (i32.const 0)) (i32.store offset=16 (global.get $reg_base) (local.get $sp)) (call $gs32 (local.get $sp) (i32.const 0))
 (if (local.get $wide) (then (call $handle_IDirectPlay4W_EnumPlayers (local.get $obj) (i32.const 0) (local.get $cb) (local.get $ctx) (i32.const 8) (i32.const 0)))
 (else (call $handle_IDirectPlay3_EnumPlayers (local.get $obj) (i32.const 0) (local.get $cb) (local.get $ctx) (i32.const 8) (i32.const 0)))) (global.get $eip))
`;
(async()=>{
 const {exports:e,memory,module,host}=await bootRenderHarness({extraWat,fonts:'none'});
 const exe=fs.readFileSync(root+'/test/binaries/notepad.exe');new Uint8Array(memory.buffer).set(exe,e.get_staging());assert(e.load_pe(exe.length)>0);e.init_dx_com_thunks();
 // Capacity must include count header; the old 292-byte allocation fails here.
 const registryBase=e.test_registry_base()>>>0,registrySize=e.test_registry_size()>>>0,registryCount=e.test_registry_count()>>>0;
 assert.equal(registrySize,(registryCount+1)*4,'allocated registry covers every pointer and count');
 const registryView=new DataView(memory.buffer),registryEnd=registryBase+registrySize;
 assert.equal(registryView.getUint32(registryBase,true),registryCount);
 // Earlier interfaces keep their slots: the new W table is appended, so the
 // DirectInput7/DirectSound8 entries stay registered (their absolute offsets
 // move as other interfaces are added on main, so look them up).
 const registrySlots=[];for(let i=1;i<=registryCount;i++)registrySlots.push(registryView.getUint32(registryBase+i*4,true));
 assert(registrySlots.includes(e.test_registry_di7()>>>0),'existing DirectInput7 registry entry retained');
 assert(registrySlots.includes(e.test_registry_ds8()>>>0),'existing DirectSound8 registry entry retained');
 assert(registrySlots.indexOf(e.test_registry_ds8()>>>0)<registryCount-1,'the Unicode DirectPlay4 table is appended after them');
 const boundarySaved=registryView.getUint32(registryEnd,true);
 registryView.setUint32(registryEnd,0xa7b8c9da,true);
 e.test_registry_append(0x12345678); // Full registry must reject another pointer.
 assert.equal(registryView.getUint32(registryEnd,true),0xa7b8c9da,'full append preserves adjacent boundary canary');
 registryView.setUint32(registryEnd,boundarySaved,true);
 const alloc=n=>e.guest_alloc(n)>>>0,read=p=>e.guest_read32(p)>>>0,write=(p,v)=>e.guest_write32(p,v),stack=alloc(128),out=alloc(4),size=alloc(4);
 const guid=words=>{const p=alloc(16);words.forEach((v,i)=>write(p+i*4,v));return p;};
 const iidW=guid([0x0ab1c530,0x11d14745,0x0000a1a7,0xfcab03f8]),iidA=guid([0x0ab1c531,0x11d14745,0x0000a1a7,0xfcab03f8]),iidBad=guid([0x0ab1c530,0,0,0]),iidU=guid([0,0,0xc0,0x46000000]);
 const call=(object,slot,...args)=>{const thunk=read(read(object)+slot*4),api=apis[read(thunk+4)];assert.equal(read(thunk),0xcaca0010);assert.equal(api.nargs,args.length+1);write(stack,0);[object,...args].forEach((v,i)=>write(stack+(i+1)*4,v));e.set_esp(stack);e.set_eip(thunk);e.run(1);assert.equal(e.get_eip(),0);assert.equal(e.get_esp()>>>0,stack+(api.nargs+1)*4);return e.get_eax()>>>0;};
 const a=e.test_dp_object()>>>0,originalTable=read(a);write(out,0xfeedface);
 assert.equal(call(a,0,iidW,0),0x80004003);assert.equal(e.test_dp_refs(a),1);
 const exhausted=e.test_aux_fill();assert.equal(call(a,0,iidW,out),0x8007000e);assert.equal(read(out),0);assert.equal(read(a),originalTable);assert.equal(e.test_dp_refs(a),1);e.test_aux_restore(exhausted);
 assert.equal(call(a,0,iidW,out),0);const w=read(out);assert(w);assert.notEqual(w,a,'ANSI and W pointers cannot share mutable string semantics');assert.equal(read(a),originalTable);assert.equal(e.test_dp_refs(a),2);
 for(let slot=0;slot<53;slot++)assert.equal(read(read(read(w)+slot*4)),0xcaca0010,'full 53-slot W ABI');
 assert.equal(e.test_w_table_sync()>>>0,read(w),'worker registry W vtable restoration');
 assert.equal(call(w,0,iidW,out),0);assert.equal(read(out),w);assert.equal(call(w,2),2);
 assert.equal(call(w,0,iidU,out),0);assert.equal(read(out),a,'canonical IUnknown');assert.equal(call(a,2),2);
 write(out,0xfeedface);assert.equal(call(w,0,iidBad,out),0x80004002);assert.equal(read(out),0);assert.equal(e.test_dp_refs(a),2);
 assert.equal(call(w,0,iidA,out),0);assert.equal(read(out),a);assert.equal(call(a,2),2);

 const iidBase=0x3a000000,iidNeighbor=iidBase+0x10000;for(const p of [iidBase,iidNeighbor,iidBase+4096])e.test_virtual_map_commit(p,4096);assert.notEqual(e.guest_to_wasm(iidBase+4096),e.guest_to_wasm(iidBase)+4096);const splitIid=iidBase+4091;for(let i=0;i<128;i++)e.guest_write8(iidNeighbor+i,0xa7);
 for(let i=0;i<16;i++)e.guest_write8(splitIid+i,e.guest_read8(iidW+i));assert.equal(call(a,0,splitIid,out),0);assert.equal(read(out),w);assert.equal(call(w,2),2);assert.equal(e.guest_span_cursor_bytes(),0);
 e.guest_write8(splitIid+15,0);write(out,0xfeedface);assert.equal(call(w,0,splitIid,out),0x80004002);assert.equal(read(out),0);assert.equal(e.test_dp_refs(a),2);assert.equal(e.guest_span_cursor_bytes(),0);assert.equal(call(w,0,0xffffffff,0),0x80004003);for(let i=0;i<16;i++)e.guest_write8(splitIid+i,e.guest_read8(iidW+i));for(let i=0;i<128;i++)assert.equal(e.guest_read8(iidNeighbor+i),0xa7);
 const utf16=s=>{const p=alloc((s.length+1)*2);for(let i=0;i<s.length;i++)e.guest_write16(p+2*i,s.charCodeAt(i));e.guest_write16(p+2*s.length,0);return p;};
 const decode=p=>{let s='';for(let i=0;i<64;i++){const v=(e.guest_read8(p+2*i)|(e.guest_read8(p+2*i+1)<<8));if(!v)return s;s+=String.fromCharCode(v);}throw Error('unterminated output');};
 const name=(short,long)=>{const p=alloc(16);write(p,16);write(p+4,0);write(p+8,utf16(short));write(p+12,utf16(long));return p;};
 const first=['雪é😀','長い名前Ω'],next=['改名ß','再命名😀'];
 const n=name(...first);assert.equal(call(w,6,out,n,0,0,0,0),0);const player=read(out);assert(player);
 const checkName=expected=>{write(size,0);assert.equal(call(w,21,player,0,size),0x8877001e);const needed=16+2*(expected[0].length+1)+2*(expected[1].length+1);assert.equal(read(size),needed,'byte-sized Unicode buffer including both terminators');const buf=alloc(needed+8);for(let i=0;i<needed+8;i++)e.guest_write8(buf+i,0xcc);write(size,needed-1);assert.equal(call(w,21,player,buf,size),0x8877001e);assert.equal(read(size),needed);for(let i=0;i<needed+8;i++)assert.equal(e.guest_read8(buf+i),0xcc,'insufficient buffer cannot partially publish');write(size,needed);assert.equal(call(w,21,player,buf,size),0);assert.equal(read(buf),16);assert.equal(decode(read(buf+8)),expected[0]);assert.equal(decode(read(buf+12)),expected[1]);assert.equal(read(buf+needed),0xcccccccc,'no output overrun');};

 checkName(first);
 const sparse=0x38000000,neighbor=sparse+0x10000;for(const p of [sparse,neighbor,sparse+4096])e.test_virtual_map_commit(p,4096);assert.notEqual(e.guest_to_wasm(sparse+4096),e.guest_to_wasm(sparse)+4096);
 for(let i=0;i<128;i++)e.guest_write8(neighbor+i,0xa7);const spText=sparse+4095,text='境😀';for(let i=0;i<text.length;i++)e.guest_write16(spText+i*2,text.charCodeAt(i));e.guest_write16(spText+text.length*2,0);const splitName=name('','跨頁');write(splitName+8,spText);assert.equal(call(w,30,player,splitName,0),0);checkName([text,'跨頁']);
 const splitOut=sparse+4090;write(size,128);assert.equal(call(w,21,player,splitOut,size),0);assert.equal(decode(read(splitOut+8)),text);assert.equal(decode(read(splitOut+12)),'跨頁');for(let i=0;i<128;i++)assert.equal(e.guest_read8(neighbor+i),0xa7,'sparse neighbor intact');
 assert.equal(call(w,30,player,name(...next),0),0);checkName(next);



 // Real auxiliary instance: the session lives in $DP_SHARED, so a second guest
 // thread sees the same players and the same Unicode name table (3cd30c5e;
 // MCM receives on one thread and creates players on another).
 const peer=(await WebAssembly.instantiate(module,{host})).exports;peer.init_thread(1,e.get_image_base(),0,0,0,0,0,0);assert.equal(peer.test_w_table_sync()>>>0,read(w));assert.equal(e.test_dp_refs(a),2);
 const peerStack=alloc(128),peerSize=alloc(4),peerOut=alloc(4);write(peerSize,128);assert.equal(peer.test_peer_name(w,player,peerOut,peerSize,peerStack,1)>>>0,0,'a peer thread sees the shared player');assert(read(peerSize)>0);write(peerSize,128);assert.equal(peer.test_peer_name(a,player,peerOut,peerSize,peerStack,0)>>>0,0,'and through the ANSI interface');assert.equal(peer.test_w_names(),e.test_w_names(),'one Unicode name table');
 assert.equal(peer.test_peer_qi(w,iidU,peerOut),0);assert.equal(read(peerOut),a);assert.equal(e.test_dp_refs(a),3);assert.equal(peer.test_peer_release(w,peerStack),2);
 // A rename from the peer thread lands in the shared table; rename back so the
 // checks below still see `next`. (Close from a peer would close the one shared
 // session, which the rest of this test still uses.)
 assert.equal(peer.test_peer_rename(w,player,n,peerStack)>>>0,0,'a peer thread can rename the shared player');assert.equal(peer.test_peer_rename(w,player,name(...next),peerStack)>>>0,0);checkName(next);assert.equal(e.test_w_names(),1,'still one named entity');
 console.log('PASS auxiliary instance shares COM/QI/vtable identity and the DirectPlay session (players, names) with the main instance');
 // An A observer receives CP1252 conversion, not low-byte truncation.
 const readAnsi=p=>{let out='';for(let i=0;i<128;i++){const c=e.guest_read8(p+i);if(!c)return out;out+=String.fromCharCode(c);}throw Error('A output unterminated');};
 write(size,0);assert.equal(call(a,21,player,0,size),0x8877001e);const abuf=alloc(read(size));assert.equal(call(a,21,player,abuf,size),0);assert.equal(readAnsi(read(abuf+8)),'??ß');
 // Groups share the same Unicode contract, including cross-interface ownership.
 assert.equal(call(w,5,out,name('組€','GroupΩ'),0,0,0),0);const group=read(out);assert.equal(call(a,3,group,player),0,'W-created entities belong to canonical A owner');
 write(size,0);assert.equal(call(w,16,group,0,size),0x8877001e);const gbuf=alloc(read(size));assert.equal(call(w,16,group,gbuf,size),0);assert.equal(decode(read(gbuf+8)),'組€');
 assert.equal(call(w,28,group,name('新','換名'),0),0);
 // Exercise every explicit unsupported ABI through its real guest thunk.
 // Open/EnumSessions/InitializeConnection/StartSession/GetCaps/GetPlayerCaps/
 // Initialize now drive the virtual-LAN provider (Age of Empires II hosts and
 // joins only through IDirectPlay4W); test-aoe2-vlan-gameplay.js covers them.
 const unsupportedMethods=['GetPlayerAddress','SetSessionDesc','GetGroupConnectionSettings','SecureOpen','SendChatMessage','SetGroupConnectionSettings','GetPlayerAccount'];
 for(const method of unsupportedMethods){
  const api=apis.find(a=>a.name==='IDirectPlay4W_'+method),first=apis.find(a=>a.name==='IDirectPlay4W_QueryInterface').id;
  assert.deepEqual(api.stub,{pop:4*(api.nargs+1),ret:0x80004001});
  write(out,0xfeedface);const refs=e.test_dp_refs(w);
  assert.equal(call(w,api.id-first,...Array(api.nargs-1).fill(out)),0x80004001,method+' is explicitly unsupported');
  assert.equal(read(out),0xfeedface,method+' leaves output untouched');assert.equal(e.test_dp_refs(w),refs);
 }
 // Unsupported Unicode networking must neither fabricate success nor outputs.
 write(out,0xfeedface);assert.equal(call(w,22,out,size),0x887700AA,"W GetSessionDesc outside a session is DPERR_NOCONNECTION");assert.equal(read(out),0xfeedface);
 assert.equal(call(w,24,0,0),0x80070057,"W Open validates a NULL session descriptor");assert.equal(call(w,25,0,0,0,size,0),0x80070057,"W Receive validates its id pointers");
 e.test_net(1);assert.equal(call(w,6,out,n,0,0,0,0),0,"W CreatePlayer works in a network session");const netPlayer=read(out);assert.notEqual(netPlayer,0);e.test_net(0);assert.equal(call(w,9,netPlayer),0);
 e.test_acp(932);assert.equal(call(w,30,player,n,0),0x80004001);e.test_acp(1252);checkName(next);
 // Allocation rollback: common invalid data fails after name preparation.
 const countBefore=e.test_w_names();assert.equal(call(w,6,out,n,0,0,4,0),0x80070057);assert.equal(read(out),0);assert.equal(e.test_w_names(),countBefore);
 // Real W provider callback receives UTF16, independent of the ANSI provider.
 const providerCb=alloc(16),providerStack=alloc(1024)+768;[0xb8,1,0,0,0,0xc2,0x18,0].forEach((v,i)=>e.guest_write8(providerCb+i,v));
 assert.equal(e.test_provider_start(w,providerCb,0xabcdef,providerStack)>>>0,providerCb);const providerEsp=e.get_esp()>>>0,providerName=read(providerEsp+16);assert.equal(read(providerName),16);assert.equal(decode(read(providerName+8)),'TCP/IP');assert.equal(decode(read(providerName+12)),'TCP/IP');assert.equal(read(read(providerEsp+4)),0x36e95ee0);assert.equal(read(providerEsp+24),0xabcdef);
 for(let i=0;i<100&&e.get_eip();i++)e.run(1000);assert.equal(e.get_eip(),0);assert.equal(e.get_esp()>>>0,providerStack+24);
 // Real guest callbacks: outer W data survives nested A enumeration and an A rename.
 const cb=alloc(16);[0xb8,0,0,0,0,0xc2,0x14,0].forEach((v,i)=>e.guest_write8(cb+i,v));

 const enumBase=0x3b000000,enumNeighbor=enumBase+0x10000;for(const p of [enumBase,enumNeighbor,enumBase+4096])e.test_virtual_map_commit(p,4096);assert.notEqual(e.guest_to_wasm(enumBase+4096),e.guest_to_wasm(enumBase)+4096);for(let i=0;i<128;i++)e.guest_write8(enumNeighbor+i,0xa7);
 const outerStack=enumBase+4096+8,innerStack=alloc(1024)+768;
 assert.equal(e.test_enum_start(w,1,cb,0x1234,outerStack)>>>0,cb);const outerEsp=e.get_esp()>>>0,outerName=read(outerEsp+12);assert.equal(decode(read(outerName+8)),next[0]);assert.equal(read(outerEsp+20),0x1234);
 assert.equal(e.test_enum_start(a,0,cb,0x5678,innerStack)>>>0,cb);const innerName=read((e.get_esp()>>>0)+12);assert.equal(readAnsi(read(innerName+8)),'??ß');
 for(let i=0;i<100&&e.get_eip();i++)e.run(1000);assert.equal(e.get_eip(),0);assert.equal(e.get_esp()>>>0,innerStack+24);
 const ansiPtr=alloc(16),ansiName=alloc(16);[0x80,0xe9,0].forEach((v,i)=>e.guest_write8(ansiPtr+i,v));write(ansiName,16);write(ansiName+4,0);write(ansiName+8,ansiPtr);write(ansiName+12,0);assert.equal(call(a,30,player,ansiName,0),0);assert.equal(decode(read(outerName+8)),next[0],'callback snapshot is independent of invalidated mirror');
 e.set_esp(outerEsp);e.set_eip(cb);for(let i=0;i<100&&e.get_eip();i++)e.run(1000);assert.equal(e.get_eip(),0);assert.equal(e.get_esp()>>>0,outerStack+24);for(let i=0;i<128;i++)assert.equal(e.guest_read8(enumNeighbor+i),0xa7,'W enum frame does not overwrite discontiguous stack neighbor');
 write(size,0);assert.equal(call(w,21,player,0,size),0x8877001e);const wbuf=alloc(read(size));assert.equal(call(w,21,player,wbuf,size),0);assert.equal(decode(read(wbuf+8)),'€é','ANSI replace invalidates W mirror and converts CP1252');
 assert.equal(e.test_w_names(),1,'only W group mirror remains');assert.equal(call(w,4),0);assert.equal(e.test_w_names(),0,'Close through W destroys canonical owner entities and mirrors');
 assert.equal(call(w,9,player),0x80070057,'already-destroyed player result follows established A handler');
 assert.equal(call(w,2),1);assert.equal(call(a,2),0);
 const clsid=guid([0xd1eb6d20,0x11d08923,0xa000979d,0xcb430ac9]);assert.equal(e.test_dp_factory(clsid,splitIid,out,stack),0);const created=read(out);assert(created);assert.equal(e.test_dp_refs(created),1);assert.equal(call(created,2),0);

 console.log('PASS distinct A/W interface, canonical IUnknown/refcounts, full ABI, exact UTF16 names incl surrogate pair, atomic short-buffer failure and byte lengths');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
