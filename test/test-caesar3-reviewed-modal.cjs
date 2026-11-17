#!/usr/bin/env node
'use strict';
// Focused authored native owned MessageBox route; original media never run.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),net=require('node:net');
const crypto=require('node:crypto'),assert=require('node:assert/strict');
const NP=require('../tools/native-proc.cjs');
const ROOT=path.resolve(__dirname,'..');
// Python importlib.util.spec_from_file_location: a fresh module instance per call.
function module_(file){
  const p=path.join(ROOT,file);delete require.cache[require.resolve(p)];
  const m=require(p);delete require.cache[require.resolve(p)];return m;
}
const clone=v=>structuredClone(v);
// Python AssertionError: node:assert and the controller's check() both carry ERR_ASSERTION.
const isAssert=e=>e?.code==='ERR_ASSERTION';
const isRefusal=e=>isAssert(e)||e instanceof TypeError; // Python (AssertionError,KeyError,TypeError)
async function freePort(){
  const s=net.createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const port=s.address().port;await new Promise(r=>s.close(r));return port;
}

function mapping_units(){
  const tool=module_('tools/caesar3-reviewed-modal.js');
  const common={live:true,visible:true,generation:'1',processId:1000,threadId:1,isChild:false,controlClass:0};
  const main={...common,hwnd:'0x10001'};
  const modal={...common,hwnd:'0x10002',owner:main.hwnd,controlClass:16,
    nativeClientRect:{screenX:40,screenY:60,w:300,h:140}};
  const button={...common,hwnd:'0x10004',parent:modal.hwnd,isChild:true,
    controlClass:1,style:0,nativeTextAvailable:true,title:'Yes',
    screenX:100,screenY:100,w:72,h:24};
  // Python shares these dict objects between windows/focusWindow/nativeMessageBox.
  const s={windows:[main,modal,button],mainHwnd:main.hwnd,modalHwnd:modal.hwnd,
    focusWindow:button,focus:button.hwnd,nativeMessageBox:modal,
    nativeDialogBox:null,focusTopLevel:modal.hwnd,physicalUp:true,
    capture:'0x0',screen:{w:1024,h:712}};
  const identity={srcX:0,srcY:0,srcW:1024,srcH:712,dstX:0,dstY:0,dstW:1024,dstH:712};
  const scaled={srcX:40,srcY:30,srcW:800,srcH:600,dstX:100,dstY:56,dstW:800,dstH:600};
  const cases=[[null,null,120,110],[identity,null,120,110],[scaled,null,180,136],
    [identity,{outputW:2048,outputH:1424,dstX:200,dstY:112,dstW:1600,dstH:1200,
      nativeX:40,nativeY:30,nativeW:800,nativeH:600},180,136]];
  const rejected=[];
  for(const [transform,viewport,x,y] of cases){
    s.pointerMapping={canvas:s.screen,sourceHwnd:parseInt(main.hwnd,16),transform,viewport,clip:null};
    const p=tool.preflight(s,button.hwnd,x,y,'Yes');
    assert.deepStrictEqual([p.nativeX,p.nativeY],[120,110]);
    const mutations=[['canvas',t=>Object.assign(t.pointerMapping,{canvas:{w:0,h:1}})],
      ['clip',t=>Object.assign(t.pointerMapping,{clip:{left:0,top:0,right:80,bottom:80}})],
      ['ancestor',t=>Object.assign(t.windows[1].nativeClientRect,{w:20})]];
    if(transform)mutations.push(['source',t=>Object.assign(t.pointerMapping,{sourceHwnd:99})],
      ['transform',t=>Object.assign(t.pointerMapping.transform,{srcW:0})]);
    for(const [name,mutate] of mutations){
      const changed=clone(s);mutate(changed);
      try{tool.preflight(changed,button.hwnd,x,y,'Yes');}
      catch(e){if(!isRefusal(e))throw e;rejected.push(name);continue;}
      throw new assert.AssertionError({message:'accepted '+name});
    }
    for(const [px,py] of [[-1,0],[1024,0],[0,712],[0,0],[500,300]]){
      try{tool.preflight(s,button.hwnd,px,py,'Yes');}
      catch(e){if(!isAssert(e))throw e;rejected.push('outside');continue;}
      throw new assert.AssertionError({message:'outside accepted'});
    }
  }
  console.log(JSON.stringify({passed:true,cases:cases.length,refused:rejected.length,productionMapper:true}));
}

async function supervise(run,env){
  const c=module_('tools/caesar3-current-native.js');c.RUN=run;
  fs.mkdirSync(path.join(run,'desktop-observations'),{recursive:true});
  const port=JSON.parse(fs.readFileSync(path.join(run,'launch.json'),'utf8')).rootPort;
  const args=['node','test/run.js','--exe='+path.join(run,'modal.exe'),'--no-build','--threads','--real-ticks',
    '--native-exit-receipt='+path.join(run,'native-exit.json'),'--native-invocation-token='+crypto.randomUUID(),
    '--control='+port,'--screen='+(env.CAESAR3_FIXTURE_SCREEN||'800x600'),'--png-canvas','--max-seconds=90',
    '--max-batches=1000000000','--stuck-after=0','--quiet-api','--quiet-blocks'];
  await c.execute_native(args,env,[],port,args[7].split('=').slice(1).join('='),NP.now()+95);
}

function modalFixture(out){
  // Only this authored PE is edited: visible main + owned Yes/No MessageBox.
  const b=require('./test-vb5-normal-exit-native.cjs').fixture('normal'),raw=r=>r-0x1000+0x200;
  // Only authored guest code: finite real-tick tail after native dialog returns.
  const wait=b.indexOf(Buffer.from([0x3d,0xf4,1,0,0,0x72]));assert(wait>0);b.writeUInt32LE(50,wait+1);
  b.write('Authored modal\0',raw(0x2570));b.fill(0,raw(0x2540),raw(0x2570));b.write('Quit\0',raw(0x2540));
  b.fill(0,raw(0x2580),raw(0x2600));b.write('Leave the authored fixture?\0',raw(0x2580));
  const at=b.indexOf(Buffer.from([0x68,1,0,0,0,0x68,0x40,0x25,0x40,0]));assert(at>0);b.writeUInt32LE(4,at+1);
  fs.writeFileSync(out,b,{flag:'wx'});
}

function spawnSupervisor(run,env){
  const p=cp.spawn(process.execPath,[__filename,'--supervise',run],{cwd:ROOT,env,stdio:['inherit','pipe','pipe']});
  const r={p,out:[],err:[],exit:null};
  p.stdout.on('data',b=>r.out.push(b));p.stderr.on('data',b=>r.err.push(b));
  r.closed=new Promise(res=>p.once('close',(code,signal)=>{r.exit=code??-NP_SIG(signal);res(r.exit);}));
  return r;
}
const NP_SIG=s=>require('node:os').constants.signals[s];
async function communicate(r,ms){
  let t;const timer=new Promise((_,rej)=>{t=setTimeout(()=>rej(Object.assign(Error('timed out'),{code:'ETIMEDOUT'})),ms);});
  try{await Promise.race([r.closed,timer]);}finally{clearTimeout(t);}
  return [Buffer.concat(r.out),Buffer.concat(r.err)];
}

async function main(run,source_pid,mode='normal'){
  fs.mkdirSync(run,{recursive:true});
  if(fs.readdirSync(run).length)throw Object.assign(Error('File exists: '+run),{code:'EEXIST'});
  const tool=module_('tools/caesar3-reviewed-modal.js');
  let env={...process.env};
  if(source_pid){
    // Linux-only path, unreachable from the CLI (source_pid is always null):
    // native-proc.cjs has no environ primitive.
    const inherited=fs.readFileSync('/proc/'+source_pid+'/environ').toString().split('\0');
    env=Object.fromEntries(inherited.filter(r=>r.includes('=')).map(r=>[r.slice(0,r.indexOf('=')),r.slice(r.indexOf('=')+1)]));
  }
  Object.assign(env,{CAESAR3_RUN:run,WINE_COM_PROTOCOL_DIR:path.join(run,'children'),
    WINE_PROCESS_DESKTOP_OBSERVE:path.join(run,'desktop-observations')});
  const original=process.env.CAESAR3_TEST_INPUTS||path.join(process.env.CAESAR3_RUN,'runtime-inputs.json');
  fs.writeFileSync(path.join(run,'runtime-inputs.json'),fs.readFileSync(original));
  modalFixture(path.join(run,'modal.exe'));
  const port=await freePort();
  const start=NP.now();
  fs.writeFileSync(path.join(run,'launch.json'),JSON.stringify({at:start,deadline:start+120,gameplayCutoff:start+90,
    reserveSeconds:30,rootPort:port,authoredFixture:true}));
  // Child is waited by this test; runtime independently prearms its watchdog.
  const p=spawnSupervisor(run,env);
  const m=tool.load(run,true);
  try{
    const end=NP.now()+20;let s;
    while(true){
      try{
        s=await m.call({action:'snapshot'});
        if(s.nativeMessageBox&&s.windows.length===5)break;
      }catch(e){if(!(isAssert(e)||e?.oserror||typeof e?.code==='string'))throw e;} // (OSError,FileNotFoundError,AssertionError)
      assert(NP.now()<end);await NP.sleep(20);
    }
    await m.capture('before');s=m.read('before.json').snapshot;
    const b=s.windows.find(w=>w.controlClass===1&&w.controlId===6);
    const x=b.screenX+Math.floor(b.w/2),y=b.screenY+Math.floor(b.h/2);
    const baseline=tool.preflight(s,b.hwnd,x,y,'Yes');
    const negatives=[];
    function reject(name,mutate){
      const changed=clone(s);mutate(changed);
      try{tool.preflight(changed,b.hwnd,x,y,'Yes');}
      catch(e){if(!isRefusal(e))throw e;negatives.push(name);return;}
      throw new assert.AssertionError({message:'accepted '+name});
    }
    const btn=t=>t.windows.find(w=>w.hwnd===b.hwnd);
    for(const [name,mutate] of [
      ['actor',t=>Object.assign(t.focusWindow,{threadId:99})],
      ['modal-generation',t=>Object.assign(t.nativeMessageBox,{generation:'wrong'})],
      ['focus',t=>Object.assign(t,{focusTopLevel:t.mainHwnd})],
      ['capture',t=>Object.assign(t,{capture:'0x10001'})],
      ['physical-down',t=>Object.assign(t,{physicalUp:false})],
      ['native-modal',t=>Object.assign(t,{nativeMessageBox:null})],
      ['caption',t=>Object.assign(btn(t),{title:'No'})],
      ['parent',t=>Object.assign(btn(t),{parent:t.mainHwnd})],
      ['disabled',t=>Object.assign(btn(t),{style:0x08000000})]])reject(name,mutate);
    await tool.command(m,['review','before','Authored automated native fixture only','Yes','install',b.hwnd,String(x),String(y)]);
    await m.bind('before');
    if(mode!=='normal'){
      const [rr,r]=m.reviewed('before');
      const owner=m.read('input-owner.json');const guard={...owner,nonce:crypto.randomUUID(),reviewed:true,
        intent:{review:m.native_review(rr,r)},deadline:Math.trunc(NP.now()*1000)+500};
      if(mode==='foreign-owner')guard.owner='foreign-owner';
      else if(mode==='wrong-actor')guard.identity='foreign-actor-identity';
      else if(mode==='late')guard.deadline=Math.trunc(NP.now()*1000)-1;
      else if(mode==='stale'){
        await NP.sleep(Math.max(0,rr.at+30.05-NP.now())*1000);
        guard.deadline=Math.trunc(NP.now()*1000)+500;
      }else throw new assert.AssertionError({message:'unknown authored fault mode'});
      let accepted=false;
      try{await m.call({action:'guarded-input',cmd:`mousedown:${x}:${y}`,guard});accepted=true;}
      catch(error){if(!isAssert(error))throw error;m.fail(mode,error);}
      if(accepted)throw new assert.AssertionError({message:'invalid authored native input accepted'});
      if(fs.existsSync(path.join(run,'rejected-native-button.json'))){
        const rejected=m.read('rejected-native-button.json');
        assert(!rejected.consumed&&!rejected.handlerApplied);
      }
      const ledger=fs.readFileSync(path.join(run,'requests.jsonl'));
      for(const cleanup of [false,true]){
        try{await m.call({action:'snapshot'},1,cleanup);}
        catch(e){if(!isAssert(e))throw e;assert(String(e.message).includes('permanent UNKNOWN'));continue;}
        throw new assert.AssertionError({message:'post UNKNOWN request'});
      }
      assert(fs.readFileSync(path.join(run,'requests.jsonl')).equals(ledger));
      fs.writeFileSync(path.join(run,'assertions.json'),JSON.stringify({passed:true,authoredOnly:true,
        nativeFault:mode,consumed:false,laterHTTP:0,rebindReplayRetry:false}));
      return;
    }
    await tool.command(m,['capture','fresh']);
    await tool.command(m,['review','fresh','Authored fresh complete native modal, finite physical Yes press','Yes','quit',b.hwnd,String(x),String(y)]);
    await tool.command(m,['intent','quit','fresh',String(x),String(y),'quit']);
    assert.equal(m.read('quit-observation.json').outcome,'process-exited');
    const down=m.read('quit-down.json').receipt,intent=m.read('quit-intent.json');
    const guard={...intent.owner,nonce:intent.nonce,deadline:down.deadline,
      intent:{review:m.native_review(m.read('fresh.json'),m.read('fresh-review.json'))}};
    tool.validate_receipt(down,guard,baseline);
    for(const [field,value] of [['processId',99],['threadId',99],['generation','99'],['parent',1]]){
      const changed=clone(down);changed.nativeMessage[field]=value;
      try{tool.validate_receipt(changed,guard,baseline);}
      catch(e){if(!isAssert(e))throw e;negatives.push('receipt-'+field);continue;}
      throw new assert.AssertionError({message:'foreign native receipt accepted'});
    }
    for(const [field,value] of [['nonce','foreign'],['state','UNKNOWN'],['consumedAt',guard.deadline],['receiptBoundary','host-handler']]){
      const changed=clone(down);changed[field]=value;
      try{tool.validate_receipt(changed,guard,baseline);}
      catch(e){if(!isAssert(e))throw e;negatives.push('receipt-'+field);continue;}
      throw new assert.AssertionError({message:'stale/late/UNKNOWN receipt accepted'});
    }
    // A closed route forbids identity inspection and HTTP, including cleanup.
    const ledger=fs.readFileSync(path.join(run,'requests.jsonl'));m.fail('authored-terminal',new assert.AssertionError({message:'authored closure check'}));
    for(const cleanup of [false,true]){
      try{await m.call({action:'snapshot'},1,cleanup);}
      catch(e){if(!isAssert(e))throw e;assert(String(e.message).includes('permanent UNKNOWN'));continue;}
      throw new assert.AssertionError({message:'post UNKNOWN request'});
    }
    assert(fs.readFileSync(path.join(run,'requests.jsonl')).equals(ledger));
    negatives.push('UNKNOWN-zero-later-HTTP');
    fs.writeFileSync(path.join(run,'assertions.json'),JSON.stringify({passed:true,authoredOnly:true,
      directPhysicalButton:true,freshCompleteScene:true,nativeQuit:true,negatives,
      target:baseline},null,2));
  }finally{
    if(p.exit===null&&!fs.existsSync(path.join(run,'native-wait.json')))
      fs.writeFileSync(path.join(run,'stop-native.json'),'{}');
    const [a,b]=await communicate(p,15000);
    fs.writeFileSync(path.join(run,'supervisor.stdout.log'),a);fs.writeFileSync(path.join(run,'supervisor.stderr.log'),b);
    fs.writeFileSync(path.join(run,'supervisor-wait.json'),JSON.stringify({exit:p.exit,actualWait:true,stdoutEOF:true,stderrEOF:true}));
    assert.equal(p.exit,0,b.toString());
    let w=m.read('native-wait.json');assert(w.actualWait&&w.stdoutEOF&&w.stderrEOF);
    w=m.read('watchdog-wait.json');assert(w.actualWait&&w.stdoutEOF&&w.stderrEOF&&w.exit===0);
  }
  console.log('PASS owned native MessageBox target checks, physical BUTTON, fresh review, finite Yes and native Quit');
}

async function serve_cli(run){
  // Authored File/Exit fixture; every review/input is a real external CLI.
  fs.mkdirSync(run,{recursive:true});
  if(fs.readdirSync(run).length)throw Object.assign(Error('File exists: '+run),{code:'EEXIST'});
  fs.writeFileSync(path.join(run,'runtime-inputs.json'),fs.readFileSync(process.env.CAESAR3_TEST_INPUTS));
  const code=fs.readFileSync(process.env.CAESAR3_CLI_GENERATOR,'utf8');
  cp.execFileSync(process.execPath,['-e',code,path.join(run,'modal.exe')],{cwd:ROOT,stdio:'inherit'});
  const port=await freePort();
  const start=NP.now();
  fs.writeFileSync(path.join(run,'launch.json'),JSON.stringify({at:start,deadline:start+160,gameplayCutoff:start+130,
    reserveSeconds:30,rootPort:port,authoredFixture:true}));
  const p=spawnSupervisor(run,{...process.env,CAESAR3_RUN:run});
  const [a,b]=await communicate(p,2**31-1);
  fs.writeFileSync(path.join(run,'supervisor.stdout.log'),a);fs.writeFileSync(path.join(run,'supervisor.stderr.log'),b);
  fs.writeFileSync(path.join(run,'supervisor-wait.json'),JSON.stringify({exit:p.exit,actualWait:true,stdoutEOF:true,stderrEOF:true}));
  assert.equal(p.exit,0,b.toString());
}

module.exports={mapping_units,supervise,main,serve_cli};
if(require.main===module){
  const a=process.argv.slice(2);
  (async()=>{
    if(a[0]==='--mapping-units')mapping_units();
    else if(a[0]==='--supervise')await supervise(path.resolve(a[1]),{...process.env});
    else if(process.env.CAESAR3_MODAL_CLI==='1')await serve_cli(path.resolve(a[0]));
    else{
      const root=path.resolve(a[0]);fs.mkdirSync(root,{recursive:true});
      if(fs.readdirSync(root).length)throw Object.assign(Error('File exists: '+root),{code:'EEXIST'});
      for(const mode of ['wrong-actor','foreign-owner','late','stale','normal'])
        await main(path.join(root,mode),null,mode);
      fs.writeFileSync(path.join(root,'assertions.json'),JSON.stringify({passed:true,authoredOnly:true,
        sameCoreAllCases:true,modes:['wrong-actor','foreign-owner','late','stale','normal']}));
    }
  })().catch(e=>{console.error(e&&e.stack||e);process.exitCode=1;});
}
