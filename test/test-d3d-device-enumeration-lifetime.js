'use strict';
const assert=require('assert');
const fs=require('fs'), path=require('path');
const {bootRenderHarness}=require('./render-helper');
const apis=require('../src/api_table.json');
const extraWat=String.raw`
  (func (export "device_vtable") (param $version i32) (result i32)
    (if (i32.eq (local.get $version) (i32.const 1)) (then (return (global.get $DX_VTBL_D3D))))
    (if (i32.eq (local.get $version) (i32.const 2)) (then (return (global.get $DX_VTBL_D3D2))))
    (if (i32.eq (local.get $version) (i32.const 3)) (then (return (global.get $DX_VTBL_D3D3))))
    (global.get $DX_VTBL_D3D7))
  (func (export "begin") (param $id i32) (param $sp i32) (param $cb i32) (param $ctx i32)
    (i32.store offset=16 (global.get $reg_base) (local.get $sp))
    (call $dispatch_api_table (local.get $id) (i32.const 0) (local.get $cb) (local.get $ctx)
      (i32.const 0) (i32.const 0) (i32.const 0)))
  (func (export "resume") (param $sp i32) (param $version i32) (param $result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (local.get $sp)
      (select (i32.const 20) (i32.const 28) (i32.eq (local.get $version) (i32.const 7)))))
    (i32.store (global.get $reg_base) (local.get $result))
    (call $d3d_enum_devices_continue))
  (func (export "live") (result i32)
    (i32.sub (global.get $heap_stat_allocs) (global.get $heap_stat_frees)))
`;
(async()=>{
  const {exports:e,memory}=await bootRenderHarness({extraWat,fonts:'none'});
  // The loader installs continuation thunks and CPU state; no app code runs.
  const pe=fs.readFileSync(path.join(__dirname,'binaries/notepad.exe'));
  new Uint8Array(memory.buffer).set(pe,e.get_staging());
  assert.notStrictEqual(e.load_pe(pe.length),-1);
  e.init_dx_com_thunks();
  const stack=e.guest_alloc(2048)+1024, cb=0x12345678, ctx=0x22334455, ret=0x33445566;
  const versions=[1,2,3,7], baseline=e.live();
  const id=v=>apis.find(a=>a.name===`IDirect3D${v===1?'':v}_EnumDevices`).id;
  const start=(v,sp=stack,callback=cb,context=ctx,caller=ret)=>{
    e.guest_write32(sp,caller);e.guest_write32(sp+16,0xdeadbeef);
    e.begin(id(v),sp,callback,context);
    assert.strictEqual(e.get_eip(),callback);
    assert.strictEqual(e.get_esp(),sp+16-(v===7?24:32));
    return e.get_esp();
  };
  const string=p=>{let s='';for(let i=0;i<32;i++){const b=e.guest_read8(p+i);if(!b)return s;s+=String.fromCharCode(b);}throw Error('unterminated');};
  const payload=(v,sp)=>{
    const name=e.guest_read32(sp+(v===7?8:12));
    const context=e.guest_read32(sp+(v===7?16:24));
    return {name:string(name),context};
  };
  for(const outer of versions) for(const inner of versions) {
    const sp=start(outer), before=payload(outer,sp);
    const inside=start(inner,stack-256,cb+16,ctx+16,ret+16);
    e.resume(inside,inner,0);
    assert.strictEqual(e.get_eip(),ret+16);
    assert.deepStrictEqual(payload(outer,sp),before);
    e.resume(sp,outer,1);
    assert.strictEqual(e.get_eip(),cb,'outer callback restored after nested version '+inner);
    assert.strictEqual(payload(outer,e.get_esp()).context,ctx);
    e.resume(e.get_esp(),outer,0);
    assert.strictEqual(e.get_eip(),ret);
    assert.strictEqual(e.get_esp(),stack+16);
  }
  assert.strictEqual(e.live(),baseline,'all nested payload allocations released');
  for(const version of versions) for(let cycle=0;cycle<24;cycle++) {
    start(version);const names=[];
    while(e.get_eip()===cb) {
      assert(names.length<4);
      assert.strictEqual(e.live(),baseline+1,'all payloads share one owned allocation');
      const sp=e.get_esp(), item=payload(version,sp);
      // Windows' device names; games select a device by name (Midtown
      // Madness wants exactly "Direct3D HAL").
      const short={'Direct3D HAL':'hal','RGB Emulation':'rgb','Ramp Emulation':'ramp'}[item.name];
      assert(short,`unexpected device name ${item.name}`);
      item.name=short;
      assert.strictEqual(item.context,ctx);names.push(item.name);
      if(version!==7) {
        const guid=e.guest_read32(sp+4), hw=e.guest_read32(sp+16), hel=e.guest_read32(sp+20);
        assert.strictEqual(e.guest_read32(hw),252);assert.strictEqual(e.guest_read32(hel),252);
        for(const desc of [hw,hel]) for(const offset of [80,136]) assert.strictEqual(e.guest_read32(desc+offset),0xFF,'legacy filter caps unchanged');
        assert.strictEqual(e.guest_read32(guid)>>>0,{ramp:0xf2086b20,rgb:0xa4665c60,hal:0x84e63de0}[item.name]);
        assert.strictEqual(e.guest_read32(hw+8),item.name==='hal'?2:0);
        assert.strictEqual(e.guest_read32(hel+8),item.name==='hal'?0:item.name==='ramp'?1:2);
      } else {
        const caps=e.guest_read32(sp+12);
        if(item.name==='hal')assert.strictEqual(e.guest_read32(caps),0x8aea0);
        for(const offset of [40,96]) assert.strictEqual(e.guest_read32(caps+offset),0x030003FF,'D3D7 callback point/linear stage filter caps');
      }
      e.resume(sp,version,cycle%2?0:1);
    }
    const expected=version===7?['hal','rgb']:version===3?['rgb','hal']:['ramp','rgb','hal'];
    assert.deepStrictEqual(names,cycle%2?expected.slice(0,1):expected);
    assert.strictEqual(e.get_eip(),ret);assert.strictEqual(e.get_esp(),stack+16);
    assert.strictEqual(e.guest_read32(stack+16)>>>0,0xdeadbeef);
    assert.strictEqual(e.live(),baseline);
  }
  console.log('PASS D3D1/2/3/7 device enumeration: 16 nested pairs, payloads, ordering, ABI and 96 balanced cycles');
  // Real guest CALL/RET through generated COM and continuation thunks.
  // Unique code addresses avoid reusing decoded blocks after rewriting bytes.
  const arena=e.guest_alloc(16384), guestBaseline=e.live();
  const le32=n=>[n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255];
  const emit=(addr,bytes)=>bytes.forEach((b,i)=>e.guest_write8(addr+i,b));
  const thunk=v=>{
    const prefix=`IDirect3D${v===1?'':v}_`;
    const first=apis.find(a=>a.name===prefix+'QueryInterface').id;
    return e.guest_read32(e.device_vtable(v)+(id(v)-first)*4);
  };
  let caseIndex=0;
  for(const outer of versions) for(const inner of versions) for(const cancel of [false,true]) {
    const code=arena+caseIndex++*512, outerCb=code+64, innerCb=code+192;
    const outerCtx=code+320, innerCtx=code+352;
    for(let i=0;i<64;i++)e.guest_write8(outerCtx+i,0);
    const outerArg=outer===7?16:24, innerArg=inner===7?16:24;
    const callEnum=(v,callback,context)=>[
      0x68,...le32(context),0x68,...le32(callback),0x6a,0,
      0xb8,...le32(thunk(v)),0xff,0xd0,
    ];
    emit(code,[...callEnum(outer,outerCb,outerCtx),0xc3]);
    emit(outerCb,[
      0x8b,0x44,0x24,outerArg, // mov eax,[esp+context]
      0xff,0x00,              // inc dword [eax]
      // Read the actual callback descriptor before nested enumeration can run:
      // DX7 caps arg is +12; legacy hardware descriptor arg is +16.
      0x8b,0x54,0x24,outer===7?12:16, // mov edx,[esp+caps]
      0x8b,0x8a,...le32(outer===7?40:80), // mov ecx,[edx+line filter]
      0x89,0x48,0x0c,         // mov [context+12],ecx
      0x8b,0x8a,...le32(outer===7?96:136),
      0x89,0x48,0x10,         // mov [context+16],ecx
      0x89,0x60,0x04,         // mov [eax+4],esp (before nested call)
      ...callEnum(inner,innerCb,innerCtx),
      0x8b,0x44,0x24,outerArg,
      0x89,0x60,0x08,         // mov [eax+8],esp (after nested call)
      0xb8,...le32(cancel?0:1),
      0xc2,outerArg,0,        // ret 24 / ret 16
    ]);
    emit(innerCb,[
      0x8b,0x44,0x24,innerArg,0xff,0x00,
      0xb8,...le32(cancel?0:1),0xc2,innerArg,0,
    ]);
    e.guest_write32(stack,0);e.guest_write32(stack+4,0xdeadbeef);
    e.set_esp(stack);e.set_eip(code);
    for(let turn=0;turn<100 && e.get_eip()!==0;turn++)e.run(100);
    const label=`real x86 outer ${outer}, inner ${inner}, cancel ${cancel}`;
    assert.strictEqual(e.get_eip(),0,label+' returned');
    assert.strictEqual(e.get_esp(),stack+4,label+' stack balanced '+JSON.stringify({
      eax:e.get_eax(), outer:e.guest_read32(outerCtx), inner:e.guest_read32(innerCtx),
      thunk:thunk(outer), base:e.get_thunk_base(), end:e.get_thunk_end(),
    }));
    assert.strictEqual(e.get_eax(),0,label+' HRESULT');
    assert.strictEqual(e.guest_read32(stack+4)>>>0,0xdeadbeef);
    const count=v=>v<=2?3:2, outerCount=cancel?1:count(outer);
    assert.strictEqual(e.guest_read32(outerCtx),outerCount,label+' outer callbacks');
    assert.strictEqual(e.guest_read32(innerCtx),outerCount*(cancel?1:count(inner)),label+' inner callbacks');
    assert.strictEqual(e.guest_read32(outerCtx+4),e.guest_read32(outerCtx+8),label+' nested stack');
    for(const offset of [12,16]) assert.strictEqual(e.guest_read32(outerCtx+offset),outer===7?0x030003FF:0xFF,label+' actual x86 callback filter caps');
    assert.strictEqual(e.live(),guestBaseline,label+' allocation balance');
  }
  console.log('PASS 32 real x86 nested enumeration cases through COM and continuation thunks');
})().catch(error=>{console.error(error);process.exitCode=1;});
