'use strict';
const assert=require('node:assert/strict');
const {fixture}=require(process.env.QUAKE2_RECEIVER_FIXTURE||'../tools/quake2-native-receiver-fixture.cjs');
function imports(b){
 const raw=r=>r-0x1000+0x400,rows=[];
 for(let d=raw(0x1000);b.readUInt32LE(d);d+=20){const t=b.readUInt32LE(d+16);for(let i=0;b.readUInt32LE(raw(t+i*4));i++){
  const n=raw(b.readUInt32LE(raw(t+i*4)))+2,end=b.indexOf(0,n);rows.push({iat:0x400000+t+i*4,name:b.toString('ascii',n,end)});
 }}return rows;
}
(async()=>{
 let groups=0;const test=async(name,f)=>{await f();console.log('PASS '+name);groups++;};
 await test('short physical hold follows genuine native return; failure retains independent fallback',async()=>{
  const {createController}=require('../tools/quake2-native-consumption-input.cjs');
  for(const kind of ['key','mouse'])for(const outcome of ['consumed','pending','cancelled','invalid','dispatch-failure']){
   const trace=[],nonce=kind+'-'+outcome,at=Date.now(),image={completedAt:at,sha256:'a'.repeat(64)};
   const intent={kind,code:kind==='mouse'?1:13,button:kind==='mouse'?0:undefined,x:640,y:500,
    key:'Enter',domCode:'Enter',ms:50,nonce,name:'action-1',mode:'menu',review:'Reviewed authored triangle',reviewedAt:at,imageSHA256:image.sha256};
   let closed=false,armed;
   const release={alive:true,arm:async()=>{armed=Date.now();trace.push('arm');return {at:armed,fallback:armed+1750,releaseDue:armed+1500};},
    due:(n,due)=>{assert.equal(n,nonce);assert(trace.includes('native-return'));assert.equal(closed,false);assert(due<=armed+1500&&due>armed);trace.push('due');},
    cancel:()=>trace.push('cancel-no-down'),finish:async()=>{trace.push('independent-up');return {ok:true};}};
   const c=createController({release,close:()=>{closed=true;trace.push('close');},
    dispatch:async()=>{trace.push('down');assert(!trace.includes('due'));if(outcome==='dispatch-failure')throw Error('actual transport failed');},
    page:async method=>{assert(!closed,'no query after first UNKNOWN');if(method==='prepare')return {prepared:{state:'PREPARED'}};
     assert.equal(method,'status');await new Promise(r=>setTimeout(r,20));
     if(outcome==='pending')return {state:'DELIVERY_PENDING'};
     if(outcome==='cancelled')return {state:'CANCELLED',consumed:false};
     trace.push('native-return');return {state:'CONSUMED',consumed:true,receiptBoundary:'owner-worker-native-user-return',
      nativeMessage:{consumption:'owner-user-return',token:outcome==='invalid'?0:1,msg:kind==='mouse'?0x201:0x100,wParam:intent.code}};}});
   if(outcome==='consumed'){await c.gesture(intent,image);assert.deepEqual(trace,['arm','down','native-return','due','independent-up']);assert(!c.terminal);}
   else{await assert.rejects(c.gesture(intent,image));assert(c.terminal);assert(!trace.includes('due'));assert(!trace.includes('cancel-no-down'));assert.equal(trace.at(-1),'independent-up');
    const before=trace.length;await assert.rejects(c.gesture({...intent,nonce:nonce+'-retry'},image));assert.equal(trace.length,before);}
  }
 });
 await test('owned children retain real close, signal and stdio receipts',async()=>{
  const cp=require('node:child_process'),{ownChild}=require('../tools/quake2-native-release.cjs');
  const launch=body=>{const p=cp.spawn(process.execPath,['-e',body],{stdio:['pipe','pipe','pipe']});return ownChild(p);};
  const normal=launch("process.stdout.write('out');process.stderr.write('err');process.exitCode=7");
  const n=await normal.joined;assert.equal(n.code,7);assert.equal(n.signal,null);
  assert.equal(n.stdout,'out');assert.equal(n.stderr,'err');assert(n.stdoutEOF&&n.stderrEOF&&n.actualWait);
  assert.strictEqual(await normal.stop(),n,'already exited child still joins');
  const signalled=launch("console.log('ready');setInterval(()=>{},1000)");
  await new Promise(r=>signalled.child.stdout.once('data',r));signalled.child.kill('SIGTERM');
  const s=await signalled.joined;assert.equal(s.code,null);assert.equal(s.signal,'SIGTERM');assert(s.stdoutEOF&&s.stderrEOF);
  const stubborn=launch("process.on('SIGTERM',()=>{});console.log('ready');setInterval(()=>{},1000)");
  await new Promise(r=>stubborn.child.stdout.once('data',r));
  const k=await stubborn.stop(30);assert.equal(k.signal,'SIGKILL');assert(k.actualWait&&k.stdoutEOF&&k.stderrEOF);
  const absent=ownChild(cp.spawn('/no-such-quake2-test-executable',[],{stdio:['pipe','pipe','pipe']}));
  const a=await absent.joined;assert(a.spawnError);assert.equal(a.code,-2);assert(a.actualWait);
 });
 await test('completed edge leaves actual release child healthy across idle review',async()=>{
  const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
  const {WebSocketServer}=require('../ops/node_modules/ws');
  const {createRelease}=require('../tools/quake2-native-release.cjs');
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'quake2-release-idle-'));
  const server=new WebSocketServer({host:'127.0.0.1',port:0});await new Promise(r=>server.once('listening',r));
  const wire=[];server.on('connection',ws=>ws.on('message',b=>{const q=JSON.parse(b);wire.push(q);
    ws.send(JSON.stringify({id:q.id,...(q.sessionId?{sessionId:q.sessionId}:{}),result:q.method==='Target.attachToTarget'?{sessionId:'protocol-only'}:{}}));}));
  let api;try{
   api=await createRelease(dir,{url:'ws://127.0.0.1:'+server.address().port,pid:process.pid,
    startToken:fs.readFileSync('/proc/self/stat','utf8').split(') ').at(-1).split(' ')[19],targetId:'protocol-only'});
   for(let i=0;i<2;i++){
    const edge={kind:'key',code:65,key:'a',domCode:'KeyA',name:'action-'+i,nonce:'idle-'+i};
    await api.arm(edge);api.cancel(edge.nonce);assert((await api.finish(edge.nonce)).cancelNoDown);
    if(i===0)await new Promise(r=>setTimeout(r,5100));
   }
   const receipt=await api.close();api=null;assert.equal(receipt.code,0);assert(receipt.actualWait&&receipt.stdoutEOF&&receipt.stderrEOF);
   assert(!wire.some(v=>v.method.startsWith('Input.')),'protocol model sends no physical edge');
  }finally{if(api)await api.close();for(const ws of server.clients)ws.terminate();await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true});}
 });
 await test('PE loader-visible terminated IAT, public callback and focus/exit call targets',()=>{
  for(const filter of [false,true]){const b=fixture({filter}),i=imports(b),names=i.map(r=>r.name);
   assert.equal(b.readUInt16LE(0),0x5a4d);assert.equal(b.readUInt32LE(0x80),0x4550);
   assert(names.includes(filter?'PeekMessageA':'GetMessageA'));assert(!names.includes(filter?'GetMessageA':'PeekMessageA'));
   for(const [iat,name]of [[0x401324,'SetWindowTextA'],[0x401308,'SetFocus'],[0x401200,'ExitProcess']])assert.equal(i.find(v=>v.iat===iat)?.name,name);
   const text=b.subarray(0x1c00,0x2400);for(const n of [0x401324,0x401308,0x401200]){const call=Buffer.alloc(6);call[0]=0xff;call[1]=0x15;call.writeUInt32LE(n,2);assert(text.includes(call));}
   assert(b.subarray(0x2e00,0x2f00).every(v=>v===0),'caption buffer is empty before real callbacks');
  }
 });
 await test('actual x86 message pump stdcall arity and real filtered negative',()=>{
  const b=fixture(),negative=fixture({filter:true});const call=Buffer.from([0xff,0x15,0x0c,0x13,0x40,0]);
  const at=b.indexOf(call,0x1400);assert(at>0);assert.equal(b[at-25],0xe9);
  assert.equal(0x400000+at-25-0x400+0x1000+5+b.readInt32LE(at-24),0x402700);
  const values=[];for(let o=at-20;o<at;o+=5){assert.equal(b[o],0x68);values.push(b.readUInt32LE(o+1));}
  assert.deepEqual(values,[0,0,0,0x403640]);assert.equal(negative[at-25],0xe9);
  const trampoline=b.subarray(0x1b00,0x1b33),filtered=negative.subarray(0x1b00,0x1b38);
  assert(trampoline.includes(Buffer.from([0xff,0x15,0x28,0x13,0x40,0])));
  assert.deepEqual([...filtered.subarray(46,51)],[0x68,1,0,0,0]);
  assert.equal(imports(b).find(v=>v.iat===0x401328)?.name,'SetTimer');
  assert.equal(negative.readUInt32LE(at-19),0x8000);assert.equal(negative.readUInt32LE(at-14),0x8000);
 });

 console.log('PASS real receiver PE structure and call contracts; native execution UNRUN');
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
