'use strict';
// Real caller/listener regression: local refusal alone permits a new review.
// Authored fixture only; never selects an original installer's controls.
// Ported from test-halflife2-local-prebind-expiry.py. Error anchors for the
// incomplete/changedowner cases now name the JS controller's explicit
// assertion messages instead of Python assert source text.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
const np=require(path.join(ROOT,'tools/native-proc.cjs'));
// Fresh module instance per load, as importlib loaded a new module each time.
function load(name){const p=path.join(ROOT,'tools',name);delete require.cache[require.resolve(p)];const m=require(p);delete require.cache[require.resolve(p)];return m;}

async function main(out,pin,kase){
  out=path.resolve(out);fs.mkdirSync(path.dirname(out),{recursive:true});fs.mkdirSync(out);
  const run=path.join(out,kase),read=n=>JSON.parse(fs.readFileSync(path.join(run,n),'utf8'));
  const write=(n,v)=>fs.writeFileSync(path.join(run,n),v);
  const fixture=path.join(ROOT,'scratch/runs/20261117-halflife2-age-page-native-input-latency/age-dialog.exe');
  const env={...process.env,HL2_TASK_RUN:path.dirname(out),HL2_RUN:run,HL2_RESTORED_PIN:pin,
    HL2_WORKING_AUTHORED:'1',HL2_INPUT_LATENCY_TRACE:'1',HL2_LIFECYCLE_TRACE:'1',
    WINE_PUBLIC_INPUT_TRACE:path.join(run,'public-input.jsonl'),HL2_EDIT_LAYOUT_REPAIR:'1',
    HL2_RETAINED_LAYOUT_REPAIR:path.join(ROOT,'scratch/runs/20261117-halflife2-agreement-capture-delay-cause/fixture'),
    HL2_AUTHORED_FIXTURE:fixture,HL2_AUTHORED_FIXTURE_SHA256:crypto.createHash('sha256').update(fs.readFileSync(fixture)).digest('hex')};
  const p=cp.spawn(process.execPath,[path.join(ROOT,'tools/halflife2-restored-native.js'),'--supervised'],{env,stdio:['ignore','pipe','pipe']});
  let a='',b='';p.stdout.on('data',d=>a+=d);p.stderr.on('data',d=>b+=d);
  const closed=new Promise(r=>p.on('close',r));
  const live=()=>p.exitCode===null&&p.signalCode===null;
  const m=load('halflife2-restored-native.js'),results=[];
  async function ctl(args,expected=0,command=null){
    const rc=await m.supervise_controller(run,args,command);assert.equal(rc,expected,JSON.stringify(args));
    results.push({args,rc});return rc;
  }
  async function review(scene,label,kind='install'){
    const snap=read(scene+'.json').snapshot;
    const w=snap.windows.find(v=>v.live&&v.visible&&v.title===label);
    const xy=[String(w.screenX+10),String(w.screenY+10)];
    await ctl(['review',scene,'Authored complete-image protocol test; no personal original review claim',label,kind,w.hwnd,...xy]);
    return xy;
  }
  async function step(scene,label,name,kind='install'){
    await ctl(['capture',scene]);const xy=await review(scene,label,kind);
    await ctl(['intent',name,scene,...xy,kind]);
  }
  try{
    const end=np.monotonic()+60;
    while(!fs.existsSync(path.join(run,'native-pid.json'))){assert(live()&&np.monotonic()<end);await np.sleep(20);}
    Object.assign(process.env,{DELPHI5_RUN:run,DELPHI5_PORT:String(read('launch.json').rootPort)});
    // Fully published launch receipt, then an actual exclusive listener check.
    const h=load('vb5cce-reviewed-control.js');let identity;
    for(;;){
      try{identity=h.identity();break;}
      catch(e){if(e.name!=='AssertionError'&&e.code!=='ENOENT')throw e;assert(live()&&np.monotonic()<end);await np.sleep(20);}
    }
    write('exclusive-listener-ready.json',JSON.stringify({identity,at:np.now(),beforeFirstController:true}));
    await ctl(['startup']);await ctl(['capture','initial']);let xy=await review('initial','Next >');
    // Actual wall time; never alter captured timestamps or freshness limits.
    const delay=Math.max(0,read('initial.json').at+30.1-np.now());
    write('review-delay.json',JSON.stringify({startedAt:np.now(),seconds:delay}));
    await np.sleep(delay*1000);
    if(kase==='changedowner'){
      const v=read('initial.json');v.target={...v.target,startToken:'wrong'};write('initial.json',JSON.stringify(v));
    }else if(kase==='ambiguous'){
      const rows=fs.readFileSync(path.join(run,'prebind-transport.jsonl'),'utf8').split('\n').filter(Boolean).map(v=>JSON.parse(v));
      rows.at(-1).token='unrelated-completion';
      write('prebind-transport.jsonl',rows.map(v=>JSON.stringify(v)+'\n').join(''));
    }else if(kase==='inflight'){
      fs.appendFileSync(path.join(run,'prebind-transport.jsonl'),JSON.stringify({token:'unsettled',phase:'started',action:'native-reviewed-capture'})+'\n');
    }else if(kase==='incomplete'){
      const v=read('initial-review.json');v.rawCompleteScene=false;write('initial-review.json',JSON.stringify(v));
    }else if(kase==='sideeffect')write('prior-release-arm.json','{}');
    if(['positive','positive-quit','transport','realUNKNOWN'].includes(kase)){
      await ctl(['bind','initial'],75);
      assert(!fs.existsSync(path.join(run,'PERMANENT-UNKNOWN.json'))&&!fs.existsSync(path.join(run,'bind-intent.json')));
      const requests=fs.readFileSync(path.join(run,'requests.jsonl'),'utf8');
      assert(!requests.split('\n').filter(Boolean).some(v=>JSON.parse(v).action.startsWith('guarded-')));
      if(kase==='transport'){
        // Lose the actual native capture response at the caller boundary. The
        // listener remains real/live, and the transport journal stays unfinished.
        const rc=await m.supervise_controller(run,['capture','new'],[process.execPath,__filename,'--lost-response','capture','new']);assert.notEqual(rc,0);
        assert(fs.existsSync(path.join(run,'new.png'))&&!fs.existsSync(path.join(run,'new.json')));
        assert(read('PERMANENT-UNKNOWN.json').error.includes('authored lost actual capture response'));
      }else if(kase==='positive-quit'){
        await ctl(['capture','new']);await review('new','Cancel','quit');await ctl(['bind','new']);
        // Also prove that ordinary post-bind captures no longer enter recovery.
        await ctl(['capture','bound']);xy=await review('bound','Cancel','quit');
        await ctl(['intent','reviewed-cancel','bound',...xy,'quit']);
        assert.equal(read('reviewed-cancel-observation.json').outcome,'process-exited');
      }else if(kase==='realUNKNOWN'){
        await ctl(['capture','new']);xy=await review('new','Next >');await ctl(['bind','new']);
        process.env.HL2_TEST_TRANSPORT_PAUSE='.55';let rc;
        try{rc=await m.supervise_controller(run,['intent','late','new',...xy,'install'],
          [process.execPath,path.join(ROOT,'test/test-halflife2-age-input-latency.cjs'),'--profile','intent','late','new',...xy,'install']);}
        finally{delete process.env.HL2_TEST_TRANSPORT_PAUSE;}
        assert.notEqual(rc,0);
        assert.equal(read('late-down.json').receipt.reason,'immutable deadline expired');
      }else{
        await ctl(['capture','new']);xy=await review('new','Next >');await ctl(['bind','new']);
        await ctl(['intent','agreement-next','new',...xy,'install']);
        await step('age','Next >','age-next');
        await step('destination','Cancel','destination-cancel','quit');
        assert.equal(read('destination-cancel-observation.json').outcome,'process-exited');
        assert.notEqual(read('new.json').captureId,read('initial.json').captureId);
      }
    }else{
      const rc=await m.supervise_controller(run,['bind','initial']);assert(rc!==0&&rc!==75,String(rc));
      const dir=path.join(run,'controller-supervision');
      const errors=fs.readdirSync(dir).filter(n=>n.startsWith('bind-')).sort().map(n=>path.join(dir,n,'stderr.log')).filter(f=>fs.existsSync(f)).map(f=>fs.readFileSync(f,'utf8')).join('');
      const anchor={ambiguous:'inflight/ambiguous transport',inflight:'incomplete transport proof',
        incomplete:'review is not a raw complete scene',changedowner:'capture target is not the current native identity',sideeffect:'prior binding, armed release or side effect'}[kase];
      assert(errors.includes(anchor),errors);
    }
    if(!['positive','positive-quit'].includes(kase)){
      assert(fs.existsSync(path.join(run,'PERMANENT-UNKNOWN.json')));
      const before=fs.readFileSync(path.join(run,'requests.jsonl'));
      await assert.rejects(m.supervise_controller(run,['capture','forbidden']),e=>e.name==='AssertionError','UNKNOWN allowed recovery capture');
      assert(before.equals(fs.readFileSync(path.join(run,'requests.jsonl'))));
    }
    fs.writeFileSync(path.join(out,'proof.json'),JSON.stringify({passed:true,case:kase,realCallerAndListener:true,realDelayedReview:true,operations:results},null,2));
  }finally{
    if(live()&&!fs.existsSync(path.join(run,'native-wait.json'))){fs.mkdirSync(run,{recursive:true});write('stop-native.json','{}');}
    const timer=setTimeout(()=>p.kill('SIGKILL'),30000);await closed;clearTimeout(timer);
    fs.writeFileSync(path.join(out,'owner-wait.json'),JSON.stringify({pid:p.pid,returncode:p.exitCode,actualWait:true,stdoutEOF:true,stderrEOF:true,stdout:a,stderr:b},null,2));
  }
  console.log('PASS',kase);
}

async function lost_response(args){
  const run=process.env.DELPHI5_RUN;assert(fs.statSync(path.join(run,'authored-input.json')).isFile());
  const h=load('halflife2-reviewed-next.js'),adapt=h.receipt_clock_body;
  h.receipt_clock_body=body=>Buffer.concat([adapt(body),Buffer.from(`
;(()=>{
  const M=module.exports,prebind_real_call=M.call;
  M.call=async(command,...rest)=>{
    const result=await prebind_real_call(command,...rest);
    if(command&&command.action==='native-reviewed-capture')throw new M.TransportError('authored lost actual capture response');
    return result;
  };
})();
`)]);
  return h.controller(args);
}

if(require.main===module){
  const finish=p=>p.then(rc=>{process.exitCode=rc??0;},e=>{if(e&&e.name==='SystemExit')process.exitCode=e.exitCode;else{console.error(e);process.exitCode=1;}});
  if(process.argv[2]==='--lost-response')finish(lost_response(process.argv.slice(3)));
  else finish(main(...process.argv.slice(2)));
}
