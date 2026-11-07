'use strict';
// Generated NE application: every operation is an imported far Pascal call.
const fs=require('fs'),assert=require('assert/strict'),vm=require('vm'),path=require('path');
const root=process.env.WINE_TEST_ROOT||path.resolve(__dirname,'..');
const {neLifecycleImage}=require(root+'/test/helpers/ne-lifecycle-image');
const {createHostImports}=require(root+'/lib/host-imports');
const {VirtualFS}=require(root+'/lib/filesystem');
const {parseShellLink}=require(root+'/lib/shell-link');
const context={createHostImports,console:{log(){},error(){}}};
vm.runInNewContext(fs.readFileSync(root+'/host.js','utf8')+'\n;globalThis.Host=WineAssembly;',context);
function fixture({service='PROGMAN',topic='PROGMAN',invalidInstance=false,uninitialize=false,handleData=false,invalidData=false,async=false,type=0x4050,item=0,command='[CreateGroup("NE DDE")][AddItem("C:\\DEMO\\GAME.EXE -demo","Launch Demo")]',codepage=0}={}){
 const b=Buffer.alloc(0x4000),n=0x80,w=(p,v)=>b.writeUInt16LE(v&65535,p);
 neLifecycleImage({dependencies:['DDEML']}).copy(b,0,0,0x200);
 for(const [o,v] of [[12,1],[0x14,0],[0x18,0xff00],[0x1a,2],[0x42,0x2000],[0x44,0x100],[0x46,0x2000],[0x48,0x230],[0x4a,0x1800],[0x4c,1],[0x4e,0]])w(n+o,v);
 const c=[],rel=[],emit=(...v)=>c.push(...v),word=v=>emit(v&255,v>>>8&255),push=v=>{emit(0x68);word(v)},far=o=>{emit(0x1e);push(o)},mem=o=>{emit(0xff,0x36);word(o)},save=o=>{emit(0xa3);word(o)},call=o=>{emit(0x9a);rel.push([c.length,o]);word(0xffff);word(0)},id=()=>{push(0);mem(0x40)},error=o=>{id();call(20);save(o)};
 emit(0xbb,0x34,0x12,0xbe,0x78,0x56,0xbf,0xbc,0x9a,0xbd,0xad,0x0b);
 emit(0x8b,0xc4);save(0x20);
 far(0x40);push(0);push(0);push(0);push(0x10);push(0);push(0);call(2);save(0x22);
 for(const [str,out] of [[0x100,0x44],[0x140,0x48]]){id();far(str);push(codepage);call(21);save(out);}
 if(invalidInstance){push(0);push(9)}else id();
 push(0);mem(0x44);push(0);mem(0x48);push(0);push(0);call(7);save(0x24);save(0x50);emit(0x89,0x16,0x26,0,0x8b,0xc4);save(0x28);error(0x2a);
 const xact=(str,out,result,typ=type,it=item)=>{
  const length=Buffer.byteLength(str===0x400?command:'[UnknownCommand()]','latin1')+1;
  if(handleData){
   id();far(str);push(0);push(length);push(0);push(0);push(0);push(0);push(1);push(0);call(14);save(0x80);
   push(0);if(invalidData)push(0x42);else mem(0x80);push(0xffff);push(0xffff);
  }else{far(str);push(0);push(length);}
  push(0);mem(0x50);push(0);push(it);push(1);push(typ);push(async?0xffff:0);push(async?0xffff:1000);far(result);call(11);save(out);emit(0x89,0x16);word(out+2);
 };
 xact(0x400,0x54,0x58);error(0x5c);
 xact(0x600,0x60,0x64,0x4050,0);error(0x68);
 if(uninitialize){id();call(3)}else {push(0);mem(0x50);call(8)}save(0x70);
 xact(0x400,0x74,0x7c);error(0x76);
 emit(0x8b,0xc4);save(0x72);
 for(const [modrm,o] of [[0x1e,0x90],[0x36,0x92],[0x3e,0x94],[0x2e,0x96]]){emit(0x89,modrm);word(o);}
 emit(0xc7,6,0x78,0,0x0d,0x60,0xeb,0xfe);
 b.set(c,0x200);w(0x2200,rel.length);rel.forEach(([at,o],i)=>{const p=0x2202+i*8;b[p]=3;b[p+1]=1;w(p+2,at);w(p+4,1);w(p+6,o)});
 for(const [o,s] of [[0x100,service],[0x140,topic],[0x400,command],[0x600,'[UnknownCommand()]']])b.write(s+'\0',0x2300+o,'latin1');
 return b;
}
async function run(module,options={}){
 const host=new context.Host();host.memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});host.logToUI=()=>{};
 const vfs=new VirtualFS();vfs.cwd='C:\\';
 const imp=host.getImports({detached:true,threadId:1,vfs});imp.host.memory=host.memory;let time=0,opens=[];imp.host.real_time_ms=()=>time+=500;imp.host.net_link_open=reason=>{opens.push(reason);return 1};
 const ins=await WebAssembly.instantiate(module,imp);host.instance=ins;const e=ins.exports,b=fixture(options);new Uint8Array(host.memory.buffer).set(b,e.get_staging());assert(e.load_ne(b.length)>0);const d=e.win16_seg_base_of(3),get=o=>e.guest_read8(d+o)|(e.guest_read8(d+o+1)<<8);
 for(let i=0;i<300&&get(0x78)!==0x600d;i++){e.clear_yield();e.run(100)}
 const result={options,complete:get(0x78),initialize:get(0x22),id:get(0x40),service:get(0x44),topic:get(0x48),ax:get(0x24),dx:get(0x26),sp:[get(0x20),get(0x28),get(0x72)],error:get(0x2a),execute:get(0x54),executeDX:get(0x56),ack:get(0x58),executeError:get(0x5c),bad:get(0x60),badAck:get(0x64),badError:get(0x68),closed:get(0x70),afterClose:get(0x74),afterError:get(0x76),opens};
 assert.equal(result.complete,0x600d,'bounded NE completion');assert.deepEqual(result.sp,[0xff00,0xff00,0xff00],'far return and Pascal stack preserved');assert.equal(result.dx,0);assert.equal(result.executeDX,0);
 assert.deepEqual([0x90,0x92,0x94,0x96].map(get),[0x1234,0x5678,0x9abc,0x0bad],'callee-preserved registers survive shell operations');
 return {result,vfs};
}
async function main(){
 const module=await WebAssembly.compile(fs.readFileSync(process.env.WINE_ASSEMBLY_WASM||root+'/build/wine-assembly.wasm'));
 for(const options of [{},{service:'pRoGmAn',topic:'progman'},{service:'OTHER'},{topic:'OTHER'},{service:'PROGMANX'},{invalidInstance:true},{uninitialize:true},{handleData:true},{handleData:true,invalidData:true},{async:true},{type:0x20b0},{item:1},{command:'[UnknownCommand()]'}]){
  const {result:r,vfs}=await run(module,options);console.log(JSON.stringify(r));
  const shell=(!options.service||options.service.toLowerCase()==='progman')&&(!options.topic||options.topic.toLowerCase()==='progman');
  if(options.invalidInstance){assert.equal(r.ax,0);assert.equal(r.error,0x4006);assert.deepEqual(r.opens,[]);continue;}
  if(!shell){assert.equal(r.ax,0);assert.equal(r.error,0x400a);assert.deepEqual(r.opens,[7]);continue;}
  assert(r.ax,'the demonstrated PROGMAN pair connects');assert.equal(r.error,0);assert.deepEqual(r.opens,[],'shell never opens a multiplayer room');
  const accepted=!options.async&&!options.type&&!options.item&&!options.command&&!options.invalidData;
  assert.equal(r.execute,accepted?1:0);assert.equal(r.ack,accepted?0x8000:0);assert.equal(r.executeError,accepted?0:0x4009);
  assert.equal(r.bad,0);assert.equal(r.badAck,0);assert.equal(r.badError,0x4009);assert.equal(r.closed,1);assert.equal(r.afterClose,0);assert.equal(r.afterError,0x400a);
  const link=[...vfs.files].find(([p])=>p.endsWith('launch demo.lnk'));
  if(accepted){assert(link,'real shell command writes shortcut');const parsed=parseShellLink(link[1].data);assert.equal(parsed.target.toLowerCase(),'c:\\demo\\game.exe');assert.equal(parsed.args,'-demo');}
  else assert(!link,'rejected commands do not invent shortcuts');
 }
 console.log('PASS generated NE Win16 PROGMAN selection, real shell execution, negative transactions, teardown and stack state');
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
module.exports={run,fixture};
