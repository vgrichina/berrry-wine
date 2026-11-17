'use strict';

// Importing this module never loads a shared helper, runtime or native guest.
// Call authorityTests only after the source/build/runtime lane is released.
const assert = require('node:assert/strict');
const UNKNOWN = '0000000000000000c000000000000046';
const DISPATCH = '0004020000000000c000000000000046';
const ABSENT = '897a2125abcd99449900112233445566';

function authorityTests() {
 const {test} = require('node:test');
 const {OwnedComAuthority} = require('../lib/com-owned-channel');
 const descriptor = (generation='1') => ({thread:1,generation,source:'11'.repeat(32),module:'22'.repeat(32)});
 function fixture() {
  const a=new OwnedComAuthority(),s=a.connect('server'),c=a.connect('caller'),foreign=a.connect('foreign');
  const so=descriptor(),co=descriptor(),fo=descriptor();
  for(const [session,owner] of [[s,so],[c,co],[foreign,fo]])a.registerOwner(session,owner);
  const ref=a.prepareExport(s,so,UNKNOWN,0,'33'.repeat(16));a.commitExport(s,so,ref);
  const lease=a.consume(c,co,ref);
  const query=(iid=DISPATCH)=>a.queryInterface(c,co,ref,lease.token,iid);
  const exported=(iid=DISPATCH,identity='33'.repeat(16))=>{
   const result=a.prepareExport(s,so,iid,0,identity);a.commitExport(s,so,result);return result;
  };
  const complete=(ticket,hresult,reference=null)=>a.complete(s,so,ticket,{hresult,status:0,bytes:new Uint8Array(),reference});
  return {a,s,c,foreign,so,co,fo,ref,lease,query,exported,complete};
 }
 const error=(fn,code)=>assert.throws(fn,e=>e.code===code);
 test('authenticated QI reaches the actual exporter owner as a distinct control request',()=>{
  const f=fixture(),ticket=f.query(),r=f.a.take(f.s,f.so);
  assert.equal(r.ticket,ticket);assert.equal(r.kind,'queryInterface');assert.equal(r.iid,DISPATCH);
  assert.equal(r.reference.ipid,f.ref.ipid);assert.equal(f.a.take(f.foreign,f.fo),null);
 });
 test('unsupported IID preserves exporter HRESULT and has no returned lease',()=>{
  const f=fixture(),ticket=f.query(ABSENT);f.a.take(f.s,f.so);f.complete(ticket,0x80004002);
  const reply=f.a.poll(f.c,f.co,ticket);assert.equal(reply.hresult,0x80004002);
  assert.equal(reply.reference,null);assert.equal(reply.lease,null);
 });
 test('successful QI transfers an owned lease with the same OXID/OID and distinct IPID',()=>{
  const f=fixture(),ticket=f.query();f.a.take(f.s,f.so);const ref=f.exported();f.complete(ticket,0,ref);
  const reply=f.a.poll(f.c,f.co,ticket);assert.equal(reply.hresult,0);
  assert.equal(reply.reference.oid,f.ref.oid);assert.equal(reply.reference.oxid,f.ref.oxid);
  assert.notEqual(reply.reference.ipid,f.ref.ipid);assert.deepEqual(reply.lease.reference,reply.reference);
  f.a.proxy(f.c,f.co,ref,reply.lease.token);error(()=>f.a.consume(f.c,f.co,ref),'EDISCONNECTED');
  f.a.releaseProxy(f.c,f.co,ref,reply.lease.token);assert.equal(f.a.take(f.s,f.so).kind,'retire');
 });
 for(const field of ['token','session','generation','source','module'])test('QI rejects foreign or stale '+field,()=>{
  const f=fixture();let session=f.c,owner=f.co,token=f.lease.token;
  if(field==='token')token='44'.repeat(16);
  if(field==='session'){session=f.foreign;owner=f.fo;}
  if(field==='generation')owner={...owner,generation:'2'};
  if(field==='source')owner={...owner,source:'44'.repeat(32)};
  if(field==='module')owner={...owner,module:'44'.repeat(32)};
  error(()=>f.a.queryInterface(session,owner,f.ref,token,DISPATCH),'ESTALE');assert.equal(f.a.take(f.s,f.so),null);
 });
 test('GUID_NULL is a request for actual server QI, not invented support or refusal',()=>{
  const f=fixture(),ticket=f.query('0'.repeat(32));assert.equal(f.a.take(f.s,f.so).iid,'0'.repeat(32));
  f.complete(ticket,0x80004002);assert.equal(f.a.poll(f.c,f.co,ticket).hresult,0x80004002);
 });
 test('successful nonzero actual QI HRESULT is preserved',()=>{
  const f=fixture(),ticket=f.query();f.a.take(f.s,f.so);f.complete(ticket,1,f.exported());
  assert.equal(f.a.poll(f.c,f.co,ticket).hresult,1);
 });
 for(const iid of [null,'',0,'f'.repeat(31),'G'.repeat(32)])test('QI validates GUID '+String(iid),()=>{
  const f=fixture();error(()=>f.query(iid),'EINVAL');assert.equal(f.a.take(f.s,f.so),null);
 });
 for(const variant of ['wrongIID','wrongIdentity','uncommitted','tableStrong','failureWithReference','successWithoutReference'])
 test('QI rejects malformed successful/failing export '+variant,()=>{
  const f=fixture(),ticket=f.query();f.a.take(f.s,f.so);let ref,hr=0;
  if(variant==='uncommitted')ref=f.a.prepareExport(f.s,f.so,DISPATCH,0,'33'.repeat(16));
  else if(variant==='tableStrong'){ref=f.a.prepareExport(f.s,f.so,DISPATCH,1,'33'.repeat(16));f.a.commitExport(f.s,f.so,ref);}
  else if(variant!=='successWithoutReference')ref=f.exported(variant==='wrongIID'?ABSENT:DISPATCH,variant==='wrongIdentity'?'55'.repeat(16):'33'.repeat(16));
  if(variant==='failureWithReference')hr=0x80004002;
  assert.throws(()=>f.complete(ticket,hr,ref));assert.equal(f.a.poll(f.c,f.co,ticket),null);
 });
 test('live call pins canonical identity after the original proxy lease releases',()=>{
  const f=fixture(),ticket=f.query();f.a.releaseProxy(f.c,f.co,f.ref,f.lease.token);
  const r=f.a.take(f.s,f.so);assert.equal(r.kind,'queryInterface');
  const ref=f.exported();assert.equal(ref.oid,f.ref.oid);f.complete(ticket,0,ref);
  const reply=f.a.poll(f.c,f.co,ticket);f.a.releaseProxy(f.c,f.co,ref,reply.lease.token);
  const retired=[f.a.take(f.s,f.so),f.a.take(f.s,f.so)];assert(retired.every(r=>r.kind==='retire'));
  for(const r of retired)f.a.complete(f.s,f.so,r.ticket);
  assert.equal(f.a.exports.size,0);assert.equal(f.a.requests.size,0);
 });
 for(const stage of ['queued','executing','completed'])test('explicit QI cancellation releases '+stage+' ownership',()=>{
  const f=fixture(),ticket=f.query();let ref;
  if(stage!=='queued')f.a.take(f.s,f.so);
  if(stage==='completed'){ref=f.exported();f.complete(ticket,0,ref);}
  f.a.cancelQuery(f.c,f.co,ticket);
  error(()=>f.a.poll(f.c,f.co,ticket),'ESTALE');
  if(stage==='executing'){ref=f.exported();f.complete(ticket,0,ref);}
  error(()=>f.a.poll(f.c,f.co,ticket),'ESTALE');
  if(ref){const retired=f.a.take(f.s,f.so);assert.equal(retired.kind,'retire');f.a.complete(f.s,f.so,retired.ticket);}
  assert.equal(f.a.exports.size,1);assert.equal(f.a.requests.size,0);
 });
 for(const stage of ['queued','executing','completed'])test('caller retirement drops '+stage+' QI and never delivers to replacement',()=>{
  const f=fixture(),ticket=f.query();let ref;
  if(stage!=='queued')f.a.take(f.s,f.so);
  if(stage==='completed'){ref=f.exported();f.complete(ticket,0,ref);}
  f.a.retireOwner(f.c,f.co);f.a.registerOwner(f.c,descriptor('2'));
  if(stage==='executing'){ref=f.exported();f.complete(ticket,0,ref);}
  error(()=>f.a.poll(f.c,descriptor('2'),ticket),'ESTALE');
  const work=[];for(let row;(row=f.a.take(f.s,f.so));)work.push(row);
  assert(work.every(r=>r.kind==='retire'));for(const r of work)f.a.complete(f.s,f.so,r.ticket);
  assert.equal(f.a.exports.size,0);assert.equal(f.a.requests.size,0);
 });
 test('server retirement completes pending QI as disconnected',()=>{
  const f=fixture(),ticket=f.query();f.a.take(f.s,f.so);f.a.retireOwner(f.s,f.so);
  error(()=>f.a.poll(f.c,f.co,ticket),'EDISCONNECTED');
 });
 test('unpolled successful reply can be cancelled after server retirement',()=>{
  const f=fixture(),ticket=f.query();f.a.take(f.s,f.so);f.complete(ticket,0,f.exported());
  f.a.retireOwner(f.s,f.so);f.a.cancelQuery(f.c,f.co,ticket);
  error(()=>f.a.poll(f.c,f.co,ticket),'ESTALE');assert.equal(f.a.requests.size,0);
 });
 test('server retirement discards an already cancelled executing QI ticket',()=>{
  const f=fixture(),ticket=f.query();f.a.take(f.s,f.so);f.a.cancelQuery(f.c,f.co,ticket);
  f.a.retireOwner(f.s,f.so);assert.equal(f.a.requests.size,0);
  error(()=>f.a.poll(f.c,f.co,ticket),'ESTALE');
 });
 test('concurrent QIs retain separate reply ownership and cannot cross-complete',()=>{
  const f=fixture(),one=f.query(),two=f.query(ABSENT),r1=f.a.take(f.s,f.so),r2=f.a.take(f.s,f.so);
  error(()=>f.a.complete(f.foreign,f.fo,one,{hresult:0,status:0,bytes:new Uint8Array(),reference:f.exported()}),'ESTALE');
  f.complete(r2.ticket,0x80004002);f.complete(r1.ticket,0,f.exported());
  assert.equal(f.a.poll(f.c,f.co,two).hresult,0x80004002);assert.equal(f.a.poll(f.c,f.co,one).hresult,0);
 });
}

function proxyTests(){
 const {test}=require('node:test');
 const {ComOwnedProxyHost}=require('../lib/com-owned-proxy');
 const {HResult,HR}=require('../lib/com-standard-marshaler');
 function fixture(){
  const words=new Map();let next=1024,token=7n,iid=DISPATCH,retired=false,polls=0,queries=0,cancels=0,drains=0;
  let resume;const gate=new Promise(resolve=>{resume=resolve;});let gated=false;
  const c={exports:{com_bridge_vtable:()=>2048,com_owner_token:()=>token},
   check:expected=>{if(retired)throw new Error('owner replaced');if(expected!==undefined&&expected!==token)throw new Error('token replaced');},
   word:address=>words.get(address)||0,putWord:(address,value)=>words.set(address,value)};
  const lease={token:'77'.repeat(16),reference:{iid:UNKNOWN,oxid:'11'.repeat(8),oid:'22'.repeat(8),ipid:'33'.repeat(16),publicRefs:1}};
  const transport={queryInterface:async(ref,ownedLease,asked)=>{queries++;assert.equal(ref,lease.reference);assert.equal(ownedLease,lease);assert.equal(asked,DISPATCH);return 'ticket';},
   poll:async()=>{polls++;if(gated)await gate;return polls===1?null:{hresult:HR.NOINTERFACE};},
   cancelQuery:async()=>{cancels++;}};
  const m={c,transport,allocate:()=>{const address=next;next+=32;return address;},free:()=>{},guid:()=>iid,drain:async()=>{drains++;}};
  const proxy=new ComOwnedProxyHost(m,{unknown:1,channel:2});
  const root=proxy.object('unknown',{identity:'identity',interfaces:new Map(),leases:[lease],retiring:false});
  proxy.identities.set(root.identity,root);words.set(80,0x1234);
  return {proxy,root,words,c,transport,gate:()=>{gated=true;},resume,
   replaceToken:()=>{token++;},replaceIID:()=>{iid=ABSENT;},retire:()=>{retired=true;},
   stats:()=>({queries,polls,cancels,drains}),call:()=>proxy.operation(4,[root.address,64,80])};
 }
 test('uncached proxy QI authenticates the lease and preserves genuine server failure/null output',async()=>{
  const f=fixture();assert.equal(await f.call(),HR.NOINTERFACE);assert.equal(f.words.get(80),0);
  assert.equal(f.root.refs,1);assert.deepEqual(f.stats(),{queries:1,polls:2,cancels:0,drains:1});
 });
 for(const args of [[0,80],[64,0]])test('public QI pointer error never starts remote work '+args.join('/'),async()=>{
  const f=fixture();assert.equal(await f.proxy.operation(4,[f.root.address,...args]),HR.POINTER);
  assert.equal(f.stats().queries,0);if(args[1])assert.equal(f.words.get(80),0);
 });
 test('ordinary disconnected transport failure balances the temporary proxy reference',async()=>{
  const f=fixture();f.transport.queryInterface=async()=>{throw new HResult(HR.DISCONNECTED);};
  assert.equal(await f.call(),HR.DISCONNECTED);assert.equal(f.root.refs,1);assert.equal(f.words.get(80),0);
 });
 test('polling failure cancels pending work on the same owner',async()=>{
  const f=fixture();f.transport.poll=async()=>{throw new HResult(HR.DISCONNECTED);};
  assert.equal(await f.call(),HR.DISCONNECTED);assert.equal(f.stats().cancels,1);assert.equal(f.root.refs,1);
 });
 test('IUnknown import retains canonical proxy identity without inventing a typed proxy',async()=>{
  const f=fixture(),reference={...f.root.leases[0].reference,ipid:'44'.repeat(16)};
  const lease={token:'88'.repeat(16),reference};
  const identity=reference.oxid+':'+reference.oid;
  f.proxy.identities.clear();f.root.identity=identity;f.proxy.identities.set(identity,f.root);
  f.proxy.m.guid=()=>UNKNOWN;
  f.proxy.m.factory=async()=>{throw new Error('IUnknown has no typed proxy factory');};
  let consumed=0;f.transport.consume=async ref=>{assert.equal(ref,reference);consumed++;return lease;};
  assert.equal(await f.proxy.unmarshalReference(reference,64,80),0);
  assert.equal(f.words.get(80),f.root.address);assert.equal(f.root.refs,2);
  assert.equal(f.root.interfaces.size,0);assert.equal(consumed,1);assert.equal(f.root.leases.length,2);
 });
 test('failed genuine PS lookup releases the authority-transferred QI lease',async()=>{
  const f=fixture(),reference={...f.root.leases[0].reference,iid:DISPATCH};
  const lease={token:'88'.repeat(16),reference},released=[];
  f.proxy.m.factory=async()=>{throw new HResult(HR.NOINTERFACE);};
  f.transport.releaseProxy=async row=>released.push(row);
  assert.equal(await f.proxy.unmarshalReference(reference,64,80,lease),HR.NOINTERFACE);
  assert.deepEqual(released,[lease]);assert.equal(f.words.get(80),0);assert.equal(f.root.refs,1);
 });
 for(const change of ['replaceToken','replaceIID','retire'])test('awaited QI refuses '+change+' without restoring or releasing an abandoned frame',async()=>{
  const f=fixture();f.gate();const work=f.call();await Promise.resolve();await Promise.resolve();
  f[change]();f.resume();await assert.rejects(work,/replaced|changed/);
  assert.equal(f.words.get(80),0);assert.equal(f.root.refs,2);assert.equal(f.stats().cancels,0);
 });
}

function exporterTests(){
 const {test}=require('node:test');
 const {ComStandardMarshaler,HR,HResult}=require('../lib/com-standard-marshaler');
 function fixture(hr=0,pointer=512){
  const memory=new ArrayBuffer(4096),view=new DataView(memory),calls=[],completed=[],released=[];
  let next=2048,taken=false,marshaled=0,token=7n;
  const ref={iid:UNKNOWN,oxid:'11'.repeat(8),oid:'22'.repeat(8),ipid:'33'.repeat(16),publicRefs:1};
  const returned={...ref,iid:DISPATCH,ipid:'44'.repeat(16)};
  const c={exports:{guest_alloc:size=>{const address=next;next+=size+4;return address;},guest_free:()=>{}},check:()=>{},
   view:(address,size)=>new DataView(memory,address,size),word:address=>view.getUint32(address,true),putWord:(address,value)=>view.setUint32(address,value,true),
   call:async(object,slot,args=[])=>{calls.push({object,slot});
    if(slot===0){assert.equal(object,256);view.setUint32(args[1],pointer,true);return hr;}
    if(slot===2){released.push(object);return 0;}throw new Error('unexpected stub substitution');}};
  const request={kind:'queryInterface',reference:ref,iid:DISPATCH,ticket:'request'};
  const transport={take:async()=>{if(taken)return null;taken=true;return request;},
   complete:async(ticket,response)=>completed.push({ticket,response}),releaseData:async reference=>released.push(reference)};
  const m=new ComStandardMarshaler({continuation:c,transport,api:{}});
  m.exports.set(ref.ipid,{reference:ref,canonical:256,stub:768,objectKey:{exports:1}});
  m.marshalReference=async(iidAddress,object)=>{assert.equal(m.guid(iidAddress),DISPATCH);assert.equal(object,pointer);marshaled++;return {hresult:0,reference:returned};};
  return {m,c,request,returned,calls,completed,released,marshaled:()=>marshaled,replaceToken:()=>{token++;}};
 }
 test('exporter invokes canonical guest IUnknown QI and marshals the owned returned interface',async()=>{
  const f=fixture();await f.m.drain();assert.deepEqual(f.calls,[{object:256,slot:0},{object:512,slot:2}]);
  assert.equal(f.marshaled(),1);assert.equal(f.completed[0].response.reference,f.returned);
  assert.equal(f.completed[0].response.hresult,0);assert.deepEqual(f.released,[512]);
 });
 for(const hr of [0x80004002,0x80004001,0x8007000e])test('actual guest QI failure is propagated '+hr.toString(16),async()=>{
  const f=fixture(hr,0);await f.m.drain();assert.equal(f.marshaled(),0);
  assert.equal(f.completed[0].response.hresult,hr);assert.equal(f.completed[0].response.reference,null);
 });
 test('failed server QI with accidental output releases it without publishing it',async()=>{
  const f=fixture(HR.NOINTERFACE);await f.m.drain();assert.equal(f.marshaled(),0);
  assert.deepEqual(f.released,[512]);assert.equal(f.completed[0].response.reference,null);
 });
 test('successful guest QI with null output fails and does not invent an interface',async()=>{
  const f=fixture(0,0);await f.m.drain();assert.equal(f.marshaled(),0);assert.equal(f.completed[0].response.hresult,HR.NOINTERFACE);
 });
 test('genuine marshaler failure propagates and balances the QI reference',async()=>{
  const f=fixture();f.m.marshalReference=async()=>({hresult:0x80040155,reference:null});await f.m.drain();
  assert.equal(f.completed[0].response.hresult,0x80040155);assert.deepEqual(f.released,[512]);
 });
 test('different canonical identity is rejected and its owned packet released',async()=>{
  const f=fixture();f.returned.oid='55'.repeat(8);await f.m.drain();
  assert.equal(f.completed[0].response.hresult,HR.INVALIDOBJREF);assert.equal(f.completed[0].response.reference,null);
  assert.deepEqual(f.released,[f.returned,512]);
 });
 test('trapped actual QI is not converted to a reply or abandoned-frame release',async()=>{
  const f=fixture();f.c.call=async()=>{throw new Error('actual guest trap');};await assert.rejects(f.m.drain(),/guest trap/);
  assert.equal(f.completed.length,0);assert.deepEqual(f.released,[]);
 });
 test('ordinary guest HRESULT exception remains a failure response',async()=>{
  const f=fixture();f.c.call=async()=>{throw new HResult(HR.DISCONNECTED);};await f.m.drain();
  assert.equal(f.completed[0].response.hresult,HR.DISCONNECTED);assert.deepEqual(f.released,[]);
 });
 test('IUnknown identity export refuses a typed invocation without inventing a stub',async()=>{
  const f=fixture();f.request.kind='invoke';f.m.exports.get(f.request.reference.ipid).stub=0;
  await f.m.drain();assert.equal(f.completed[0].response.hresult,HR.NOINTERFACE);
  assert.deepEqual(f.calls,[]);assert.equal(f.marshaled(),0);
 });
}

// The call wrapper validates x86 stdcall stack cleanup and all callee-saved
// registers. A sentinel output verifies failure clears ppv at the public ABI.
const checkedQuerySource = String.raw`
__attribute__((naked)) H CALL checkedQuery(P object,const GUID*iid,P*out){
 __asm__ volatile("pushl %ebx\n pushl %esi\n pushl %edi\n pushl %ebp\n"
  "movl $0x13572468,%ebx\n movl $0x24681357,%esi\n movl $0x76543210,%edi\n movl %esp,%ebp\n"
  "pushl 28(%ebp)\n pushl 24(%ebp)\n pushl 20(%ebp)\n"
  "movl 20(%ebp),%eax\n movl (%eax),%eax\n calll *(%eax)\n"
  "cmpl %esp,%ebp\n jne 1f\n cmpl $0x13572468,%ebx\n jne 1f\n"
  "cmpl $0x24681357,%esi\n jne 1f\n cmpl $0x76543210,%edi\n jne 1f\n"
  "jmp 2f\n 1: movl $0x8004fffc,%eax\n 2: movl %ebp,%esp\n popl %ebp\n popl %edi\n popl %esi\n popl %ebx\n retl $12");
}
`;

const providerMetadataSource=String.raw`
typedef unsigned long U;typedef long H;typedef void*P;
#define CALL __stdcall
#define API __declspec(dllimport) __stdcall
typedef struct{U a;unsigned short b,c;unsigned char d[8];} GUID;
P API LoadLibraryA(const char*);P API GetProcAddress(P,const char*);U API FreeLibrary(P);
H API CoInitialize(P);void API CoUninitialize(void);H API CoGetPSClsid(const GUID*,GUID*);
P API CreateThread(P,U,P,P,U,U*);U API WaitForSingleObject(P,U);U API GetExitCodeThread(P,U*);U API CloseHandle(P);
void API OutputDebugStringA(const char*);void API ExitProcess(U);
static const GUID provider={0xf4817e4b,0x04b6,0x11d3,{0x88,0x62,0,0xc0,0x4f,0x72,0xf3,3}};
static const GUID media={0x91814ebf,0xb5f0,0x11d2,{0x80,0xb9,0,0x10,0x4b,0x1f,0x6c,0xea}};
static const GUID info={0xe1b9357f,0x24b9,0x11d3,{0x88,0xb2,0,0xc0,0x4f,0x72,0xf3,3}};
static const unsigned short kernelPath[]=L"C:\\Program Files\\Common Files\\InstallShield\\Engine\\6\\Intel 32\\IKernel.exe";
static volatile U completed;static U result[24];static char providerName[80],methodName[80];
void check(int ok,U code){if(!ok)ExitProcess(code);}
void release(P p){typedef U(CALL*Release)(P);if(p)((Release)(*(P**)p)[2])(p);}
void copyName(char*out,const unsigned short*in){U i=0;if(in)while(in[i]&&i<79){out[i]=in[i]<128?(char)in[i]:'?';i++;}out[i]=0;}
U CALL inspect(P unused){
 typedef H(CALL*Register)(void);typedef H(CALL*LoadTL)(const unsigned short*,P*);
 typedef H(CALL*RegisterTL)(P,const unsigned short*,const unsigned short*);
 typedef H(CALL*GetInfo)(P,const GUID*,P*);
 P module=0,library=0,typeinfo=0;Register reg;LoadTL load;RegisterTL registerTL;GUID clsid;GetInfo get;
 check(CoInitialize(0)>=0,188);module=LoadLibraryA("C:\\Windows\\System\\OLEAUT32.DLL");check(module!=0,189);
 reg=(Register)GetProcAddress(module,"DllRegisterServer");check(reg&&(U)reg==(U)module+0x3d18c,190);
 result[0]=reg();check(!result[0],191);
 load=(LoadTL)GetProcAddress(module,"LoadTypeLib");registerTL=(RegisterTL)GetProcAddress(module,"RegisterTypeLib");
 check(load&&registerTL,192);result[1]=load(kernelPath,&library);check(!result[1]&&library,193);
 get=(GetInfo)(*(P**)library)[6];
 result[2]=get(library,&media,&typeinfo);release(typeinfo);typeinfo=0;
 result[3]=get(library,&info,&typeinfo);release(typeinfo);typeinfo=0;
 result[4]=get(library,&provider,&typeinfo);
 if(!(result[4]>>31)&&typeinfo){
  typedef H(CALL*GetAttr)(P,P*);typedef void(CALL*FreeAttr)(P,P);
  typedef H(CALL*GetDoc)(P,long,unsigned short**,P,P,P);typedef void(CALL*FreeBstr)(unsigned short*);
  P attr=0,desc=0;unsigned short*words,*name=0;U*longs;GetDoc doc=(GetDoc)(*(P**)typeinfo)[12];
  FreeBstr freeBstr=(FreeBstr)GetProcAddress(module,"SysFreeString");check(freeBstr!=0,201);
  result[19]=doc(typeinfo,-1,&name,0,0,0);copyName(providerName,name);if(name)freeBstr(name);name=0;
  result[8]=((GetAttr)(*(P**)typeinfo)[3])(typeinfo,&attr);check(!result[8]&&attr,200);
  words=(unsigned short*)attr;longs=(U*)attr;result[9]=longs[10];result[10]=words[22];result[11]=words[25];result[12]=words[27];
  ((FreeAttr)(*(P**)typeinfo)[19])(typeinfo,attr);
  result[13]=((H(CALL*)(P,U,P*))(*(P**)typeinfo)[5])(typeinfo,0,&desc);
  if(!(result[13]>>31)&&desc){words=(unsigned short*)desc;longs=(U*)desc;
   result[14]=longs[3];result[15]=longs[5];result[16]=words[12];result[17]=words[14];result[18]=words[18];
   result[20]=doc(typeinfo,(long)longs[0],&name,0,0,0);copyName(methodName,name);if(name)freeBstr(name);
   ((FreeAttr)(*(P**)typeinfo)[20])(typeinfo,desc);}
 }
 release(typeinfo);typeinfo=0;
 result[5]=CoGetPSClsid(&provider,&clsid);result[6]=registerTL(library,kernelPath,0);
 result[7]=CoGetPSClsid(&provider,&clsid);release(library);check(FreeLibrary(module),194);
 CoUninitialize();completed=1;return 0;
}
void report(const char*name,U value){char text[160];const char*hex="0123456789abcdef";U n=0,i;
 while(*name)text[n++]=*name++;text[n++]='=';for(i=0;i<8;i++)text[n++]=hex[(value>>(28-i*4))&15];
 text[n++]='\n';text[n]=0;OutputDebugStringA(text);}
void nameReport(const char*key,const char*value){char text[200];U n=0;while(*key)text[n++]=*key++;text[n++]='=';
 while(*value&&n<198)text[n++]=*value++;text[n++]='\n';text[n]=0;OutputDebugStringA(text);}
void start(void){
#ifdef FIXTURE_WORKER
 U id=0,code=259;P thread=CreateThread(0,0,inspect,0,0,&id);check(thread&&id,195);
 check(!WaitForSingleObject(thread,0xffffffff),196);check(GetExitCodeThread(thread,&code)&&!code&&completed,197);check(CloseHandle(thread),198);
#else
 check(!inspect(0)&&completed,199);
#endif
 report("remote-qi.metadata.DllRegisterServer",result[0]);report("remote-qi.metadata.LoadTypeLib",result[1]);
 report("remote-qi.metadata.mediaTypeInfo",result[2]);report("remote-qi.metadata.infoTypeInfo",result[3]);
 report("remote-qi.metadata.providerTypeInfo",result[4]);report("remote-qi.metadata.providerPSBefore",result[5]);
 report("remote-qi.metadata.RegisterTypeLib",result[6]);report("remote-qi.metadata.providerPSAfter",result[7]);
 report("remote-qi.metadata.provider.GetTypeAttr",result[8]);report("remote-qi.metadata.provider.typeKind",result[9]);
 report("remote-qi.metadata.provider.cFuncs",result[10]);report("remote-qi.metadata.provider.cbSizeVft",result[11]);
 report("remote-qi.metadata.provider.typeFlags",result[12]);report("remote-qi.metadata.provider.GetFuncDesc0",result[13]);
 report("remote-qi.metadata.provider.funcKind",result[14]);report("remote-qi.metadata.provider.callConv",result[15]);
 report("remote-qi.metadata.provider.cParams",result[16]);report("remote-qi.metadata.provider.oVft",result[17]);
 report("remote-qi.metadata.provider.returnVT",result[18]);
 report("remote-qi.metadata.provider.GetDocumentation",result[19]);report("remote-qi.metadata.provider.GetMethodDocumentation",result[20]);
 nameReport("remote-qi.metadata.provider.name",providerName);nameReport("remote-qi.metadata.provider.method0",methodName);
 OutputDebugStringA("remote-qi.metadata.actual-API-completed=PASS\n");ExitProcess(0);
}
`;

function nativeSources(authoredInputs) {
 // Loading existing fixture builders is deliberately deferred until release.
 const prior=authoredInputs||require('./test-sims-live-localserver-activation.cjs').sources();
 const actualSystemRegistration=String.raw`
P API LoadLibraryA(const char*);P API GetProcAddress(P,const char*);U API FreeLibrary(P);
H API CoRegisterPSClsid(const GUID*,const GUID*);H API CoGetPSClsid(const GUID*,GUID*);
void API OutputDebugStringA(const char*);void check(int,U);
static P automationModule;
void registerActualAutomation(void){typedef H(CALL*Register)(void);Register reg;
 typedef H(CALL*LoadTL)(const unsigned short*,P*);
 typedef H(CALL*RegisterTL)(P,const unsigned short*,const unsigned short*);
 static const unsigned short standardPath[]=L"C:\\Windows\\System\\stdole32.tlb";
 P standard=0;LoadTL load;RegisterTL registerTL;GUID resolved;
 static const GUID typeInfo2={0x20412,0,0,{0xc0,0,0,0,0,0,0,0x46}};
 static const GUID genuineDispatchPS={0x20420,0,0,{0xc0,0,0,0,0,0,0,0x46}};
 automationModule=LoadLibraryA("C:\\Windows\\System\\OLEAUT32.DLL");check(automationModule!=0,150);
 reg=(Register)GetProcAddress(automationModule,"DllRegisterServer");
 check(reg&&(U)reg==(U)automationModule+0x3d18c,151);check(reg()==0,152);
 load=(LoadTL)GetProcAddress(automationModule,"LoadTypeLib");
 registerTL=(RegisterTL)GetProcAddress(automationModule,"RegisterTypeLib");
 check(load&&registerTL,182);check(!load(standardPath,&standard)&&standard,183);
 check(!registerTL(standard,standardPath,0),184);((Unknown*)standard)->v->release(standard);
 // The authored object's IDispatch contract uses the actual PSDispatch class
 // registered by the genuine DLL. No factory or provider IID is substituted.
 check(!CoGetPSClsid(&typeInfo2,&resolved)&&equal(&resolved,&genuineDispatchPS),185);
 check(!CoRegisterPSClsid(&dispatchIID,&resolved),186);
 check(!CoGetPSClsid(&dispatchIID,&resolved)&&equal(&resolved,&genuineDispatchPS),187);
 OutputDebugStringA("remote-qi.genuine-stdole32-RegisterTypeLib=PASS\n");
 OutputDebugStringA("remote-qi.genuine-DllRegisterServer=PASS\n");}
void finishActualAutomation(void){check(FreeLibrary(automationModule),153);}
`;
 function registration(source){
  const begin=source.indexOf('P API LoadLibraryA(const char*);');
  const end=source.indexOf('H API CoMarshalInterface(',begin);
  if(begin<0||end<0)throw new Error('actual Automation registration source boundary missing');
  return source.slice(0,begin)+actualSystemRegistration+source.slice(end);
 }
 function replaceOnce(source,before,after){
  if(source.split(before).length!==2)throw new Error('native source anchor is not unique: '+before);
  return source.replace(before,after);
 }
 const queryChecks=String.raw`
 P initial=(P)0x1234,sentinel=(P)0x1234,canonical=0;U queryRefs;
 hr=checkedCreate(&cls,0,4,&unknown,&initial);check(!hr&&initial,154);
 check(checkedQuery(initial,0,&sentinel)==(H)0x80004003&&!sentinel,155);
 check(checkedQuery(initial,&dispatchIID,0)==(H)0x80004003,156);
 sentinel=(P)0x1234;hr=checkedQuery(initial,&unsupported,&sentinel);
 check(hr==(H)0x80004002&&!sentinel,157);
 sentinel=(P)0x1234;check(checkedQuery(initial,&nil,&sentinel)==(H)0x80004002&&!sentinel,168);
 OutputDebugStringA("remote-qi.actual-unsupported-IID=PASS\n");
 queryRefs=((Unknown*)initial)->v->add(initial);check(queryRefs>1,158);
 check(((Unknown*)initial)->v->release(initial)==queryRefs-1,159);
 remote=(P)0x1234;hr=checkedQuery(initial,&dispatchIID,&remote);check(!hr&&remote,160);
 check(!checkedQuery(remote,&unknown,&canonical)&&canonical==initial,161);
 ((Unknown*)canonical)->v->release(canonical);
 check(!checkedQuery(initial,&unknown,&canonical)&&canonical==initial,162);
 ((Unknown*)canonical)->v->release(canonical);
 ((Unknown*)initial)->v->release(initial);
 sentinel=(P)0x1234;check(checkedQuery(remote,&unsupported,&sentinel)==(H)0x80004002&&!sentinel,163);
 OutputDebugStringA("remote-qi.supported-IID-shared-identity-ABI=PASS\n");
`;
 let client=replaceOnce(prior.singleClient,
  'hr=checkedCreate(&cls,0,4,&dispatchIID,&remote);check(!hr&&remote,192);',queryChecks);
 client=replaceOnce(client,'void start(void){',checkedQuerySource+'\nvoid start(void){');
 client=registration(client).replaceAll('live-activation.','remote-qi.');
 const workerClient=client.replace('void start(void){','U CALL remoteQIClient(P unused){')
  .replace('OutputDebugStringA("remote-qi.client=PASS\\n");ExitProcess(0);',
   'OutputDebugStringA("remote-qi.client=PASS\\n");completed=1;return 0;')+String.raw`
void start(void){U id=0,code=259;P thread=CreateThread(0,0,remoteQIClient,0,0,&id);
 check(thread&&id,164);check(!WaitForSingleObject(thread,0xffffffff),165);
 check(GetExitCodeThread(thread,&code)&&!code&&completed,166);check(CloseHandle(thread),167);
 OutputDebugStringA("remote-qi.client-worker-checked-all=PASS\n");ExitProcess(0);}
`;
 function server(source){
  source=registration(source).replaceAll('live-activation.','remote-qi.');
  return replaceOnce(source,'H CALL oq(Unknown*self,const GUID*iid,P*out){',String.raw`
void API OutputDebugStringA(const char*);void check(int,U);
H CALL oq(Unknown*self,const GUID*iid,P*out){
 if(equal(iid,&unsupported))OutputDebugStringA("remote-qi.server-received-unsupported-IID\n");
 if(equal(iid,&dispatchIID))Sleep(30);
`);
 }
 const normalServer=server(prior.server),workerServer=server(prior.serverWorker);
 // Two ordinary caller processes rendezvous only after their actual factories
 // have returned the same live singleton. The event carries no interface data.
 const parallelClient=replaceOnce(client,
  'hr=checkedCreate(&cls,0,4,&unknown,&initial);check(!hr&&initial,154);',String.raw`
 hr=checkedCreate(&cls,0,4,&unknown,&initial);check(!hr&&initial,154);
 {P ready=CreateEventA(0,1,0,"Local\\wa-remote-qi-two-callers");check(ready!=0,169);
  check(!WaitForSingleObject(ready,10000),170);check(CloseHandle(ready),171);}
`);
 let parallelServer=replaceOnce(normalServer,'static P createdEvent,retiredEvent;',
  'static P createdEvent,retiredEvent,parallelReady;');
 parallelServer=replaceOnce(parallelServer,'if(object.refs)return (H)0x800700aa;',
  'if(object.refs){hr=oq(&object,iid,out);if(!hr){created++;if(created==2)SetEvent(parallelReady);}return hr;}');
 parallelServer=replaceOnce(parallelServer,'check(createdEvent&&retiredEvent,205);',String.raw`
 check(createdEvent&&retiredEvent,205);
 parallelReady=CreateEventA(0,1,0,"Local\\wa-remote-qi-two-callers");check(parallelReady!=0,172);
`);
 parallelServer=replaceOnce(parallelServer,'finishActualAutomation();CoUninitialize();',
  'check(CloseHandle(parallelReady),173);finishActualAutomation();CoUninitialize();');
 const parallelParent=registration(prior.parallelClient).replaceAll('live-single-client.exe','remote-qi-parallelClient.exe')
  .replaceAll('live-activation.concurrent-clients','remote-qi.concurrent-clients');
 const retiringClient=workerClient.slice(0,workerClient.lastIndexOf('void start(void){'))+String.raw`
void start(void){U id=0;P entered=CreateEventA(0,1,0,"Local\\wa-remote-qi-entered");
 check(entered!=0,174);P thread=CreateThread(0,0,remoteQIClient,0,0,&id);check(thread&&id,175);
 check(!WaitForSingleObject(entered,10000),176);check(CloseHandle(entered),177);
 check(CloseHandle(thread),178);OutputDebugStringA("remote-qi.caller-retiring-during-actual-QI\n");ExitProcess(0);}
`;
 const retiringServer=replaceOnce(normalServer,
  'if(equal(iid,&dispatchIID))Sleep(30);',String.raw`
 if(equal(iid,&dispatchIID)){
  P entered=CreateEventA(0,1,0,"Local\\wa-remote-qi-entered");check(entered!=0,179);
  check(SetEvent(entered),180);check(CloseHandle(entered),181);
  OutputDebugStringA("remote-qi.server-QI-owner-will-retire\n");Sleep(300);
 }
`);
 return {client,workerClient,server:normalServer,workerServer,parallelClient,parallelServer,parallelParent,retiringClient,retiringServer,
  metadataClient:providerMetadataSource,metadataWorker: '#define FIXTURE_WORKER 1\n'+providerMetadataSource};
}

function prepare(directory,libraryDirectory) {
 const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
 const sha=bytes=>require('node:crypto').createHash('sha256').update(bytes).digest('hex');
 const out=path.resolve(directory);fs.mkdirSync(out,{recursive:true});let serial=0;
 const put=(name,value)=>fs.writeFileSync(path.join(out,name),value,{flag:'wx'});
 const libraries=['kernel32','ole32','oleaut32','advapi32'].map(name=>path.resolve(libraryDirectory,name+'.lib'));
 const libraryPins=libraries.map(file=>({path:file,sha256:sha(fs.readFileSync(file))}));
 function run(argv){
  const result=cp.spawnSync(argv[0],argv.slice(1),{encoding:'utf8',timeout:30000}),label='tool-'+ ++serial;
  put(label+'.stdout.log',result.stdout||'');put(label+'.stderr.log',result.stderr||'');
  put(label+'-wait.json',JSON.stringify({argv,pid:result.pid,exit:result.status,signal:result.signal,
   actualWait:result.status!==null,stdoutEOF:!result.error,stderrEOF:!result.error,error:result.error?String(result.error):null})+'\n');
  if(result.error||result.status)throw new Error('native input preparation failed: '+argv[0]+': '+(result.stderr||result.error));
 }
 const inputs=[];
 for(const [label,source] of Object.entries(nativeSources())){
  const name='remote-qi-'+label;put(name+'.c',source);
  run(['clang','--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-mno-stack-arg-probe',
   '-fno-builtin','-O1','-DFIXTURE_FLAGS=1','-c',path.join(out,name+'.c'),'-o',path.join(out,name+'.obj')]);
  run(['ld','-mi386pe','--entry','_start','--subsystem','console','--disable-dynamicbase','--no-insert-timestamp',
   '-o',path.join(out,name+'.exe'),path.join(out,name+'.obj'),...libraries]);
  inputs.push({name,path:path.join(out,name+'.exe'),sha256:sha(fs.readFileSync(path.join(out,name+'.exe'))),sourceSHA256:sha(Buffer.from(source))});
 }
 put('prepared.json',JSON.stringify({inputs,libraryPins,nativeExecution:false},null,2)+'\n');return inputs;
}

module.exports={authorityTests,proxyTests,exporterTests,checkedQuerySource,providerMetadataSource,nativeSources,prepare,UNKNOWN,DISPATCH,ABSENT};
if(require.main===module){
 if(process.argv[2]==='--authority')authorityTests();
 else if(process.argv[2]==='--proxy')proxyTests();
 else if(process.argv[2]==='--exporter')exporterTests();
 else if(process.argv[2]==='--prepare'&&process.argv[3]&&process.argv[4])process.stdout.write(JSON.stringify(prepare(process.argv[3],process.argv[4]))+'\n');
 else if(process.argv[2]==='--authored'){
  assert(checkedQuerySource.includes('retl $12'));assert(checkedQuerySource.includes('calll *(%eax)'));
  assert.equal(new Set([UNKNOWN,DISPATCH,ABSENT]).size,3);
  process.stdout.write('Authored QI ABI source checks PASS; shared/runtime/native tests UNRUN\n');
 }else if(process.argv[2]==='--authored-retained'&&process.argv[3]){
  const fs=require('node:fs'),path=require('node:path');
  const read=name=>fs.readFileSync(path.join(process.argv[3],name+'.c'),'utf8');
  const prior={server:read('live-server'),serverWorker:read('live-server-worker'),
   singleClient:read('live-single-client'),parallelClient:read('live-parallel-client')};
  const sources=nativeSources(prior);
  for(const [name,source] of Object.entries(sources)){
   assert(!source.includes('CoRegisterClassObject(&psClass'));
   if(!name.startsWith('metadata')){
    assert(source.includes('CoRegisterPSClsid(&dispatchIID,&resolved)'));
    if(name!=='parallelParent')assert(source.includes('check(reg()==0,152);'));
   }
  }
  assert(sources.client.includes('checkedQuery(initial,&dispatchIID,&remote)'));
  assert(sources.retiringServer.includes('server-QI-owner-will-retire'));
  assert(sources.parallelServer.includes('if(created==2)SetEvent(parallelReady)'));
  process.stdout.write('Retained C inputs read as data: '+Object.keys(sources).length+' new authored source transformations PASS; helper/native execution UNRUN\n');
 }else throw new Error('explicit --authored or --authority required');
}
