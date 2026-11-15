'use strict';

// Independent original PE/NE inputs. Static mode constructs and checks inputs
// only; it makes no claim of native connection publication or FT execution.
const assert = require('node:assert/strict');
const {pairingImages} = require('./test-native-ls32-connection');

const u16 = n => [n & 255, n >>> 8 & 255];
const u32 = n => [...u16(n), ...u16(n >>> 16)];
const SENTINELS = Object.freeze({eax:0x11223344,ebx:0x55667788,
  esi:0x99aabbcc,edi:0xddeeff00,scalar:0x3579,record:0x2468,
  changed:0x7bcd,returns:[0x1234abcd,0x5678dcba]});

function ftImages({index=0,cx=0xfedc0800 | index,bitmap=2,exitBytes=8,
  packetBytes=12,calleeBytes=6,pointerDelta=6,pointerAddress,targetKind='return',
  savedTargetMutation,bodyTrap=false,nested=false,recordSegments=false,noArguments=false,...options}={}) {
  assert([0,1].includes(index));
  assert(Number.isInteger(exitBytes)&&exitBytes>=0&&exitBytes<=56&&exitBytes%4===0);
  assert(Number.isInteger(packetBytes)&&(packetBytes>=12||noArguments&&packetBytes===0)&&packetBytes<=512&&packetBytes%2===0);
  assert(Number.isInteger(pointerDelta)&&pointerDelta>=-128&&pointerDelta<=127);
  assert(['return','trap','loop'].includes(targetKind));
  assert(Number.isInteger(calleeBytes)&&calleeBytes>=0&&calleeBytes<=packetBytes&&calleeBytes%2===0);
  const f=pairingImages(options), {bytes:b,ne,base,raw}=f;
  const imports=['ThunkConnect32','FT_Prolog','FT_Thunk',...Array.from({length:15},(_,i)=>'FT_Exit'+i*4)];
  b.fill(0,raw(0x1900),raw(0x1b80));
  let name=0x1a00;
  for(let i=0;i<imports.length;i++) {
    b.writeUInt32LE(name,raw(0x1900+4*i));
    b.write(imports[i]+'\0',raw(name+2));name+=imports[i].length+3;
  }
  assert(name<0x1b80);
  const iat=name=>base+0x1900+imports.indexOf(name)*4;
  const call=(code,address)=>code.push(0xff,0x15,...u32(address));
  const store=(code,address)=>code.push(0xa3,...u32(address));
  const flags=(code,address)=>code.push(0x9c,0x8f,0x05,...u32(address));
  const thunk=base+0x2200, invoke=base+0x2600, log=base+0x2a00;
  const detachEntry=base+0x2500,detachCode=[];
  for(const arg of [...f.args.slice(0,5),0].reverse())detachCode.push(0x68,...u32(arg));
  call(detachCode,iat('ThunkConnect32'));store(detachCode,log+120);detachCode.push(0xc3);
  b.set(detachCode,raw(0x2500));
  const code=[0xb9,...u32(cx)];
  // The per-module FT prolog is entered with CALL and returns to this body.
  code.push(0xe8,...u32(f.data+68-(thunk+code.length+5)));
  if(nested) {
    // Reenter the same original thunk once from its live compiler body. The
    // inner Exit cleans its own caller arguments before the outer body runs.
    code.push(0xff,0x05,...u32(log+140),0x83,0x3d,...u32(log+140),1,
      0x75,exitBytes/4*5+5);
    for(let i=exitBytes/4;i>0;i--)code.push(0x68,...u32(0xbabe0000+i));
    code.push(0xe8,...u32(thunk-(thunk+code.length+5)),0xff,0x0d,...u32(log+140));
  }
  // Capture the entire documented buffer before the body touches its bitmap.
  code.push(0x89,0x2d,...u32(log),0x89,0x25,...u32(log+4),
    0x8d,0x75,0xc0,0xbf,...u32(log+16),0xb9,16,0,0,0,0xf3,0xa5);
  // A WORD precedes the DWORD pointer; bit 1 must mean WORD offset 2.
  // A six-byte record follows the actual six-byte PASCAL argument packet.
  if(savedTargetMutation!==undefined)code.push(0xc7,0x45,0xcc,...u32(savedTargetMutation));
  if(bodyTrap)code.push(0x0f,0x0b);
  if(noArguments)code.push(0xc7,0x45,0xec,0,0,0,0);
  else {
  code.push(0xc7,0x45,0xec,...u32(bitmap),0x81,0xec,...u32(packetBytes),
    0x66,0xc7,0x04,0x24,...u16(SENTINELS.scalar),
    ...(pointerAddress===undefined?[0x8d,0x44,0x24,pointerDelta&255]:[0xb8,...u32(pointerAddress)]),
    0x89,0x44,0x24,2,
    0x66,0xc7,0x44,0x24,6,...u16(SENTINELS.record),
    0xc7,0x44,0x24,8,0x11,0x22,0x33,0x44);
  }
  flags(code,log+132);call(code,iat('FT_Thunk'));flags(code,log+136);
  store(code,log+80);
  code.push(0x89,0x15,...u32(log+84),0x89,0x0d,...u32(log+88),
    0x89,0x25,...u32(log+92),0x0f,0xb7,0x44,0x24,(6-calleeBytes)&255);
  store(code,log+96);
  if(recordSegments)for(const offset of [12,16]) {
    code.push(0x8b,0x44,0x24,(offset-calleeBytes)&255);store(code,log+144+offset-12);
  }
  // FT returns EAX/EDX separately. The compiler body forms a long in EBX;
  // FT_Exit must use EBX, restore the three saved registers and LEAVE/RET n.
  code.push(0x8b,0x1d,...u32(log+80),0x81,0xe3,0xff,0xff,0,0,
    0xc1,0xe2,16,0x09,0xd3,0x81,0xc4,...u32(packetBytes-calleeBytes));
  flags(code,log+124);
  code.push(0xff,0x25,...u32(iat('FT_Exit'+exitBytes)));
  assert(code.length<0x200);b.set(code,raw(0x2200));
  const caller=[];
  for(const [opcode,value] of [[0xb8,SENTINELS.eax],[0xbb,SENTINELS.ebx],
    [0xbe,SENTINELS.esi],[0xbf,SENTINELS.edi]])caller.push(opcode,...u32(value));
  for(let i=exitBytes/4;i>0;i--)caller.push(0x68,...u32(0xcafe0000+i));
  caller.push(0xe8,...u32(thunk-(invoke+caller.length+5)));
  flags(caller,log+128);
  store(caller,log+100);
  caller.push(0x89,0x1d,...u32(log+104),0x89,0x35,...u32(log+108),
    0x89,0x3d,...u32(log+112),0x89,0x25,...u32(log+116),0xc3);
  assert(caller.length<0x100);b.set(caller,raw(0x2600));
  // Two distinct original FAR targets, relocated normally by the NE loader.
  // Keep KERNEL.651 LibEntry/notification code from the independent LS16 input.
  ne.writeUInt16LE(0xffff,0x920);ne.writeUInt16LE(0xffff,0x924);
  ne.writeUInt16LE(3,0xd00);
  ne.set([3,0,8,0,2,0,0x20,0],0xd02);
  ne.set([3,0,0x20,0,1,0,0x80,1],0xd0a);
  ne.set([3,0,0x24,0,1,0,0x40,2],0xd12);
  // Each original target establishes its own DGROUP, rather than relying on
  // the relay to invent a nonzero DS. These selector immediates are ordinary
  // NE internal selector relocations and are restored before RETF.
  ne.writeUInt16LE(noArguments?1:3,0x800);
  ne.set([2,0,0x85+(recordSegments?24:0),1,2,0,0,0],0x80a);
  ne.set([2,0,0x45+(recordSegments?24:0),2,2,0,0,0],0x812);
  for(let i=0;i<2;i++) {
    // Record actual segments, argument scalar, pointer, SP and copied data.
    // ES is loaded from the passed FAR pointer; the write proves addressing.
    const n=[0x55,0x89,0xe5,0x1e,0x68,0xff,0xff,0x1f,0x8c,0xd0,0xa3,0xb0,0,
      0x8c,0xd8,0xa3,0xb2,0,0x8b,0x46,6,0xa3,0xb4,0,
      0xc4,0x5e,8,0x89,0x1e,0xb6,0,0x8c,0xc0,0xa3,0xb8,0,
      0x26,0x8b,7,0xa3,0xba,0,0x26,0xc7,7,...u16(SENTINELS.changed),
      0x89,0x2e,0xbc,0,0xb8,...u16(SENTINELS.returns[i]),
      0xba,...u16(SENTINELS.returns[i]>>>16),0xb9,0x13,0x57,0x1f,0x5d,0xca,...u16(calleeBytes)];
    if(recordSegments) {
      assert(packetBytes>=20);
      const observed=[];
      for(const [modrm,offset] of [[0xd8,18],[0xc0,20],[0xe0,22],[0xe8,24]])
        observed.push(0x8c,modrm,0x36,0x89,0x46,offset);
      n.splice(3,0,...observed);
    }
    if(noArguments)n.splice(0,n.length,0xb8,...u16(SENTINELS.returns[i]),
      0xba,...u16(SENTINELS.returns[i]>>>16),0xb9,0x13,0x57,0xca,0,0);
    if(targetKind!=='return')n.splice(n.length-5,5,...(targetKind==='trap'?[0x0f,0x0b]:[0xeb,0xfe]));
    ne.set(n,0x200+(i?0x240:0x180));
  }
  return {...f,invoke,thunk,log,detachEntry,index,cx:cx>>>0,bitmap,exitBytes,imports,iat,
    expectedReturn:SENTINELS.returns[index],packetBytes,calleeBytes,pointerDelta,pointerAddress,targetKind,
    savedTargetMutation,bodyTrap,nested,recordSegments,noArguments};
}

// A normal native PE DLL row exercises a real initializing generation and
// ordinary PROCESS_ATTACH/PROCESS_DETACH callbacks, including attach rollback.
// Its DllMain calls the compiled import and FT body; no host settles TRUE.
function ftDllImages({attachResult=1,afterConnectTrap=false,...options}={}) {
  const f=ftImages({module32:'native-ft.dll',...options});
  const original=Array.from(f.bytes.subarray(f.raw(0x2000),f.raw(0x2029)));
  const code=[0x83,0x7c,0x24,8,1,0x74,5,0xe9,
    ...u32(f.detachEntry-(f.entry+12)),...original];
  if(afterConnectTrap)code.push(0x0f,0x0b);
  code.push(0xe8,...u32(f.invoke-(f.entry+code.length+5)),
    0xb8,...u32(attachResult),0xc2,12,0);
  f.bytes.fill(0,f.raw(0x2000),f.raw(0x2100));f.bytes.set(code,f.raw(0x2000));
  // The common entry branches here for PROCESS_DETACH. This exact normal
  // six-argument import performs connection retirement before RET 12.
  const end=f.raw(0x2500)+41;
  assert.equal(f.bytes[end],0xc3);f.bytes.set([0xc2,12,0],end);
  return {...f,attachResult,afterConnectTrap};
}

function fixtureControls() {
  const {inspectNeDll}=require('../lib/ne-image');
  for(const index of [0,1])for(const exitBytes of [0,4,8,12,16,20,24,28,32,36,40,44,48,52,56]) {
    const f=ftImages({index,exitBytes}),n=inspectNeDll(f.ne);
    assert.equal(n.dllEntryOrdinal,4);
    assert.equal(f.cx&255,index,'flags and argument count cannot select another target');
    assert.equal(f.bytes.readUInt32LE(f.raw(0x2201)),f.cx);
    assert.equal(f.ne.readUInt16LE(0xd00),3);
    assert.equal(f.ne.readUInt16LE(0xd10),0x180);
    assert.equal(f.ne.readUInt16LE(0xd18),0x240);
    assert.equal(f.ne[0x380],0x55);assert.equal(f.ne[0x440],0x55);
    assert.equal(f.bytes.readUInt32LE(f.raw(0x271c)),36);
    assert.equal(f.bytes.readUInt32LE(f.raw(0x2720)),68);
    assert(f.bytes.subarray(f.raw(0x2724),f.raw(0x2764)).every(x=>x===0xcc));
    assert.equal(f.imports[2],'FT_Thunk');
    assert(f.imports.includes('FT_Exit'+exitBytes));
  }
  assert(ftImages({nested:true}).nested);
  for(const attachResult of [0,1]) {
    const f=ftDllImages({attachResult});
    assert.equal(f.bytes[f.raw(0x2000)],0x83);
    assert.equal(f.bytes[f.raw(0x2500)+41],0xc2);
  }
  console.log('PASS 30 original synthetic FT PE/NE fixture shapes (static only; no native FT execution claimed)');
}

function checkPublishedRelay(f,read32,read8) {
  const original=offset=>f.bytes.readUInt32LE(f.raw(0x2700+offset));
  for(const offset of [0,4,12,16,20,24,28,32])
    assert.equal(read32(f.data+offset)>>>0,original(offset),'publication preserves LS32 field '+offset);
  const table=read32(f.data+8)>>>0;assert(table,'real relocated NE target table');
  const relay=f.data+68;
  assert.deepEqual(Array.from({length:6},(_,i)=>read8(relay+i)),[0x0f,0xb6,0xd1,0x8b,0x14,0x95],
    'primary byte-sized CL selection and DWORD FAR target lookup');
  assert.equal(read32(relay+6)>>>0,table,'relay uses the actual published NE table');
  assert.equal(read8(relay+10),0x68);
  assert.equal(read32((read32(relay+11)>>>0)+4)>>>0,
    read32((read32(f.iat('FT_Prolog'))>>>0)+4)>>>0,
    'relay and ordinary import use the same compiled native FT_Prolog API');
  assert.equal(read8(relay+15),0xc3,'primary emits a near RET');
  for(const [index,offset] of [[0,0x180],[1,0x240]]) {
    const far=read32(table+4*index)>>>0;
    assert.equal(far&65535,offset,'independent original FAR target '+index);
    assert(far>>>16,'real relocated executable selector');
  }
}

// These expected observations are independent of the native implementation.
// Both local and remote controls must use this same oracle after x86 returns.
function checkObservations(f,read32,neWords) {
  const at=n=>read32(f.log+n)>>>0,B=at(0),A=B-64-f.packetBytes;
  assert.equal(at(4),B-64,'documented FT prolog ESP');
  const saved=offset=>at(16+64+offset);
  for(const [offset,value] of [[-4,SENTINELS.ebx],[-8,SENTINELS.esi],
    [-12,SENTINELS.edi],[-16,f.cx],[-20,0],[-48,SENTINELS.eax]])
    assert.equal(saved(offset),value>>>0,'documented FT frame '+offset);
  for(const offset of [-24,-28,-32,-36,-40,-44,-56,-60,-64])
    assert.equal(saved(offset),0,'unspecified prolog buffer is zeroed '+offset);
  assert(saved(-52)>>>16,'saved original FAR target has a selector');
  assert.equal(saved(-52)&65535,f.index?0x240:0x180,'distinct original target');
  assert.equal(at(80)&65535,f.expectedReturn&65535,'AX independently returned');
  assert.equal(at(84)&65535,f.expectedReturn>>>16,'DX independently returned');
  assert.equal(at(88)&65535,0x5713,'CX independently returned');
  assert.equal(at(92),A+f.calleeBytes,'actual RETF consumes exactly the independently chosen callee bytes');
  if(!f.noArguments)assert.equal(at(96),SENTINELS.changed,'structure copied back through converted pointer');
  assert.equal(at(100),f.expectedReturn,'compiler assembles long; FT_Exit returns EBX');
  assert.equal(at(104),SENTINELS.ebx);assert.equal(at(108),SENTINELS.esi);
  assert.equal(at(112),SENTINELS.edi);
  assert.equal(at(116),B+8+f.exitBytes,'FT_Exit LEAVE/RET n reaches original caller');
  assert.equal(at(132),at(136),'FT_Thunk preserves the suspended PE flags');
  assert.equal(at(124),at(128),'FT_Exit preserves current compiler-body flags');
  if(f.noArguments)return;
  assert.equal(neWords[2],SENTINELS.scalar,'WORD preceding converted pointer is unchanged');
  assert.equal(neWords[5],SENTINELS.record,'callee observes original copied structure');
  assert.equal(neWords[0],neWords[4],'pointer selector equals actual 16-bit SS');
  assert.equal(neWords[3],neWords[6]+12,'pointer offset addresses copied record after callee BP');
  assert.notEqual(neWords[1],0,'NE fixture records its real data selector');
}

const extraWat=String.raw`
  (func (export "ft_test_sreg") (param $id i32) (result i32) (call $seg16_value (local.get $id)))
  (func (export "ft_test_checkpoint") (result f64)
    (f64.convert_i64_u (global.get $win16_bridge_frame)))
  ;; Test-only read of the original NE data. It never supplies execution state.
  (func (export "ft_test_ne_word") (param $header i32) (param $offset i32) (result i32)
    (local $i i32) (local $p i32) (local $a i32)
    (loop $rows
      (local.set $p (call $win16_ls32_row (local.get $i)))
      (if (i32.and (i32.eq (i32.load offset=28 (local.get $p)) (local.get $header))
        (i32.eq (i32.load offset=224 (local.get $p)) (i32.const 1))) (then
        (local.set $a (call $win16_image_span (i32.load offset=4 (local.get $p))
          (i32.add (i32.and (i32.load offset=8 (local.get $p)) (i32.const 0xffff0000)) (local.get $offset))
          (i32.const 2) (i32.const 1)))
        (if (i32.eqz (local.get $a)) (then (unreachable)))
        (return (call $gl16 (local.get $a)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $rows (i32.lt_u (local.get $i) (i32.const 128)))) (unreachable))
`;

async function compiledControls() {
  const fs=require('node:fs');
  assert(process.env.WA_TEST_WASM,'explicit qualified WA_TEST_WASM is required');
  const {createHostImports}=require('../lib/host-imports');
  const {serviceNeGuestYieldSync,serviceNativeFtConnect}=require('../lib/ne-guest-bridge');
  const {createNeLifecycle}=require('../lib/ne-lifecycle');
  const bytes=fs.readFileSync(process.env.WA_TEST_WASM);
  const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
  const imports=createHostImports({getMemory:()=>memory.buffer,renderer:null,resourceJson:{}});
  imports.host.memory=memory;
  const module=await WebAssembly.compile(bytes);
  const e=(await WebAssembly.instantiate(module,imports)).exports;
  const load=f=>{
    new Uint8Array(memory.buffer).set(f.bytes,e.get_staging());
    assert.equal(e.load_pe(f.bytes.length),f.entry);
    e.invalidate_code_range(f.base,0x3000);
  };
  const service=opts=>{
    // Native feature qualification uses the very same future connection
    // service while the production dispatcher remains guarded. Generated
    // originals only; it never supplies scalar success or guest pointers.
    if(process.argv.includes('--qualify-native')) {
      const token=opts.exports.win16_guest_request_token();
      const op=opts.exports.win16_guest_request_field(token,0);
      if(op===5)return serviceNativeFtConnect(opts,createNeLifecycle(opts.exports,memory,[],opts.neInvokeOptions),token);
      if(op===4&&opts.exports.win16_guest_request_field(token,2)===1)
        return require('../lib/ne-invoke').invokeNeFtSync(opts.exports,token,opts.neInvokeOptions);
    }
    return serviceNeGuestYieldSync(opts);
  };
  const drive=(owner,entry,f,stack=0x7408000)=>{
    owner.set_eip(entry);owner.set_esp(stack);owner.guest_write32(stack,0);
    for(let i=0;i<100;i++) {
      owner.run(256);
      const reason=owner.get_yield_reason();
      if(reason===18)service({exports:owner,memoryBuffer:memory.buffer,
        findDllSync:()=>f.ne,neInvokeOptions:{maxBlocks:10000,sliceBlocks:256}});
      else assert.equal(reason,0,'no unrelated yield in bounded FT fixture');
      if(!owner.get_eip())return;
    }
    throw new Error('FT fixture driver budget exhausted');
  };
  const observations=(owner,f)=>{
    const words=Array.from({length:7},(_,i)=>owner.ft_test_ne_word(f.data,0xb0+2*i));
    checkObservations(f,a=>owner.guest_read32(a),words);
  };
  // Release is a second ordinary six-argument PE import, not a host pointer
  // installed into the guest or an out-of-band scalar settlement.
  const detach=(owner,f)=>{
    drive(owner,f.detachEntry,f);
    assert.equal(owner.guest_read32(f.log+120),1,'ordinary compiled detach succeeds');
    const original=ftImages({index:f.index});
    for(let i=0;i<100;i++)assert.equal(owner.guest_read8(f.data+i),
      original.bytes[original.raw(0x2700+i)],'detach restores owned original header/relays');
    assert.equal(createNeLifecycle(owner,memory,[]).liveModule(f.names.module16),false,
      'detach retires connection-owned companion reference');
  };
  // Kept deliberately fail-closed while implementation is in progress: a
  // success claim requires this normal service to publish and execute FT.
  for(const index of [0,1])for(const exitBytes of [0,4,8,12,16,20,24,28,32,36,40,44,48,52,56]) {
    const f=ftImages({index,exitBytes});load(f);drive(e,f.entry,f);
    assert.equal(e.guest_read32(f.result),1,'normal compiled connection returns TRUE');
    checkPublishedRelay(f,a=>e.guest_read32(a),a=>e.guest_read8(a));
    drive(e,f.invoke,f);observations(e,f);detach(e,f);
  }
  for(const index of [0,1])for(const calleeBytes of [0,4,6,12]) {
    const f=ftImages({index,nested:true,calleeBytes});load(f);drive(e,f.entry,f);
    drive(e,f.invoke,f);observations(e,f);assert.equal(e.guest_read32(f.log+140),0);
    assert.equal(e.win16_ft_checkpoint(),0n);detach(e,f);
  }
  for(const index of [0,1]) {
    const f=ftImages({index,packetBytes:20,recordSegments:true});load(f);drive(e,f.entry,f);
    const before=[3,0,4,5,1,2].map(id=>e.ft_test_sreg(id)),fs=e.get_fs_base();
    drive(e,f.invoke,f);observations(e,f);
    assert.deepEqual([e.guest_read32(f.log+144)&65535,e.guest_read32(f.log+144)>>>16,
      e.guest_read32(f.log+148)&65535,e.guest_read32(f.log+148)>>>16],before.slice(0,4),
      'original NE x86 independently records the incoming DS/ES/FS/GS');
    assert.deepEqual([3,0,4,5,1,2].map(id=>e.ft_test_sreg(id)),before,'all PE selectors restored');
    assert.equal(e.get_fs_base(),fs,'PE TEB base restored');detach(e,f);
  }
  for(const index of [0,1])for(const packetBytes of [0,128]) {
    const f=ftImages({index,packetBytes,calleeBytes:packetBytes?6:0,bitmap:packetBytes?2:0,noArguments:!packetBytes});
    load(f);drive(e,f.entry,f);drive(e,f.invoke,f);observations(e,f);detach(e,f);
  }
  const retire=f=>{
    require('../lib/ne-guest-bridge').retireNativeFtConnections({exports:e,memoryBuffer:memory.buffer});
    assert.equal(e.win16_ft_checkpoint(),0n,'all native FT parents retired');
    assert.equal(e.get_sync_msg_depth(),0,'NE execution lease/depth released');
    assert.equal(e.win16_guest_request_valid(e.win16_guest_request_token()),0,'no parked request');
    assert.equal(createNeLifecycle(e,memory,[]).liveModule(f.names.module16),false,'no retained companion');
  };
  for(const options of [
    {cx:0xfedc0802},{bitmap:3},{bitmap:0x80000000},{packetBytes:130},{pointerAddress:0},
    {pointerDelta:12},{pointerDelta:-1},{savedTargetMutation:0},{bodyTrap:true},
    {targetKind:'trap'},{targetKind:'loop'}]) {
    const f=ftImages(options);load(f);drive(e,f.entry,f);
    assert.throws(()=>drive(e,f.invoke,f),undefined,JSON.stringify(options));retire(f);
  }
  for(const mutation of ['header','relay','target','target-other','export','name','request','cancel','invalid-budget']) {
    const f=ftImages();load(f);drive(e,f.entry,f);
    e.set_eip(f.invoke);e.set_esp(0x7408000);e.guest_write32(0x7408000,0);
    for(let i=0;i<100&&e.get_yield_reason()!==18;i++)e.run(256);
    assert.equal(e.get_yield_reason(),18);
    assert.equal(e.win16_ft_retire_next(0),-1,'active compiler frame keeps connection busy');
    const table=e.guest_read32(f.data+8)>>>0;
    if(mutation==='header')e.guest_write32(f.data+4,0);
    if(mutation==='relay')e.guest_write8(f.data+68,0x90);
    if(mutation==='target')e.guest_write32(table,0);
    if(mutation==='target-other')e.guest_write32(table,e.guest_read32(table+4));
    if(mutation==='export')e.guest_write32(f.base+0x1140,0x2704);
    if(mutation==='name')e.guest_write8(f.args[1],0x5a);
    if(mutation==='request')e.guest_write32(e.get_esp(),f.invoke);
    const signal=mutation==='cancel'?{aborted:true,reason:new Error('test FT cancellation')}:undefined;
    assert.throws(()=>service({exports:e,memoryBuffer:memory.buffer,findDllSync:()=>f.ne,
      neInvokeOptions:{maxBlocks:mutation==='invalid-budget'?0:1000,sliceBlocks:256,signal}}),undefined,mutation);
    retire(f);
    assert.equal(e.guest_read32(f.data+8),0,'native owner restores original header field');
    assert.equal(e.guest_read8(f.data+68),0xcc,'native owner restores original relay');
  }
  {
    const f=ftImages();load(f);drive(e,f.entry,f);
    const alien=(await WebAssembly.instantiate(module,imports)).exports;
    alien.init_thread(7,e.get_image_base(),e.get_code_start(),e.get_code_end(),
      e.get_thunk_base(),e.get_thunk_end(),e.get_num_thunks(),0);
    e.set_eip(f.invoke);e.set_esp(0x7408000);e.guest_write32(0x7408000,0);
    for(let i=0;i<10&&!e.win16_ft_checkpoint();i++)e.run(1);
    assert(e.win16_ft_checkpoint(),'first owner has an actual compiler activation');
    assert.throws(()=>drive(alien,f.invoke,f,0x7418000),undefined,'simultaneous foreign thread is busy');
    assert.equal(alien.win16_ft_retire_next(f.base),-1,'foreign thread cannot retire an active compiler owner');
    for(let i=0;i<100&&e.get_eip();i++) {
      if(e.get_yield_reason()===18)service({exports:e,memoryBuffer:memory.buffer,findDllSync:()=>f.ne});
      else e.run(256);
    }
    assert.equal(e.get_eip(),0);observations(e,f);
    drive(alien,f.invoke,f);observations(alien,f);
    assert.equal(alien.win16_ft_checkpoint(),0n);
    drive(e,f.invoke,f);observations(e,f);detach(e,f);
    const foreignMemory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
    const foreignImports=createHostImports({getMemory:()=>foreignMemory.buffer,renderer:null,resourceJson:{}});
    foreignImports.host.memory=foreignMemory;
    const foreign=(await WebAssembly.instantiate(module,foreignImports)).exports;
    assert.equal(foreign.win16_guest_request_valid(e.win16_guest_request_token()),0,'foreign process has no native connection/request authority');
    assert.equal(foreign.win16_ft_retire_next(f.base),0,'foreign process cannot retire this image');
  }
  console.log('PASS local native FT nested/reentry, malformed frame/packet, trap, budget, mutation, cancellation and busy retirement');
  {
    // A failing nested PE callback does not own its parked outer LS request.
    const f=ftImages();load(f);e.set_eip(f.entry);e.set_esp(0x7408000);e.guest_write32(0x7408000,0);e.run(256);
    const outer=e.win16_guest_request_token();assert(e.win16_guest_request_valid(outer));
    const base=e.get_next_dll_addr()>>>0,bad=ftDllImages({base,name:'NESTBAD'});
    bad.bytes.set([0x0f,0x0b],bad.raw(0x2000));new Uint8Array(memory.buffer).set(bad.bytes,e.get_staging());
    const dllMain=e.load_dll(bad.bytes.length,base)>>>0;
    const outcome=require('../lib/dll-loader').callDllMain(e,base,dllMain,()=>{}, {reason:1,maxBlocks:1000,strictReturn:true});
    assert(outcome.fault);assert(e.win16_guest_request_valid(outer),'nested DLL cleanup preserves unrelated parked native request');
    require('../lib/ne-guest-bridge').retireNativeFtConnections({exports:e,memoryBuffer:memory.buffer},f.base);
    assert.equal(e.win16_guest_request_valid(outer),0);
  }
  // A normal PE DLL generation publishes only after its actual DllMain
  // returns. Failure/abandonment retires both the connection and NE alias.
  if(!process.argv.includes('--qualify-native'))for(const options of [
    {},{attachResult:0},{afterConnectTrap:true},{bodyTrap:true},{targetKind:'trap'},{targetKind:'loop'}]) {
    load(ftImages());e.clear_yield();
    const loader=require('../lib/dll-loader'),base=e.get_next_dll_addr()>>>0;
    const f=ftDllImages({base,name:'FTDLL',...options});
    new Uint8Array(memory.buffer).set(f.bytes,e.get_staging());e.set_next_dll_explicit_root(1);
    const dllMain=e.load_dll(f.bytes.length,base)>>>0,index=e.get_last_loaded_dll_index();
    assert.equal(dllMain,f.entry);assert(index>=0);
    const at=e.get_dll_lifecycle_table()+index*64,native=new DataView(memory.buffer),generation=native.getUint32(at+4,true);
    loader.patchDllImports(e,memory.buffer,[{name:'native-ft.dll',bytes:f.bytes}],
      [{loadAddr:base,dllMain,index,generation}],()=>{});
    const context=()=>['eip','esp','ebp','ebx','esi','edi','sreg_cs','sreg_ds','sreg_es','sreg_ss'].map(k=>e['get_'+k]());
    const before=context();
    const invoke=reason=>loader.callDllMain(e,base,dllMain,()=>{}, {reason,maxBlocks:1000,strictReturn:true,
      onLoadLibraryYield:()=>require('../lib/process-boot').serviceLoadLibraryYieldSync({exports:e,memoryBuffer:memory.buffer,findDllSync:()=>f.ne,
        neInvokeOptions:{maxBlocks:1000,sliceBlocks:256}})});
    const outcome=invoke(1),success=Object.keys(options).length===0;
    assert.equal(!!(outcome.completed&&outcome.returnValue),success,JSON.stringify({options,outcome,fault:outcome.fault?.stack}));
    assert.deepEqual(context(),before,'normal PE loader restores its whole caller context');
    assert.equal(e.win16_ft_checkpoint(),0n);
    if(success){
      observations(e,f);
      native.setUint32(at+4,generation+1,true);
      try {assert.throws(()=>drive(e,f.invoke,f),undefined,'stale PE generation rejects original FT entry');}
      finally {native.setUint32(at+4,generation,true);}
      assert.equal(e.win16_ft_checkpoint(),0n,'stale generation did not acquire a compiler owner');
      e.clear_yield();assert.equal(invoke(0).completed,true);
    }
    assert.equal(createNeLifecycle(e,memory,[]).liveModule(f.names.module16),false,'normal DLL success-detach/failed-attach retirement');
    assert.equal(e.guest_read32(f.data+8),0);assert.equal(e.guest_read8(f.data+68),0xcc);
  }
  if(process.argv.includes('--local-only')) {console.log('PASS native feature local controls');return;}
  {
    const {ThreadManager}=require('../lib/thread-manager');
    for(const index of [0,1]) {
      const f=ftImages({index,name:'COOPFT'});load(f);
      const secondary=(await WebAssembly.instantiate(module,imports)).exports;
      secondary.init_thread(1,e.get_image_base(),e.get_code_start(),e.get_code_end(),
        e.get_thunk_base(),e.get_thunk_end(),e.get_num_thunks(),0);
      const manager=new ThreadManager(module,memory,{exports:e},()=>imports,{});
      const thread={instance:{exports:secondary},state:'active',tid:1};
      manager.threads=new Map([[123,thread]]);manager._runningThreadHandle=0;
      const owner=manager.cooperativeCallbackExports(thread);
      drive(owner,f.entry,f);drive(owner,f.invoke,f);observations(owner,f);detach(owner,f);
      thread.state='exited';
      assert.throws(()=>owner.run(1),/retired/,'cooperative retirement rejects execution');
    }
  }
  {
    const {GuestThreadHost}=require('../lib/guest-thread-host');
    const path=require('node:path');
    for(const index of [0,1]) {
      const f=ftImages({index,name:'WORKERFT'});
      const host=new GuestThreadHost({memory,module,hostImports:imports.host,
        sigs:require('../lib/host-import-sigs.generated.json').sigs,
        workerUrl:path.resolve(__dirname,'../lib/guest-worker.js'),clockIntervalMs:0,
        findDll:async()=>f.ne,log:()=>{}});
      const remote=(name,...args)=>host.callExport(name,...args);
      const run=async entry=>{
        await remote('set_eip',entry);await remote('set_esp',0x7408000);
        await remote('guest_write32',0x7408000,0);
        for(let i=0;i<100;i++) {
          const result=await host.link.slice(256);assert(!result.trapped,JSON.stringify(result));
          if(!await remote('get_eip'))return;
        }
        throw new Error('real Worker FT fixture budget exhausted');
      };
      try {
        await host.start();await host.loadPe(f.bytes,'original-synthetic-ft.exe');
        await run(f.entry);
        assert.equal(await remote('guest_read32',f.result),1,'normal Worker connection');
        await run(f.invoke);
        // Data is read only while the Worker is idle at its completed return;
        // no host executes or restores a context belonging to the Worker.
        const values=new Map();
        for(let i=0;i<=136;i+=4)values.set(f.log+i,await remote('guest_read32',f.log+i));
        const words=[];
        for(let i=0;i<7;i++)words.push(await remote('ft_test_ne_word',f.data,0xb0+2*i));
        checkObservations(f,a=>values.get(a),words);
        await run(f.detachEntry);
        assert.equal(await remote('guest_read32',f.log+120),1,'normal Worker detach');
      } finally {await host.stop();}
    }
    for(const mode of ['trap','body-trap','budget','connected-retire','busy-retire','failed-ne-attach']) {
      const f=ftImages({name:'WORKFAIL',targetKind:mode==='trap'?'trap':mode==='budget'?'loop':'return',
        bodyTrap:mode==='body-trap',reject:mode==='failed-ne-attach'});
      const host=new GuestThreadHost({memory,module,hostImports:imports.host,
        sigs:require('../lib/host-import-sigs.generated.json').sigs,
        workerUrl:path.resolve(__dirname,'../lib/guest-worker.js'),clockIntervalMs:0,
        findDll:async()=>f.ne,log:()=>{}});
      const remote=(name,...args)=>host.callExport(name,...args);
      const enter=async entry=>{await remote('set_eip',entry);await remote('set_esp',0x7408000);await remote('guest_write32',0x7408000,0);};
      let link;
      try {
        await host.start();link=host.link;await host.loadPe(f.bytes,'original-ft-failure.exe');
        await enter(f.entry);let result=await link.slice(256);
        if(mode==='failed-ne-attach')assert(result.trapped,'Worker refuses failed original companion attach');
        else {
          assert(!result.trapped,JSON.stringify(result));
          if(mode!=='connected-retire') {
            await enter(f.invoke);
            if(mode==='busy-retire') {
              // One actual block creates Prolog before the FT_Thunk CALL.
              for(let i=0;i<10&&!await remote('ft_test_checkpoint');i++)await remote('run',1);
              assert(await remote('ft_test_checkpoint'),'Worker actually entered original Prolog');
              assert.equal(await remote('win16_ft_retire_next',0),-1,'Worker has a live native compiler owner');
            } else {
              result=await link.slice(256);assert(result.trapped,'Worker propagates '+mode);
              assert.equal(await remote('guest_read32',f.data+8),0,'Worker trap/budget cleanup unpublishes');
            }
          }
        }
      } finally {await host.stop();}
      assert.equal(e.guest_read32(f.data+8),0,'joined Worker retirement restores exact connection bytes: '+mode);
      assert.equal(e.guest_read8(f.data+68),0xcc);
      assert(link._loaderRetirementReceipt?.retired,'actual endpoint retirement acknowledgment');
    }

  }
  console.log('PASS actual original x86 FT relay: local/cooperative/real Worker, distinct targets, frame, conversion, returns and detach');
}

if(require.main===module)(async()=>{
  fixtureControls();
  if(process.argv.includes('--compiled'))await compiledControls();
})().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={ftImages,ftDllImages,fixtureControls,checkPublishedRelay,checkObservations,compiledControls,SENTINELS,extraWat};
