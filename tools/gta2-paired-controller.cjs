'use strict';
const PROGRAM_ENTERED_AT=Date.now();
// Manual browser controller. No gameplay selection, guest writes, or retries.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..');
const HELPER='scratch/runs/20261108-redline-car-door-native/bound-input.cjs';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const KEYS={ArrowUp:38,ArrowDown:40,ArrowLeft:37,ArrowRight:39,Enter:13,Escape:27,Space:32,Control:17,y:89,n:78};
const QUIT={'open-menu':'Escape','menu-up':'ArrowUp','menu-down':'ArrowDown','select-quit':'Enter','confirm-quit':'y'};
function devtoolsEndpoint(file) {
  if(!fs.existsSync(file))return null;
  const [port,endpoint]=fs.readFileSync(file,'utf8').trim().split('\n');
  return /^\d+$/.test(port)&&Number(port)>0&&Number(port)<=65535&&/^\/devtools\/browser\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(endpoint||'')?'ws://127.0.0.1:'+port+endpoint:null;
}
function policy(c,launch,phase,now=Date.now()) {
  assert(['play','menu','quit'].includes(c.mode));
  assert(Array.isArray(c.keys)&&c.keys.length>=1&&c.keys.length<=2&&new Set(c.keys).size===c.keys.length);
  assert(c.keys.every(k=>Object.hasOwn(KEYS,k)));
  if(c.keys.length===2)assert(c.mode==='play'&&c.keys[0]==='ArrowUp'&&['ArrowLeft','ArrowRight'].includes(c.keys[1]),'ordinary throttle plus manual steering only');
  assert(Number.isInteger(c.ms)&&c.ms>=80&&c.ms<=1400,'finite hold leaves independent UP margin');
  assert(now<launch.deadline*1000,'immutable deadline');
  assert(c.observation?.trim(),'personal scene review required');
  assert(/^[a-z0-9-]{8,100}$/.test(c.nonce||''),'fresh gesture nonce required');
  assert(c.intent?.trim(),'explicit manual intent required');
  if(c.mode!=='play')assert(c.keys.length===1&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Enter','Escape','y','n'].includes(c.keys[0]));
  if(c.mode==='quit'){
    assert(Object.hasOwn(QUIT,c.route)&&c.keys.length===1&&c.keys[0]===QUIT[c.route],'reviewed native Quit route required');
    if(c.route==='select-quit')assert(['Quit','Quit GTA2','Exit'].includes(c.selectedQuit),'personally reviewed Quit selection required');
  }
  else assert(!phase&&now+3000<(launch.deadline-180)*1000,'irreversible 180 second Quit reserve');
  return c.mode==='play'?5000:30000;
}
// The independent child receives several megabytes of fresh module bytes.
// Consume socket chunks once, retaining fragments until one complete CDP text
// message is available. No repository dependency or observation cache is used.
class LoopbackWebSocket {
  constructor(address) {
    const http=require('node:http'),{TextDecoder}=require('node:util');
    const url=new URL(address);
    assert.equal(url.protocol,'ws:');assert.equal(url.hostname,'127.0.0.1');
    assert(!url.username&&!url.password&&!url.hash,'plain owned loopback transport');
    const key=crypto.randomBytes(16).toString('base64');
    const accept=crypto.createHash('sha1').update(key+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
    let socket,closing=false,ended=false,chunks=[],offset=0,available=0,frame=null,fragments=null,fragmentBytes=0;
    const max=64*1024*1024,decode=bytes=>new TextDecoder('utf-8',{fatal:true}).decode(bytes);
    const fail=error=>{if(ended)return;ended=true;closing=true;socket?.destroy();request.destroy();this.onerror?.(error);};
    const take=count=>{
      assert(available>=count);available-=count;
      if(!count)return Buffer.alloc(0);
      const first=chunks[0],left=first.length-offset;
      if(left>=count){const result=first.subarray(offset,offset+count);offset+=count;if(offset===first.length){chunks.shift();offset=0;}return result;}
      const result=Buffer.allocUnsafe(count);let copied=0;
      while(copied<count){const part=chunks[0],n=Math.min(count-copied,part.length-offset);part.copy(result,copied,offset,offset+n);copied+=n;offset+=n;if(offset===part.length){chunks.shift();offset=0;}}
      return result;
    };
    const writeFrame=(opcode,body)=>{
      assert(socket&&!closing,'transport closed');
      body=Buffer.isBuffer(body)?body:Buffer.from(body);assert(body.length<=max);
      const extra=body.length<126?0:body.length<=65535?2:8,header=Buffer.alloc(2+extra+4),mask=crypto.randomBytes(4);
      header[0]=0x80|opcode;header[1]=0x80|(extra===0?body.length:extra===2?126:127);
      if(extra===2)header.writeUInt16BE(body.length,2);if(extra===8)header.writeBigUInt64BE(BigInt(body.length),2);
      mask.copy(header,2+extra);const masked=Buffer.allocUnsafe(body.length);
      for(let i=0;i<body.length;i++)masked[i]=body[i]^mask[i&3];
      socket.cork();socket.write(header);socket.write(masked);socket.uncork();
    };
    const consume=bytes=>{
      if(ended||closing)return;chunks.push(bytes);available+=bytes.length;
      try{for(;;){
        if(!frame){
          if(available<2)return;const h=take(2),opcode=h[0]&15,short=h[1]&127;
          assert(!(h[0]&0x70)&&!(h[1]&0x80),'invalid reserved bits or masked server frame');
          assert([0,1,8,9,10].includes(opcode),'CDP text/control opcode required');
          assert(opcode<8||(!!(h[0]&0x80)&&short<=125),'invalid control fragmentation/length');
          frame={opcode,final:!!(h[0]&0x80),short,length:short<126?short:null};
        }
        if(frame.length===null){
          const n=frame.short===126?2:8;if(available<n)return;const h=take(n);
          const size=n===2?BigInt(h.readUInt16BE()):h.readBigUInt64BE();
          assert(size>=BigInt(n===2?126:65536)&&size<=BigInt(max),'noncanonical or oversized frame');frame.length=Number(size);
        }
        assert(frame.length<=max);if(available<frame.length)return;
        const payload=take(frame.length),current=frame;frame=null;
        if(current.opcode===8){
          assert(payload.length!==1,'invalid close payload');
          if(payload.length>=2){const code=payload.readUInt16BE();assert((code>=1000&&code<=1014&&![1004,1005,1006].includes(code))||(code>=3000&&code<=4999),'invalid close code');decode(payload.subarray(2));}
          writeFrame(8,payload);closing=true;socket.end();return;
        }
        if(current.opcode===9){writeFrame(10,payload);continue;}if(current.opcode===10)continue;
        if(current.opcode===1){assert(fragments===null,'new message during fragmentation');fragments=[];fragmentBytes=0;}
        else assert(fragments!==null,'unrequested continuation');
        fragmentBytes+=payload.length;assert(fragmentBytes<=max,'oversized message');fragments.push(payload);
        if(current.final){const message=decode(fragments.length===1?fragments[0]:Buffer.concat(fragments,fragmentBytes));fragments=null;fragmentBytes=0;this.onmessage?.({data:message});if(closing||ended)return;}
      }}catch(error){fail(error);}
    };
    const requestURL=new URL(url);requestURL.protocol='http:';
    const request=http.request(requestURL,{headers:{Upgrade:'websocket',Connection:'Upgrade','Sec-WebSocket-Key':key,'Sec-WebSocket-Version':'13'}});
    request.on('upgrade',(response,stream,head)=>{
      socket=stream;
      try{assert.equal(response.statusCode,101);assert.equal(response.headers.upgrade?.toLowerCase(),'websocket');assert(response.headers.connection?.toLowerCase().split(/\s*,\s*/).includes('upgrade'));assert.equal(response.headers['sec-websocket-accept'],accept);assert(!response.headers['sec-websocket-extensions']&&!response.headers['sec-websocket-protocol'],'unrequested websocket negotiation');
        socket.setNoDelay(true);socket.on('data',consume);socket.on('error',fail);socket.on('close',()=>{ended=true;closing=true;this.onclose?.();});
        this.onopen?.();if(head.length)consume(head);
      }catch(error){fail(error);}
    });
    request.on('response',()=>fail(Error('websocket upgrade refused')));request.on('error',fail);request.end();
    this.send=text=>writeFrame(1,Buffer.from(text));
    this.close=()=>{if(closing||ended)return;if(!socket){closing=true;request.destroy();return;}try{writeFrame(8,Buffer.alloc(0));}finally{closing=true;socket.end();setTimeout(()=>socket.destroy(),250).unref();}};
  }
}
function connection(url,onUnknown=()=>{},Socket=WebSocket) {
  const ws=new Socket(url),pending=new Map();let id=0,terminal=null,readyResolve,readyReject;
  const ready=new Promise((r,j)=>{readyResolve=r;readyReject=j;});
  const api={ws,ready,event:()=>{},protocol:()=>{},get closed(){return terminal!==null;},stop(){if(terminal)return;terminal='deliberate host teardown';clearTimeout(openTimer);for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error(terminal));}pending.clear();ws.onclose=null;ws.close();},seal(reason){
    if(terminal)return;terminal=String(reason);clearTimeout(openTimer);
    const error=Error('UNKNOWN '+terminal+'; permanently closed; never replay');
    onUnknown({state:'UNKNOWN',reason:terminal,at:Date.now(),permanentClose:true,laterRequestsAllowed:0});
    readyReject(error);for(const p of pending.values()){clearTimeout(p.timer);p.reject(error);}pending.clear();ws.close();
  },send(method,params={},sessionId){
    if(!terminal)try{api.requestGuard?.();}catch(error){api.seal(error);}
    if(terminal)return Promise.reject(Error('permanently closed '+terminal));
    return new Promise((resolve,reject)=>{const n=++id,timer=setTimeout(()=>api.seal(method+' timeout'),3000);pending.set(n,{resolve,reject,timer,method,sessionId,scriptId:params.scriptId,at:Date.now()});
      try{api.protocol({event:'sent',method,session:sessionId??null,at:Date.now(),type:params.type??null});ws.send(JSON.stringify({id:n,method,params,...(sessionId?{sessionId}:{})}));}catch(e){api.seal(method+' send '+e);}
    });
  }};
  const openTimer=setTimeout(()=>api.seal('connection timeout'),3000);
  ws.onopen=()=>{clearTimeout(openTimer);readyResolve();};
  ws.onerror=()=>api.seal('transport error');ws.onclose=()=>api.seal('transport closed');
  ws.onmessage=msg=>{if(terminal)return;try{const v=JSON.parse(msg.data);if(v.id){const p=pending.get(v.id);if(p){clearTimeout(p.timer);pending.delete(v.id);api.protocol({method:p.method,session:p.sessionId??null,scriptId:p.scriptId??null,at:p.at,ack:Date.now(),ms:Date.now()-p.at,responseBytes:msg.data.length,error:v.error??null});v.error?p.reject(Error(JSON.stringify(v.error))):p.resolve(v.result);}}else api.event(v);}catch(e){api.seal('invalid message '+e);}};
  return api;
}
function save(out,n,v){const p=path.join(out,n);assert(!fs.existsSync(p),n);fs.writeFileSync(p+'.pending',JSON.stringify(v,null,2)+'\n',{flag:'wx'});fs.renameSync(p+'.pending',p);}
async function saveAsync(out,name,value){
  const file=path.join(out,name);assert(!fs.existsSync(file),name);
  await fs.promises.writeFile(file+'.pending',JSON.stringify(value,null,2)+'\n',{flag:'wx'});
  await fs.promises.rename(file+'.pending',file);
}
async function boundedOperation(c,label,work) {
  let timer;
  try {
    return await Promise.race([Promise.resolve().then(work),new Promise((_,reject)=>{
      timer=setTimeout(()=>{c.seal(label+' exceeded 3000ms');reject(Error('UNKNOWN '+label+'; permanently closed; never replay'));},3000);
    })]);
  } finally {clearTimeout(timer);}
}
async function releasePreinit(out,file,loadedSources=null) {
  if(!loadedSources){
    // Bootstrap only: execute each helper from the very Buffer whose digest
    // is reported. Reading its file after require() would not prove which
    // bytes Node compiled if the file changed between loading and hashing.
    const Module=require('node:module'),compiled=[];let current;
    for(const relative of ['tools/gta2-browser-release-binding.cjs','tools/gta2-paired-controller.cjs']){
      const filename=path.join(ROOT,relative),bytes=fs.readFileSync(filename);
      const exact=new Module(filename,module);exact.filename=filename;
      exact.paths=Module._nodeModulePaths(path.dirname(filename));
      exact._compile(bytes.toString('utf8'),filename);exact.loaded=true;require.cache[filename]=exact;
      compiled.push({path:relative,sha256:sha(bytes)});current=exact;
    }
    return current.exports.releasePreinit(out,file,Object.freeze(compiled));
  }
  const setup=JSON.parse(fs.readFileSync(file)),native=require('./gta2-browser-release-binding.cjs');
  native.checkPID(setup.pid,setup.startToken);
  const c=connection(setup.url,v=>save(out,setup.name+'-UNKNOWN.json',v),LoopbackWebSocket);let timer,preparedTargets=null;
  try {
    const configFile=await Promise.race([(async()=>{
      await c.ready;
      if(setup.targetId){
        // Transport/target attachment only. No debugger/runtime inventory,
        // source/module bytes, native state or authorization is prepared.
        const targets=(await c.send('Target.getTargets')).targetInfos;
        const ids=[setup.targetId,...(setup.workerTargets??[])];
        assert.equal(new Set(ids).size,ids.length,'unique prepared target identities');
        const attached=await Promise.all(ids.map(async(targetId,index)=>{
          const target=targets.find(t=>t.targetId===targetId);
          assert(target&&target.type===(index?'worker':'page'),'current initialization target');
          const sessionId=(await c.send('Target.attachToTarget',{targetId,flatten:true})).sessionId;
          return {targetId,sessionId,url:target.url};
        }));
        preparedTargets={page:attached[0],workers:attached.slice(1)};
      }
      const stat=fs.readFileSync('/proc/'+process.pid+'/stat','utf8');
      process.stdout.write(JSON.stringify({state:'INITIALIZED',pid:process.pid,
        startToken:stat.slice(stat.lastIndexOf(')')+2).split(' ')[19],at:Date.now(),loadedSources,loadedFromExactBytes:true,
        nativeObservationsCached:false,sourceInventoriesCached:false,moduleBytesCached:false,
        preparedTargetIds:preparedTargets?[preparedTargets.page.targetId,...preparedTargets.workers.map(w=>w.targetId)]:[]})+'\n');
      return await new Promise((resolve,reject)=>{
        if(process.stdin.readableEnded)return reject(Error('parent EOF before current guard configuration'));
        let text='';const data=b=>{text+=b;const end=text.indexOf('\n');if(end<0)return;
          process.stdin.off('data',data);process.stdin.off('end',eof);
          try{assert.equal(end,text.length-1,'one initial configuration');resolve(JSON.parse(text.slice(0,end)).file);}catch(e){reject(e);}};
        const eof=()=>reject(Error('parent EOF before current guard configuration'));
        process.stdin.on('data',data);process.stdin.once('end',eof);
      });
    })(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('release initialization exceeded aggregate 3000ms')),
      Math.max(0,3000-(Date.now()-setup.operationStartedAt)));})]);
    clearTimeout(timer);
    await release(out,configFile,{c,loadedSources,operationStartedAt:setup.operationStartedAt,preparedTargets,phasePipe:setup.phasePipe?fs.createWriteStream(null,{fd:3,autoClose:false}):null});
  } finally {clearTimeout(timer);c.stop();process.stdin.destroy();}
}
async function release(out,file,initialized=null) {
  const cfg=JSON.parse(fs.readFileSync(file)),native=require('./gta2-browser-release-binding.cjs');
  native.checkPID(cfg.pid,cfg.startToken);
  assert(Array.isArray(cfg.keys)&&cfg.keys.length>=1&&cfg.keys.length<=2&&new Set(cfg.keys).size===cfg.keys.length&&cfg.keys.every(k=>Object.hasOwn(KEYS,k)));
  assert(Number.isSafeInteger(cfg.startedAt),'immutable prearm launch time');
  const phases=[];
  const phasePipe=initialized?.phasePipe??null;
  const trace=(phase,detail)=>{const at=Date.now(),row={phase,at,sinceStarted:at-cfg.startedAt,...(detail?{detail}:{})};phases.push(row);phasePipe?.write(JSON.stringify(row)+'\n');};
  trace('release-program-entry',{programEnteredAt:PROGRAM_ENTERED_AT,entryMs:PROGRAM_ENTERED_AT-cfg.startedAt,pid:process.pid});
  if(initialized){
    assert.equal(cfg.operationStartedAt,initialized.operationStartedAt);
    for(const loaded of initialized.loadedSources)assert.equal(loaded.sha256,
      cfg.pins.files.find(p=>p.path===loaded.path)?.sha256,'initialized executed helper source changed');
  }
  const c=initialized?.c??connection(cfg.url,v=>save(out,cfg.name+'-UNKNOWN.json',v));
  c.protocol=v=>trace('protocol',v);
  const operationTimer=setTimeout(()=>c.seal('independent release operation exceeded 3000ms'),Math.max(0,3000-(Date.now()-(cfg.operationStartedAt??cfg.startedAt))));
  let pending='',scheduled=false,ended=false,due=Infinity,armed,session,prearmTimer,attestation,
    confirmation=null,confirmed=false,signalResolve=null;
  const signal=()=>signalResolve?.();
  process.stdin.on('data',b=>{
    pending+=b;let i;
    while((i=pending.indexOf('\n'))>=0){
      try {const v=JSON.parse(pending.slice(0,i));pending=pending.slice(i+1);
        if(v.action==='confirm'){
          assert(cfg.mode==='native'&&armed&&!confirmation&&!confirmed&&v.nonce===cfg.nonce&&
            v.childToken===armed.childToken&&typeof v.leaseToken==='string'&&v.leaseToken.length>=16,
            'one current independent source/native confirmation');
          confirmation=v;trace('independent-confirmation-received');signal();continue;
        }
        assert(armed&&Number.isSafeInteger(v.at)&&v.at>=armed.at&&v.at<=armed.fallback,'finite release schedule');
        scheduled=true;due=Math.min(due,v.at);signal();
      }catch(error){ended=true;due=Date.now();signal();}
    }
  });
  process.stdin.on('end',()=>{ended=true;if(!scheduled){due=Date.now();if(!armed)c.seal('parent EOF before independent arm');}signal();});
  try {
    const prepare=(async()=>{
      await c.ready;trace('independent-transport-connected');session=initialized?.preparedTargets?.page.sessionId??(await c.send('Target.attachToTarget',{targetId:cfg.targetId,flatten:true})).sessionId;trace('independent-page-attached',{prepared:!!initialized?.preparedTargets});
      attestation=null;
      if(cfg.mode==='blank-control'){
        assert(!cfg.owner&&!cfg.review&&!cfg.bindingToken,'blank controls cannot admit a native owner');
        const actual=await native.evaluate(c,session,`({url:location.href,apps:typeof runningApps==='undefined'?0:runningApps.length})`);
        assert.equal(actual.url,'about:blank');assert.equal(actual.apps,0);
      }else{
        assert.equal(cfg.mode,'native');assert(cfg.nonce&&cfg.review&&cfg.owner&&cfg.bindingToken);
        attestation=await native.attestExecuted({c,pageSession:session,cfg,trace,preparedTargets:initialized?.preparedTargets??null});
      }
      assert(!ended,'parent EOF/cancel before arm');native.checkPID(cfg.pid,cfg.startToken);
      const startedAt=cfg.startedAt;assert(Number.isSafeInteger(startedAt)&&Date.now()>=startedAt&&Date.now()-startedAt<=500,'release prearm exceeded 500ms');
      let result;
      if(cfg.mode==='native'){
        attestation.assertCurrent();
        const childToken=crypto.randomUUID();
        result=await native.evaluate(c,session,`__gta2NativeReleasePageV1.arm(${JSON.stringify({
          bindingToken:cfg.bindingToken,nonce:cfg.nonce,intent:cfg.intent,keys:cfg.keys.map(k=>KEYS[k]),childToken,startedAt})})`);
        attestation.assertCurrent();
        assert(result.armed&&result.nonce===cfg.nonce&&result.childToken===childToken);
        assert.deepEqual(result.native,cfg.review.native);assert.deepEqual(result.pageIdentity,cfg.review.pageIdentity);
        save(out,cfg.name+'-attestation.json',{...attestation,nonce:cfg.nonce,childToken,currentHelperSHA256:sha(fs.readFileSync(require.resolve('./gta2-browser-release-binding.cjs')))});
      }else {const at=Date.now();result={armed:true,at,fallback:at+1500,protocolOnly:true};}
      assert(Date.now()-startedAt<=500,'release ACK exceeded 500ms');
      const stat=fs.readFileSync('/proc/'+process.pid+'/stat','utf8');
      armed={...result,pid:process.pid,startToken:stat.slice(stat.lastIndexOf(')')+2).split(' ')[19],session};
      due=Math.min(due,armed.fallback);trace('arm-ack-ready');process.stdout.write(JSON.stringify(armed)+'\n');
    })();
    await Promise.race([prepare,new Promise((_,reject)=>{prearmTimer=setTimeout(()=>{c.seal('release prearm exceeded 500ms');reject(Error('release prearm exceeded 500ms'));},Math.max(0,500-(Date.now()-cfg.startedAt)));})]);
    clearTimeout(prearmTimer);
    while(Date.now()<due){
      if(confirmation){
        assert(!ended&&!confirmed,'cancelled or duplicate confirmation');
        attestation.assertCurrent();
        const resultTask=native.evaluate(c,session,`__gta2NativeReleasePageV1.confirm(${JSON.stringify(confirmation)})`);
        resultTask.catch(()=>{});
        await native.verifyPinsAsync(cfg.pins);
        const result=await resultTask;
        assert(!ended&&!confirmed,'parent EOF/cancel during independent confirmation');
        // The protocol round trip is also a barrier for this independent
        // debugger's preceding live-edit/context/target invalidations.
        attestation.assertCurrent();
        native.checkPID(cfg.pid,cfg.startToken);native.checkPID(cfg.parentPID,cfg.parentStartToken);
        assert(Date.now()-cfg.startedAt<=500,'current lease confirmation exceeded 500ms');
        assert.equal(result.state,'CONFIRMED');assert.equal(result.leaseToken,confirmation.leaseToken);
        assert.deepEqual(result.native,cfg.review.native);assert.deepEqual(result.pageIdentity,cfg.review.pageIdentity);
        confirmed=true;confirmation=null;trace('current-source-native-lease-confirmed');
        const receipt={...result,at:Date.now(),pid:process.pid,startedAt:cfg.startedAt};
        save(out,cfg.name+'-confirmation.json',receipt);process.stdout.write(JSON.stringify(receipt)+'\n');
      }
      await new Promise(resolve=>{
        const finish=()=>{clearTimeout(timer);signalResolve=null;resolve();};
        const timer=setTimeout(finish,Math.max(0,due-Date.now()));signalResolve=finish;
      });
    }
    if(cfg.mode==='native'&&!confirmed){
      // The installed physical handler requires the independent confirmation
      // token. Without it no original DOWN can have been consumed, so EOF or
      // cancellation closes positively UNSENT without issuing cleanup input.
      save(out,cfg.name+'-unsent.json',{state:'UNSENT',nonce:cfg.nonce,at:Date.now(),
        independent:true,confirmed:false,physicalRequests:0,permanentClose:true});
      throw Error('unconfirmed native intent closed UNSENT');
    }
    const fired=Date.now(),receipts=[];
    for(const key of [...cfg.keys].reverse())receipts.push(await c.send('Input.dispatchKeyEvent',{type:'keyUp',key:key==='Space'?' ':key,code:key==='Control'?'ControlLeft':key==='y'?'KeyY':key==='n'?'KeyN':key,windowsVirtualKeyCode:KEYS[key]},session));
    const ack=Date.now();assert(ack-armed.at<=1750,'independent UP acknowledgement exceeded 1750ms');
    let released=null;
    if(cfg.mode==='native'){
      // This read-only original-renderer witness records the independently
      // delivered UP even when the stalled/EOF parent never supplied a schedule.
      // The missing-schedule refusal below remains mandatory.
      const physical=await native.evaluate(c,session,`__gta2NativeReleasePageV1.status(${JSON.stringify(cfg.nonce)})`);
      assert.equal(physical.nonce,cfg.nonce);assert.equal(physical.physicalUp,true);
      assert.equal(physical.receipts.length,cfg.keys.length);
      assert(physical.receipts.every(row=>row?.state==='CONSUMED'&&row.nonce===cfg.nonce));
      for(const key of cfg.keys){
        const edges=physical.events.filter(row=>row.nonce===cfg.nonce&&row.key===KEYS[key]);
        assert.deepEqual(edges.map(row=>row.type),['DOWN','UP']);
        assert(ack-edges[0].at<=1750,'actual original renderer independent UP deadline');
      }
      save(out,cfg.name+'-up-physical-proof.json',{...physical,fired,ack,independent:true,scheduled});
      if(!scheduled){
        // EOF/cancel is terminal. UP already reached the original renderer;
        // this never authorizes a fresh capture or another intent.
        throw Error('parent EOF/cancel without completed finite schedule');
      }
      released=await native.evaluate(c,session,`__gta2NativeReleasePageV1.finish(${JSON.stringify({nonce:cfg.nonce,childToken:armed.childToken})})`);
      assert.equal(released.state,'RELEASED');
    }
    save(out,cfg.name+'-up.json',{armed:armed.at,fallback:armed.fallback,due,fired,ack,receipts,released,nonce:cfg.nonce??null,state:'ACK',independent:true});
    await c.send('Target.detachFromTarget',{sessionId:session});
  }catch(error){
    if(cfg.mode==='native'&&armed&&!confirmed&&!fs.existsSync(out+'/'+cfg.name+'-unsent.json'))
      save(out,cfg.name+'-unsent.json',{state:'UNSENT',nonce:cfg.nonce,at:Date.now(),independent:true,
        confirmed:false,physicalRequests:0,permanentClose:true,reason:String(error)});
    if(!c.closed)c.seal(error);throw error;
  }
  finally {clearTimeout(prearmTimer);clearTimeout(operationTimer);c.stop();process.stdin.destroy();
    fs.writeFileSync(out+'/'+cfg.name+'-prearm-phases.jsonl',phases.map(row=>JSON.stringify(row)).join('\n')+'\n',{flag:'wx'});}
}
function prearmDeadlineService(output,bootstrap=null){
  const fs=require('node:fs'),assert=require('node:assert/strict'),readline=require('node:readline');
  let state='READY',config=bootstrap?.releaseIdentity??null,timer,aggregateTimer,finished=false;
  const token=pid=>{const s=fs.readFileSync('/proc/'+pid+'/stat','utf8');return s.slice(s.lastIndexOf(')')+2).split(' ')[19];};
  const send=value=>process.stdout.write(JSON.stringify(value)+'\n');
  const lines=readline.createInterface({input:process.stdin});
  const finish=async(value,terminate=false)=>{
    if(finished)return;finished=true;clearTimeout(timer);clearTimeout(aggregateTimer);
    if(terminate&&config){
      try{
        if(token(config.pid)===config.startToken){
          process.kill(config.pid,'SIGKILL');value.signaledAt=Date.now();
          // Observe quiescence before publishing a terminal receipt. This is
          // not wait evidence: the actual parent must still join both EOFs.
          const until=Date.now()+1000;
          for(;;){
            try{
              const stat=fs.readFileSync('/proc/'+config.pid+'/stat','utf8');
              const fields=stat.slice(stat.lastIndexOf(')')+2).split(' ');
              if(fields[19]!==config.startToken||fields[0]==='Z')break;
            }catch(error){if(error.code==='ENOENT')break;throw error;}
            assert(Date.now()<until,'signaled release child did not quiesce');
            await new Promise(resolve=>setTimeout(resolve,1));
          }
          value.quiescentAt=Date.now();
        }
      }
      catch(error){if(error.code!=='ENOENT'&&error.code!=='ESRCH')throw error;}
    }
    fs.writeFileSync(output+(value.state==='QUALIFIED'?'-qualified.json':'-UNKNOWN.json'),JSON.stringify(value)+'\n',{flag:'wx'});
    send(value);lines.close();process.stdin.destroy();
  };
  lines.on('line',async text=>{
    if(finished)return;
    try{
      const message=JSON.parse(text);
      if(message.action==='start'){
        assert.equal(state,'READY');assert(Number.isSafeInteger(message.startedAt)&&Date.now()>=message.startedAt&&Date.now()-message.startedAt<500);
        assert(Number.isSafeInteger(message.pid)&&message.pid>1);assert.equal(token(message.pid),message.startToken);if(bootstrap){assert.equal(message.pid,bootstrap.releaseIdentity?.pid);assert.equal(message.startToken,bootstrap.releaseIdentity?.startToken);}
        assert(/^[a-z0-9-]{8,100}$/.test(message.nonce));config=message;state='WATCHING';
        timer=setTimeout(async()=>{
          if(state!=='WATCHING')return;state='EXPIRED';
          const value={state,pid:config.pid,startToken:config.startToken,nonce:config.nonce,startedAt:config.startedAt,firedAt:Date.now(),laterRequestsAllowed:0};
          await finish(value,true);
        },Math.max(0,message.startedAt+500-Date.now()));
        send({state:'WATCHING',nonce:message.nonce});return;
      }
      assert.equal(message.action,'complete');assert.equal(state,'WATCHING');
      assert.equal(message.nonce,config.nonce);assert.equal(token(config.pid),config.startToken);
      assert(Date.now()-config.startedAt<=500,'actual independent completion after 500ms');
      state='QUALIFIED';await finish({state,nonce:config.nonce,startedAt:config.startedAt,completedAt:Date.now(),pid:config.pid});
    }catch(error){state='REFUSED';await finish({state,error:String(error),at:Date.now(),laterRequestsAllowed:0},true);process.exitCode=1;}
  });
  lines.on('close',async()=>{
    if(finished)return;state='REFUSED';process.exitCode=1;
    await finish({state,error:'parent EOF before independent qualification',at:Date.now(),laterRequestsAllowed:0},true);
  });if(bootstrap){assert(Number.isSafeInteger(bootstrap.operationStartedAt));aggregateTimer=setTimeout(async()=>{if(finished)return;state='EXPIRED';await finish({state,scope:'aggregate-3000',startedAt:bootstrap.operationStartedAt,firedAt:Date.now(),laterRequestsAllowed:0},true);},Math.max(0,bootstrap.operationStartedAt+3000-Date.now()));}send({state:'READY',pid:process.pid,startToken:token(process.pid),at:Date.now(),executedSourceSHA256:require('node:crypto').createHash('sha256').update(process.execArgv[1]).digest('hex')});
}


// The independent deadline has only builtin imports. Its source comes from the
// current compiled controller, and its actual -e bytes are independently hashed.
// Capture this spawn primitive before test-only release-child fault injection.
const spawnPrearmDeadlineProcess=cp.spawn;
function startPrearmWatchdog(out,name,operationStartedAt,releaseChild){
  const base=path.join(out,name+'-prearm-watchdog');
  let releaseIdentity=null;
  if(Number.isSafeInteger(releaseChild.pid)){
    try{const stat=fs.readFileSync('/proc/'+releaseChild.pid+'/stat','utf8');releaseIdentity={pid:releaseChild.pid,startToken:stat.slice(stat.lastIndexOf(')')+2).split(' ')[19]};}
    catch(error){if(error.code!=='ENOENT')throw error;}
  }
  const bootstrap={operationStartedAt,releaseIdentity};
  const source='('+prearmDeadlineService.toString()+')('+JSON.stringify(base)+','+JSON.stringify(bootstrap)+');';
  const sourceSHA256=sha(Buffer.from(source)),env={...process.env};
  // This process executes only the exact self-contained function above; it
  // neither imports repository modules nor needs a source-view preload/cache.
  delete env.NODE_OPTIONS;
  const child=spawnPrearmDeadlineProcess(process.execPath,['-e',source],{env,stdio:['pipe','pipe','pipe']});
  const messages=[];let stdout='',stderr='',buffer='',waiter=null,closed=null,failure=null,qualified=false;
  const next=deadline=>new Promise((resolve,reject)=>{
    if(messages.length)return resolve(messages.shift());
    if(failure)return reject(failure);
    if(closed)return reject(Error('independent prearm watchdog already closed'));
    assert(!waiter,'one watchdog reply at a time');
    const timer=setTimeout(()=>{waiter=null;reject(Error('independent prearm watchdog reply deadline'));},Math.max(0,deadline-Date.now()));
    waiter={resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}};
  });
  child.stdin.on('error',error=>{if(!qualified)failure=error;});
  child.stdout.on('data',bytes=>{
    stdout+=bytes;buffer+=bytes;let end;
    while((end=buffer.indexOf('\n'))>=0){
      const text=buffer.slice(0,end);buffer=buffer.slice(end+1);
      try{const value=JSON.parse(text);if(waiter){const current=waiter;waiter=null;current.resolve(value);}else messages.push(value);}
      catch(error){failure=error;waiter?.reject(error);waiter=null;}
    }
  });
  child.stderr.on('data',bytes=>stderr+=bytes);
  const joined=new Promise(resolve=>{
    child.once('error',error=>{failure=error;waiter?.reject(error);waiter=null;});
    child.once('close',(code,signal)=>{closed={pid:child.pid??null,code,signal};waiter?.reject(Error('independent prearm watchdog closed '+code));waiter=null;resolve(closed);});
  });
  const ready=next(operationStartedAt+3000).then(value=>{
    assert.equal(value.state,'READY');assert.equal(value.pid,child.pid);
    assert.equal(value.executedSourceSHA256,sourceSHA256,'actual independent deadline source bytes');
    const stat=fs.readFileSync('/proc/'+value.pid+'/stat','utf8');
    assert.equal(stat.slice(stat.lastIndexOf(')')+2).split(' ')[19],value.startToken,'watchdog process start identity');
    save(out,name+'-prearm-watchdog-initialization.json',{...value,sourceSHA256,operationStartedAt,
      repositoryImports:0,nativeObservationsCached:false,sourceInventoriesCached:false,moduleBytesCached:false});
    return value;
  });
  ready.catch(()=>{});
  return {
    ready,
    async start(config,release){
      await ready;
      child.stdin.write(JSON.stringify({action:'start',pid:release.pid,startToken:release.startToken,startedAt:config.startedAt,nonce:config.nonce})+'\n');
      const value=await next(config.startedAt+500);
      assert.equal(value.state,'WATCHING');assert.equal(value.nonce,config.nonce);
      assert(Date.now()-config.startedAt<=500,'independent deadline was not armed in time');
    },
    async complete(config){
      child.stdin.write(JSON.stringify({action:'complete',nonce:config.nonce})+'\n');
      const value=await next(config.startedAt+500);
      assert.equal(value.state,'QUALIFIED');assert.equal(value.nonce,config.nonce);
      assert.equal(value.startedAt,config.startedAt);
      assert(value.completedAt>=config.startedAt&&value.completedAt-config.startedAt<=500&&Date.now()-config.startedAt<=500,
        'independent complete current attestation exceeded 500ms');
      qualified=true;return value;
    },
    async close(){
      child.stdin.end();const result=await joined;
      const receipt={...result,actualWait:true,stdoutEOF:child.stdout.readableEnded,stderrEOF:child.stderr.readableEnded,stdout,stderr,sourceSHA256,qualified};
      save(out,name+'-prearm-watchdog-wait.json',receipt);
      assert(receipt.stdoutEOF&&receipt.stderrEOF,'actual watchdog wait and both EOFs');
      if(qualified)assert.equal(result.code,0,'qualified deadline process exit');
      return receipt;
    },
  };
}

async function releaseGesture({c,session,out,name,keys,ms,cfg,beforeDown=()=>{},finalChecks=()=>{},onAttempt=()=>{}}) {
  assert(Number.isInteger(ms)&&ms>=80&&ms<=1400);
  const native=require('./gta2-browser-release-binding.cjs'),stat=fs.readFileSync('/proc/'+process.pid+'/stat','utf8');
  const operationStartedAt=Date.now();let messageDeadline=operationStartedAt+3000,config;
  save(out,name+'-release-initialization.json',{name,operationStartedAt,url:cfg.url,pid:cfg.pid,startToken:cfg.startToken,phasePipe:true,
    targetId:cfg.targetId,workerTargets:cfg.owner?.workerTarget?[cfg.owner.workerTarget,...(cfg.owner.rendererTarget!=='none'?[cfg.owner.rendererTarget]:[])]:[]});
  const child=cp.spawn(process.execPath,[__filename,'release-preinit',out,out+'/'+name+'-release-initialization.json'],{stdio:['pipe','pipe','pipe','pipe']});
  const watchdog=startPrearmWatchdog(out,name,operationStartedAt,child);
  const previousRequestGuard=c.requestGuard;
  c.requestGuard=()=>{
    previousRequestGuard?.();
    assert(!fs.existsSync(path.join(out,name+'-UNKNOWN.json'))&&
      !fs.existsSync(path.join(out,name+'-prearm-watchdog-UNKNOWN.json')),'independent child permanently UNKNOWN');
  };
  let output='',errors='',phaseOutput='',error,armTimer,armed,childError,messageBuffer='',messageWaiter;
  child.stdio[3].on('data',bytes=>phaseOutput+=bytes);
  const messages=[];
  child.stdout.on('data',b=>{
    output+=b;messageBuffer+=b;let end;
    while((end=messageBuffer.indexOf('\n'))>=0){
      const line=messageBuffer.slice(0,end);messageBuffer=messageBuffer.slice(end+1);
      try{const value=JSON.parse(line);if(messageWaiter){const waiter=messageWaiter;messageWaiter=null;waiter.resolve(value);}else messages.push(value);}
      catch(e){if(messageWaiter){messageWaiter.reject(e);messageWaiter=null;}else childError=e;}
    }
  });
  const nextMessage=()=>new Promise((resolve,reject)=>{
    if(messages.length)return resolve(messages.shift());
    if(childError)return reject(childError);
    const timer=setTimeout(()=>{messageWaiter=null;reject(Error('release initialization/prearm/confirmation timeout'));},Math.max(0,messageDeadline-Date.now()));
    messageWaiter={resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}};
  });
  child.stderr.on('data',b=>errors+=b);child.stdin.on('error',e=>{childError=e;});
  const joined=new Promise(resolve=>{child.once('error',e=>{childError=e;messageWaiter?.reject(e);messageWaiter=null;});
    child.once('close',(code,signal)=>{messageWaiter?.reject(Error('release child exit '+code));messageWaiter=null;resolve({pid:child.pid??null,code,signal});});});
  const events=[];
  let aggregateExpired=false;
  const aggregateTimer=setTimeout(()=>{aggregateExpired=true;
    messageWaiter?.reject(Error('aggregate release timeout'));messageWaiter=null;child.stdin.end();},Math.max(0,operationStartedAt+3000-Date.now()));
  try {
    const [initialized]=await Promise.all([nextMessage(),watchdog.ready]);assert.equal(initialized.state,'INITIALIZED');
    native.checkPID(initialized.pid,initialized.startToken);assert.equal(initialized.pid,child.pid);
    assert(initialized.loadedFromExactBytes===true);
    assert(initialized.nativeObservationsCached===false&&initialized.sourceInventoriesCached===false&&initialized.moduleBytesCached===false);
    for(const loaded of initialized.loadedSources)assert.equal(loaded.sha256,cfg.pins.files.find(p=>p.path===loaded.path)?.sha256);
    native.verifyPins(cfg.pins);native.checkPID(cfg.pid,cfg.startToken);
    save(out,name+'-initialized.json',initialized);
    config={...cfg,name,keys,mode:'native',parentPID:process.pid,parentStartToken:stat.slice(stat.lastIndexOf(')')+2).split(' ')[19],
      operationStartedAt,initializedAt:initialized.at,startedAt:Date.now()};
    messageDeadline=config.startedAt+500;
    // Arm the separate 500ms process before parent configuration IO.
    await watchdog.start(config,initialized);
    await saveAsync(out,name+'-release-config.json',config);
    c.requestGuard();native.checkPID(initialized.pid,initialized.startToken);
    assert(Date.now()-config.startedAt<=500,'configuration IO exceeded fixed prearm deadline');
    child.stdin.write(JSON.stringify({file:out+'/'+name+'-release-config.json'})+'\n');
    armed=await nextMessage();
    clearTimeout(armTimer);assert(armed.armed&&armed.nonce===cfg.nonce&&Date.now()-config.startedAt<=500,'actual independent child arm within 500ms');
    assert.equal(armed.bindingToken,cfg.bindingToken);assert.deepEqual(armed.native,cfg.review.native);assert.deepEqual(armed.pageIdentity,cfg.review.pageIdentity);
    native.checkPID(armed.pid,armed.startToken);
    for(const key of keys){
      await beforeDown();native.checkPID(cfg.pid,cfg.startToken);
      if(!events.length){
        const leaseToken=crypto.randomUUID();
        child.stdin.write(JSON.stringify({action:'confirm',nonce:cfg.nonce,childToken:armed.childToken,leaseToken})+'\n');
        // Hook/fault ordering remains before confirmation. Both original
        // parent freshness passes run after ARM while the child confirms.
        await finalChecks();
        await native.verifyPinsAsync(cfg.pins);
        const current=await nextMessage();
        assert.equal(current.state,'CONFIRMED');assert.equal(current.nonce,cfg.nonce);
        assert.equal(current.childToken,armed.childToken);assert.equal(current.leaseToken,leaseToken);
        assert.equal(current.pid,armed.pid);assert.equal(current.startedAt,config.startedAt);
        assert.deepEqual(current.native,cfg.review.native);assert.deepEqual(current.pageIdentity,cfg.review.pageIdentity);
        assert(Date.now()-config.startedAt<=500,'all independent current gates within 500ms');
        native.checkPID(armed.pid,armed.startToken);
        const complete=await watchdog.complete(config);
        save(out,name+'-complete-current-prearm.json',complete);
      }else {await finalChecks();await native.verifyPinsAsync(cfg.pins);}
      assert(Date.now()<armed.fallback-250,'native release lease expired');
      assert(!aggregateExpired&&Date.now()-operationStartedAt<=3000,'actual release aggregate deadline');
      assert(Date.now()-config.startedAt<=500,'actual current physical DOWN deadline');
      const before=Date.now();onAttempt();
      await c.send('Input.dispatchKeyEvent',{type:'keyDown',key:key==='Space'?' ':key,code:key==='Control'?'ControlLeft':key==='y'?'KeyY':key==='n'?'KeyN':key,windowsVirtualKeyCode:KEYS[key]},session);
      const consumed=await native.evaluate(c,session,`__gta2NativeReleasePageV1.consumed(${JSON.stringify({nonce:cfg.nonce,key:KEYS[key]})})`);
      assert.equal(consumed.state,'CONSUMED');assert.equal(consumed.nonce,cfg.nonce);
      events.push({key,before,ack:Date.now(),consumed});
    }
    child.stdin.write(JSON.stringify({at:Math.min(armed.fallback,events[0].consumed.at+ms)})+'\n');
  }catch(e){error=e;}
  finally {
    clearTimeout(armTimer);child.stdin.end();const result=await joined;
    assert(child.stdio[3].readableEnded,'actual phase pipe EOF');
    fs.writeFileSync(out+'/'+name+'-observed-prearm-phases.jsonl',phaseOutput,{flag:'wx'});
    try{await watchdog.close();}catch(e){error??=e;}
    clearTimeout(aggregateTimer);
    save(out,name+'-release-wait.json',{...result,actualWait:true,stdoutEOF:child.stdout.readableEnded,stderrEOF:child.stderr.readableEnded,stdout:output,stderr:errors});
    if(result.code!==0)error??=Error('release child failed '+result.code+' '+errors);
    error??=childError;
    if(aggregateExpired)error??=Error('release gesture exceeded aggregate 3000ms');
  }
  if(error){if(!c.closed)c.seal(error);throw error;}
  c.requestGuard=previousRequestGuard;
  const up=JSON.parse(fs.readFileSync(out+'/'+name+'-up.json'));
  assert(up.released?.physicalUp,'independent original renderer physical UP required');
  assert(events.every(e=>up.ack-e.before<=1750),'physical UP exceeded 1750ms');
  for(const key of keys){
    const edges=up.released.events.filter(e=>e.key===KEYS[key]);assert.deepEqual(edges.map(e=>e.type),['DOWN','UP']);
    assert(edges[1].at-edges[0].at>=80&&edges[1].at-edges[0].at<=1400,'actual original physical edge order/bounds');
  }
  return {armed,events,up,noReplay:true};
}
async function browser(out,backend) {
  assert(['software','webgl','controls'].includes(backend));
  const launch=JSON.parse(fs.readFileSync(out+'/launch.json'));
  const pins=JSON.parse(fs.readFileSync(out+'/pins.json'));
  function verifyPins(){for(const p of pins.files)assert.equal(sha(fs.readFileSync(ROOT+'/'+p.path)),p.sha256,p.path);}
  verifyPins();const pinMap=new Map(pins.files.map(p=>['/'+p.path,p.sha256]));
  let server,browser,chromeWait,c,session,chain,latest,bound,bridgeOptions,closing=false,phase=false;
  const workers=new Map(),tasks=[];
  const record=(n,v)=>save(out,n,v),log=(n,v)=>fs.appendFileSync(out+'/'+n,JSON.stringify(v)+'\n');
  async function evaluate(expression,s=session){const v=await c.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},s);if(v.exceptionDetails)throw Error(JSON.stringify(v.exceptionDetails));return v.result.value;}
  async function state(){
    const page=await evaluate(`({at:Date.now(),apps:runningApps.map(a=>({name:a.name,running:a.wine?.running,stopped:a.wine?._stopped,processId:a.wine?.processId,slice:a.wine?._workerLastSlice,d3dStats:a.wine?.guestWorker?.d3dStats,exitCode:a.wine?._exitCode})),retiredOwner:globalThis.__gta2PassiveOwner?{processId:__gta2PassiveOwner.processId,running:__gta2PassiveOwner.running,stopped:__gta2PassiveOwner._stopped,nativeExitCode:__gta2PassiveOwner._exitCode??null,processExited:__gta2PassiveOwner._processObject?.exited,processExitCode:__gta2PassiveOwner._processObject?.exitCode}:null,log:document.getElementById('log')?.textContent?.slice(-12000)})`);
    const owners=[];
    for(const w of workers.values())if(!w.closed&&w.url.includes('d3d-render-worker'))owners.push({targetId:w.targetId,sessionId:w.sessionId,value:await evaluate(`Array.from(endpoints,([id,e])=>({id,options:e.options,failed:e.failed?String(e.failed):null,evidence:e.evidence,adapterPresent:!!e.adapter,targets:e.adapter?.inspectTargets?.()??null,software:e.adapter?.d3dimSoftwareDrawCallsCompleted??null,control:e.control?Array.from(e.control):null}))`,w.sessionId)});
    return {...page,owners,workers:[...workers.values()]};
  }
  async function capture(name){
    verifyPins();assert(/^[a-z0-9-]+$/.test(name));assert(!fs.existsSync(out+'/'+name+'.png'));
    const nativeBefore=await evaluate('__gta2NativeReleasePageV1.read()');
    const captured=await chain.capture(name);
    const nativeAfter=await evaluate('__gta2NativeReleasePageV1.read()');assert.deepEqual(nativeBefore,nativeAfter,'native scene changed during full capture');
    captured.capture.nativeReview={...nativeAfter,capturedAt:Date.parse(captured.capture.at),pngSHA256:captured.capture.sha256};
    fs.writeFileSync(out+'/'+name+'.png',captured.png,{flag:'wx'});
    latest=captured.capture;record(name+'.json',{...captured,png:undefined});const observed=await state();record(name+'-state.json',observed);
    if(latest.identity.renderEndpoint!=='none'){
      const owners=observed.owners.flatMap(w=>w.value.filter(e=>e.id===latest.identity.renderEndpoint&&w.targetId===latest.identity.rendererTarget));
      assert.equal(owners.length,1,'unique actual owning backend');assert.equal(owners[0].options.api,'legacy');assert.equal(owners[0].options.backend,backend,'actual backend differs from selected arm');assert(!owners[0].failed);
    }
    return latest;
  }
  async function close(reason){
    if(closing)return;closing=true;record('close-reason.json',{reason,at:Date.now(),hostOnly:true});
    if(c){c.event=()=>{};c.stop();} // Host teardown uses OS signals; no later CDP request after failure.
    if(browser){browser.kill('SIGTERM');let timer;try{await Promise.race([chromeWait,new Promise((_,j)=>{timer=setTimeout(()=>j(Error('browser close timeout')),3000);})]);}catch(e){browser.kill('SIGKILL');await chromeWait;}finally{clearTimeout(timer);}}
    c?.ws.close();server?.closeAllConnections();if(server)await new Promise(r=>server.close(r));fs.rmSync(out+'/profile',{recursive:true,force:true});record('closed.json',{at:Date.now(),nativeQuitClaim:false});
  }
  try {
    const staticServer=require(ROOT+'/test/static-server.js');
    server=await staticServer.startStaticServer({root:ROOT,crossOriginIsolated:true,
      rewritePath:p=>p.startsWith('/binaries/')?'/test'+p:p,
      handleRequest:async(req,res)=>{
        const name=new URL(req.url,'http://127.0.0.1').pathname;
        if(!process.env.GTA2_VIEW_HEAD||! /\.(?:js|html|json|css|wat|watx)$/.test(name))return false;
        const resolved=await staticServer.resolveStaticPath(ROOT,req.url);
        if(resolved.status!==200)return false;
        const body=fs.readFileSync(resolved.file);
        res.writeHead(200,{'Content-Type':staticServer.mimeType(resolved.file),'Cache-Control':'no-store'});
        res.end(body);return true;
      }});
    server.prependListener('request',(req,res)=>{const h=crypto.createHash('sha256');let size=0;const add=b=>{if(b){b=Buffer.isBuffer(b)?b:Buffer.from(b);size+=b.length;h.update(b);}},wr=res.write,en=res.end;res.write=function(b){add(b);return wr.apply(this,arguments);};res.end=function(b){add(b);return en.apply(this,arguments);};res.once('finish',()=>{const hash=h.digest('hex'),url=new URL(req.url,'http://localhost').pathname,file=url.startsWith('/binaries/')?'/test'+url:url;log('http.jsonl',{url:req.url,status:res.statusCode,size,sha256:hash});if(res.statusCode===200&&pinMap.has(file)&&pinMap.get(file)!==hash)c?.seal('HTTP pin mismatch '+file);});});
    const port=server.address().port;
    for(const p of pins.http){const r=await fetch('http://127.0.0.1:'+port+p.url);assert.equal(r.status,200);assert.equal(sha(Buffer.from(await r.arrayBuffer())),p.sha256);}
    record('http-dependency-check.json',{passed:true,pins:pins.http});
    browser=cp.spawn('/usr/bin/google-chrome',['--headless=new','--no-sandbox','--no-first-run','--no-default-browser-check','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--window-size=1024,900','--remote-debugging-port=0','--user-data-dir='+out+'/profile','about:blank'],{stdio:['ignore','pipe','pipe']});
    const stdout=fs.createWriteStream(out+'/chrome.stdout',{flags:'wx'}),stderr=fs.createWriteStream(out+'/chrome.stderr',{flags:'wx'});browser.stdout.pipe(stdout);browser.stderr.pipe(stderr);
    chromeWait=new Promise(r=>browser.once('close',(code,signal)=>{record('chrome-wait.json',{pid:browser.pid,code,signal,actualWait:true,stdoutEOF:browser.stdout.readableEnded,stderrEOF:browser.stderr.readableEnded,at:Date.now()});r();}));
    const stat=fs.readFileSync('/proc/'+browser.pid+'/stat','utf8'),startToken=stat.slice(stat.lastIndexOf(')')+2).split(' ')[19];
    record('browser-pid.json',{pid:browser.pid,startToken,port,at:Date.now()});
    const active=out+'/profile/DevToolsActivePort',endpointDeadline=Date.now()+3000;let url;
    while(!(url=devtoolsEndpoint(active))){assert(browser.exitCode===null);assert(Date.now()<endpointDeadline,'complete Chrome endpoint within 3000ms');await wait(25);}
    c=connection(url,v=>record('UNKNOWN.json',v));await c.ready;
    record('endpoint.json',{url,pid:browser.pid,startToken});
    c.event=v=>{
      if(v.method==='Target.attachedToTarget'&&v.params.targetInfo.type==='worker'){
        const {sessionId,targetInfo}=v.params,w={sessionId,targetId:targetInfo.targetId,url:targetInfo.url,scripts:[],closed:false};workers.set(sessionId,w);
        const task=(async()=>{await c.send('Runtime.enable',{},sessionId);await c.send('Debugger.enable',{},sessionId);await c.send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true},sessionId);await c.send('Runtime.runIfWaitingForDebugger',{},sessionId);})();tasks.push(task);task.catch(e=>log('worker-errors.jsonl',{error:String(e)}));
      } else if(v.method==='Target.detachedFromTarget'){const w=workers.get(v.params.sessionId);if(w)w.closed=true;}
      else if(v.method==='Debugger.scriptParsed'&&workers.has(v.sessionId)){
        const w=workers.get(v.sessionId),p=v.params,row={url:p.url,scriptId:p.scriptId};w.scripts.push(row);
        const task=c.send('Debugger.getScriptSource',{scriptId:p.scriptId},v.sessionId).then(s=>{const b=s.bytecode?Buffer.from(s.bytecode,'base64'):Buffer.from(s.scriptSource||'');row.bytecodeAvailable=!!s.bytecode;row.sha256=sha(b);row.size=b.length;});tasks.push(task);task.catch(e=>row.error=String(e));
      } else if(['Runtime.consoleAPICalled','Runtime.exceptionThrown'].includes(v.method))log('console.jsonl',v);
    };
    record('browser-version.json',await c.send('Browser.getVersion'));record('system-info.json',await c.send('SystemInfo.getInfo'));
    const tabs=(await c.send('Target.getTargets')).targetInfos.filter(t=>t.type==='page');assert.equal(tabs.length,1);
    const targetId=tabs[0].targetId;session=(await c.send('Target.attachToTarget',{targetId,flatten:true})).sessionId;
    await c.send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true},session);await c.send('Page.enable',{},session);await c.send('Runtime.enable',{},session);
    chain=require(ROOT+'/'+HELPER).createChain({evaluate,send:c.send,workers,pageSession:session,app:'gta2_demo',expectedModules:pins.modules});
    record('page-target.json',{targetId,session});
    if(backend==='controls'){
      await evaluate(`globalThis.keyProof=[];for(const type of ['keydown','keyup'])addEventListener(type,e=>keyProof.push({type,key:e.key,trusted:e.isTrusted,at:Date.now()}));`);
      for(const [i,key] of Object.keys(KEYS).entries()){
        const name='control-'+i,config={url,pid:browser.pid,startToken,targetId,keys:[key],name,mode:'blank-control',startedAt:Date.now()};record(name+'-release-config.json',config);
        const child=cp.spawn(process.execPath,[__filename,'release',out,out+'/'+name+'-release-config.json'],{stdio:['pipe','pipe','pipe']});let stdout='',stderr='',stdinError;child.stdin.on('error',e=>stdinError=e);child.stderr.on('data',b=>stderr+=b);const joined=new Promise(r=>child.once('close',(code,signal)=>r({code,signal})));
        let armed,result,armError;
        try {
          armed=await new Promise((r,j)=>{const t=setTimeout(()=>j(Error('native release arm timeout')),Math.max(0,500-(Date.now()-config.startedAt)));child.stdout.on('data',b=>{stdout+=b;if(stdout.includes('\n')){clearTimeout(t);try{r(JSON.parse(stdout.split('\n')[0]));}catch(e){j(e);}}});child.once('error',e=>{clearTimeout(t);j(e);});child.once('exit',code=>{if(!stdout){clearTimeout(t);j(Error('release child exit '+code));}});});
          assert(armed.armed&&Date.now()-config.startedAt<=500);
          const before=Date.now();await c.send('Input.dispatchKeyEvent',{type:'keyDown',key:key==='Space'?' ':key,code:key==='Control'?'ControlLeft':key==='y'?'KeyY':key==='n'?'KeyN':key,windowsVirtualKeyCode:KEYS[key]},session);child.stdin.write(JSON.stringify({at:before+120})+'\n');
        }catch(error){armError=error;}
        finally{child.stdin.end();result=await joined;record(name+'-wait.json',{...result,pid:child.pid,actualWait:true,stdoutEOF:child.stdout.readableEnded,stderrEOF:child.stderr.readableEnded,stdout,stderr});}
        if(armError||stdinError)throw armError||stdinError;assert.equal(result.code,0,stderr);
      }
      const proof=await evaluate('keyProof');assert.equal(proof.length,Object.keys(KEYS).length*2);assert(proof.every(e=>e.trusted));for(let i=0;i<proof.length;i+=2){assert.equal(proof[i].type,'keydown');assert.equal(proof[i+1].type,'keyup');assert.equal(proof[i].key,proof[i+1].key);assert(proof[i+1].at-proof[i].at<=1750);}
      record('native-controls.json',{passed:true,proof,originalLaunched:false});await close('blank-page native input controls complete');return;
    }
    await c.send('Page.navigate',{url:'http://127.0.0.1:'+port+'/index.html?debug&threads&d3d-renderer='+backend+'&app=gta2_demo'},session);
    const startupEnd=Math.min(Date.now()+60000,(launch.deadline-180)*1000);
    for(;;){
      const fatal=await evaluate(`!!document.getElementById('wine-crash-report')`);if(fatal){const shot=await c.send('Page.captureScreenshot',{format:'png'},session);const png=Buffer.from(shot.data,'base64');fs.writeFileSync(out+'/startup-failure.png',png,{flag:'wx'});record('startup-failure.json',{at:Date.now(),sha256:sha(png),diagnostic:true,nativeQuit:false});throw Error('original fatal launch report');}
      const ready=await evaluate(`typeof runningApps==='undefined'?null:runningApps.map(a=>({name:a.name,running:a.wine?.running,stopped:a.wine?._stopped,worker:!!a.wine?.guestWorker,slice:!!a.wine?._workerLastSlice}))`);
      if(ready?.length===1&&ready[0].running&&ready[0].worker&&ready[0].slice)break;
      assert(!ready?.some(a=>a.stopped),'original stopped during startup');assert(Date.now()<startupEnd,'bounded original startup readiness');await wait(250);
    }
    await Promise.all(tasks);record('executed-sources.json',{workers:[...workers.values()]});
    bridgeOptions=await require('./gta2-browser-release-binding.cjs').install({c,pageSession:session,workers,app:'gta2_demo',backend});
    record('native-bridge.json',{bridgeOptions});await boundedOperation(c,'startup capture',()=>capture('startup'));
    bound=latest.identity;record('permanent-owner.json',{identity:bound,browser:{pid:browser.pid,startToken},backend,noReplay:true});
    await evaluate(`(()=>{if(Object.hasOwn(globalThis,'__gta2PassiveOwner'))throw Error('owner reference already bound');Object.defineProperty(globalThis,'__gta2PassiveOwner',{value:runningApps[0].wine});return true;})()`);
    record('ready.json',{at:Date.now(),backend});
    for(let n=0;!closing;n++) {
      const file=out+'/command-'+n+'.json';while(!fs.existsSync(file)&&Date.now()<launch.deadline*1000)await wait(25);
      assert(Date.now()<launch.deadline*1000,'fixed deadline');const cmd=JSON.parse(fs.readFileSync(file));assert(!fs.existsSync(out+'/receipt-'+n+'.json'));
      await boundedOperation(c,'manual operation '+cmd.action,async()=>{
      if(cmd.action==='close'){record('terminal-state.json',await state());await close('reviewed host teardown');record('receipt-'+n+'.json',{state:'ACK',hostOnly:true});return;}
      if(cmd.action==='terminal'){
        assert(phase,'reviewed irreversible Quit phase required');const terminal=await state();assert(terminal.retiredOwner?.processExited===true,'actual original owner has not exited');
        const at=Date.now(),shot=await c.send('Page.captureScreenshot',{format:'png'},session),png=Buffer.from(shot.data,'base64');assert(/^[a-z0-9-]+$/.test(cmd.name));fs.writeFileSync(out+'/'+cmd.name+'.png',png,{flag:'wx'});record(cmd.name+'.json',{at,terminal,pngSHA256:sha(png),nativeQuitClaim:false});record('receipt-'+n+'.json',{state:'ACK',at:Date.now()});return;
      }
      if(cmd.action==='capture'){await capture(cmd.name);record('receipt-'+n+'.json',{state:'ACK',capture:latest});return;}
      assert.equal(cmd.action,'pulse');verifyPins();const maxAge=policy(cmd,launch,phase);assert(!fs.existsSync(out+'/nonce-'+cmd.nonce+'.json'),'gesture nonce cannot be reused');record('nonce-'+cmd.nonce+'.json',{intent:cmd.intent,name:cmd.name,at:Date.now()});
      if(cmd.mode==='quit'){phase=true;if(!fs.existsSync(out+'/quit-phase.json'))record('quit-phase.json',{at:Date.now(),cutoff:(launch.deadline-180)*1000,irreversible:true,route:cmd.route});}
      assert.equal(cmd.review,latest.label);assert(!fs.existsSync(out+'/'+latest.label+'-used.json'),'fresh full scene before each gesture');const review={...latest,review:cmd.observation};record(cmd.name+'-review.json',{...review,mode:cmd.mode,route:cmd.route});
      assert.equal(sha(fs.readFileSync(out+'/'+latest.label+'.png')),latest.sha256,'reviewed fullscene bytes changed');
      require(ROOT+'/'+HELPER).same(bound,latest.identity);
      if(Date.now()-Date.parse(latest.at)>=maxAge){record('receipt-'+n+'.json',{state:'NOT_SENT',effects:0,reason:'fresh scene expired',newIntentOnly:true});return;}
      record(latest.label+'-used.json',{intent:cmd.name,at:Date.now()});let attempted=false;
      await chain.admit(review,async admission=>{
        require(ROOT+'/'+HELPER).same(bound,admission.live.identity);policy(cmd,launch,phase&&cmd.mode!=='quit');
        const nativeReview={...latest.nativeReview,reviewed:true,observation:cmd.observation,maxAgeMs:maxAge};
        const binding=await evaluate(`__gta2NativeReleasePageV1.bind(${JSON.stringify(nativeReview)})`);
        const result=await releaseGesture({c,session,out,name:cmd.name,keys:cmd.keys,ms:cmd.ms,
          cfg:{...JSON.parse(fs.readFileSync(out+'/endpoint.json')),targetId,owner:bound,pins,bridgeOptions,
            review:nativeReview,bindingToken:binding.bindingToken,nonce:cmd.nonce,intent:cmd.intent},
          beforeDown:async()=>{policy(cmd,launch,phase&&cmd.mode!=='quit');},
          finalChecks:async()=>{await require('./gta2-browser-release-binding.cjs').verifyPinsAsync(pins);policy(cmd,launch,phase&&cmd.mode!=='quit');},
          onAttempt:()=>{attempted=true;}});
        record(cmd.name+'-delivery.json',{...result,admission,attempted});
      });
      record('receipt-'+n+'.json',{state:attempted?'ACK':'NOT_SENT',effects:attempted?cmd.keys.length:0,noReplay:true,at:Date.now()});
      });
    }
  }catch(e){if(!fs.existsSync(out+'/executed-sources.json'))record('executed-sources.json',{workers:[...workers.values()]});if(c&&!c.closed)c.seal('first causal failure: '+e);if(!fs.existsSync(out+'/UNKNOWN.json'))record('UNKNOWN.json',{state:'UNKNOWN',reason:String(e),at:Date.now(),permanentClose:true,laterRequestsAllowed:0});record('failure.json',{error:e.stack,noReplay:true,at:Date.now()});process.exitCode=1;await close('first causal failure');}
}
if(require.main===module){const [mode,out,arg]=process.argv.slice(2);(mode==='release'?release(out,arg):mode==='release-preinit'?releasePreinit(out,arg):browser(out,arg)).catch(e=>{console.error(e);process.exitCode=1;});}
module.exports={LoopbackWebSocket,prearmDeadlineService,policy,KEYS,HELPER,sha,connection,release,releasePreinit,releaseGesture,boundedOperation,devtoolsEndpoint};
