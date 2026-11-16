'use strict';
// Generated native USER fixture only. No original media or review claims.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const cp=require('node:child_process'),net=require('node:net');
const {startControlSession}=require('./control-session');
if(process.argv[2]==='--unit'){
  require('./test-disciples2-native-paint-binding.cjs').contextUnits();
  const code=`import importlib.util, pathlib, tempfile, time
s=importlib.util.spec_from_file_location('control','tools/vb5cce-reviewed-control.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
with tempfile.TemporaryDirectory() as d:
 m.R=pathlib.Path(d);m.save('PERMANENT-UNKNOWN.json',{})
 m.identity=lambda: (_ for _ in ()).throw(AssertionError('identity must not run'))
 for cleanup in (False,True):
  try:m.call({'action':'quit'},cleanup=cleanup)
  except AssertionError as e:assert 'permanent UNKNOWN' in str(e)
  else:raise AssertionError('postUNKNOWN request')
 assert not (m.R/'requests.jsonl').exists()
 # Exercise the real freshness predicate with aged evidence, not altered clocks.
 m.identity=lambda:{'pid':1};(m.R/'scene.png').write_bytes(b'fixture')
 digest=m.hashlib.sha256(b'fixture').hexdigest()
 for kind,age,allowed in [('game',4,True),('game',6,False),('install',6,True),('install',31,False)]:
  rows={'scene.json':dict(at=time.time()-age,target={'pid':1},port=m.PORT,pngSHA256=digest),
        'scene-review.json':dict(at=time.time()-age,kind=kind,pngSHA256=digest,rawCompleteScene=True,observation='fixture',visibleLabel='OK')}
  m.read=lambda n:rows[n]
  try:m.reviewed('scene');passed=True
  except AssertionError:passed=False
  assert passed==allowed,(kind,age)
print('PASS permanent UNKNOWN forbids normal and cleanup requests before identity/network')`;
  const p=cp.spawnSync('python3',['-B','-c',code],{cwd:path.resolve(__dirname,'..'),encoding:'utf8'});
  process.stdout.write(p.stdout);process.stderr.write(p.stderr);assert.equal(p.status,0);process.exit(0);
}
const out=path.resolve(process.argv[2]),root=path.resolve(__dirname,'..');
fs.mkdirSync(out,{recursive:true});
const image=path.join(out,'generated-context.exe');
const fixture=require('./test-cli-native-scene-context.cjs').fixture(),raw=r=>r-0x1000+0x200;
// The old fixture reused both strings: two generations could produce identical
// pictures. Distinguish real guest-created scenes without altering runtime paint.
const calls=Buffer.from([0x68,0x10,0,0,0,0x68,0x40,0x25,0x40,0,0x68,0x80,0x25,0x40,0]);
const first=fixture.indexOf(calls),second=fixture.indexOf(calls,first+1);assert(first>=0&&second>first);
fixture.write('Native controller: first\0',raw(0x2540));
fixture.writeUInt32LE(0x402700,second+6);fixture.writeUInt32LE(0x402780,second+11);
fixture.write('Native controller: second\0',raw(0x2700));
fixture.write('Second native modal. OK exits the generated fixture.\0',raw(0x2780));
fs.writeFileSync(image,fixture,{flag:'wx'});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const save=(n,v)=>fs.writeFileSync(path.join(out,n),JSON.stringify(v,null,2)+'\n',{flag:'wx'});
async function main(){
 const modes=process.env.DELPHI5_NATIVE_MODES?.split(',')||['positive','repaint-positive','focus-fault','owner-fault','semantic-fault','stale-fault','child-caption-fault'];
 for(const [index,mode] of modes.entries()){
  const run=path.join(out,mode);fs.mkdirSync(run);
  fs.copyFileSync(path.join(out,'../runtime-inputs.json'),path.join(run,'runtime-inputs.json'));
  // Ask the OS for a fresh local port rather than sharing a fixed fixture
  // range with other workers. The PID/socket identity check still refuses
  // any intervening bind; it never contacts or retries a foreign listener.
  const reservation=net.createServer();
  await new Promise((resolve,reject)=>{reservation.once('error',reject);reservation.listen(0,'127.0.0.1',resolve);});
  const port=reservation.address().port;
  await new Promise((resolve,reject)=>reservation.close(error=>error?reject(error):resolve()));
  const start=Date.now()/1000;
  // Fixture budget is 240s so the identical 180s reserve remains applicable.
  fs.writeFileSync(path.join(run,'launch.json'),JSON.stringify({deadline:start+240,gameplayCutoff:start+60,reserveSeconds:180,rootPort:port}));
  const watchdog=cp.spawn(process.execPath,['-e',`let pid;const timer=setTimeout(()=>{if(pid)try{process.kill(-pid,'SIGTERM')}catch{};process.exit(2)},65000);console.log('ARMED');process.stdin.on('data',b=>pid=Number(b));process.stdin.on('end',()=>clearTimeout(timer));`],{stdio:['pipe','pipe','pipe']});
  let ws='',we='';watchdog.stdout.on('data',b=>ws+=b);watchdog.stderr.on('data',b=>we+=b);
  const wclosed=new Promise(resolve=>watchdog.on('close',(exit,signal)=>resolve({exit,signal})));
  while(!ws.includes('ARMED'))await pause(5);
  fs.writeFileSync(path.join(run,'watchdog-armed.json'),JSON.stringify({pid:watchdog.pid,at:Date.now(),prearmed:true,deadlineMs:65000,stdout:ws}));
  const s=startControlSession(['test/run.js','--exe='+image,'--winver=nt4','--no-build','--spawn-processes','--threads','--real-ticks','--screen=800x600','--control-stdin','--control='+port,'--max-seconds=60','--max-batches=100000000','--stuck-after=0','--quiet-api','--quiet-blocks','--no-close'],{cwd:root,spawnOptions:{detached:true}});
  const send=s.send;let requests=0;
  s.send=command=>{
    assert(!fs.existsSync(path.join(run,'PERMANENT-UNKNOWN.json')),'permanent UNKNOWN; fixture sends no later requests');
    requests++;fs.appendFileSync(path.join(run,'fixture-requests.jsonl'),JSON.stringify({at:Date.now(),action:command.action})+'\n');return send(command);
  };
  s.child.once('close',(exit,signal)=>fs.writeFileSync(path.join(run,'native-wait.json'),JSON.stringify({pid:s.child.pid,exit,signal,actualWait:true,stdoutEOF:s.child.stdout.readableEnded,stderrEOF:s.child.stderr.readableEnded})));
  watchdog.stdin.write(String(s.child.pid));
  const stat=fs.readFileSync('/proc/'+s.child.pid+'/stat','utf8');
  fs.writeFileSync(path.join(run,'native-pid.json'),JSON.stringify({pid:s.child.pid,startToken:stat.slice(stat.lastIndexOf(')')+2).split(' ')[19]}));
  let controllerRuns=0;
  const controller=async(args,expected=0)=>{
    const startedAt=Date.now();
    const p=await new Promise(resolve=>{
      const child=cp.spawn('python3',['-B','tools/vb5cce-reviewed-control.py',...args],{cwd:root,env:{...process.env,DELPHI5_RUN:run,DELPHI5_PORT:String(port)},timeout:7000});
      let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
      child.on('close',(status,signal)=>resolve({pid:child.pid,status,signal,stdout,stderr,actualWait:true,
        stdoutEOF:child.stdout.readableEnded,stderrEOF:child.stderr.readableEnded,startedAt,waitedAt:Date.now()}));
    });
    const prefix=(++controllerRuns)+'-'+args.join('-').replace(/[^a-z0-9-]/gi,'_').slice(0,100);
    fs.writeFileSync(path.join(run,prefix+'.log'),p.stdout+p.stderr);
    fs.writeFileSync(path.join(run,prefix+'-wait.json'),JSON.stringify({...p,stdout:undefined,stderr:undefined,args}));
    assert(p.stdoutEOF&&p.stderrEOF,'controller pipes must drain before its result');
    if(expected===0)assert.equal(p.status,0,p.stdout+p.stderr);else assert.notEqual(p.status,0,'fault must fail');
    return p;
  };
  try{
    let scene;const due=Date.now()+15000;
    do{scene=await s.send({action:'snapshot'});if(scene.modalHwnd!=='0x0')break;assert(Date.now()<due);await pause(30);}while(true);
    if(!['positive','repaint-positive'].includes(mode)){
      await s.send({action:'frozen',mode:'on'});
      await controller(['capture','fault-scene']);
      const rr=JSON.parse(fs.readFileSync(path.join(run,'fault-scene.json')));scene=rr.snapshot;
      await controller(['review','fault-scene','Generated NT4 native fixture fault; complete raw image retained','OK','install',scene.focus]);
      if(mode==='stale-fault'){
        await pause(Math.max(0,(rr.at+30.05)*1000-Date.now()));
        await controller(['bind','fault-scene'],1);
      }else{
        await controller(['bind','fault-scene']);
        const owner=JSON.parse(fs.readFileSync(path.join(run,'input-owner.json'))),nonce='fresh-'+mode;
        const review=JSON.parse(fs.readFileSync(path.join(run,'fault-scene-review.json')));
        const q=await s.send({action:'guarded-input',cmd:'mousedown:215:139',guard:{...owner,nonce,reviewed:true,deadline:Date.now()+500,intent:{review:{contract:'native-reviewed-context-v1',captureId:rr.captureId,pngSHA256:rr.pngSHA256,reviewed:true,reviewedAt:review.at*1000,scope:'menu',targetHwnd:review.targetHwnd}}}});
        assert(!q.consumed);
        const code=mode==='child-caption-fault'?`(()=>{const h=instance.exports.get_focus_hwnd(),p=instance.exports.native_user_text_ptr(h);new Uint8Array(memory.buffer)[p]=88;return true})()`:mode==='focus-fault'?'instance.exports.set_focus(instance.exports.get_main_hwnd());true':mode==='owner-fault'?'renderer.handleMouseDown=renderer.handleMouseDown.bind(renderer);true':"(()=>{const h=instance.exports.modal_dialog_hwnd(),p=instance.exports.wnd_lookup_title(h);new Uint8Array(memory.buffer)[p]=88;renderer.setWindowText(h,'Changed semantic caption');return true})()";
        await s.send({action:'eval',code});
        await s.send({action:'step',n:1});
        const r=await s.send({action:'guarded-status',nonce});
        assert.equal(r.state,'CANCELLED');assert(!r.consumed);
        const after=await s.send({action:'snapshot'});assert(after.physicalUp);assert.equal(after.modalHwnd,scene.modalHwnd);
        if(mode==='child-caption-fault')assert.notEqual(after.windows.find(w=>w.hwnd===after.focus).title,scene.windows.find(w=>w.hwnd===scene.focus).title);
        if(mode==='semantic-fault')assert.notEqual(after.windows.find(w=>w.hwnd===after.modalHwnd).title,scene.windows.find(w=>w.hwnd===scene.modalHwnd).title);
        save(mode+'.json',{receipt:r,physicalUp:after.physicalUp,modalUnchanged:true,semanticChange:mode==='semantic-fault'});
        // Caller closes locally after the consume-time refusal, without any
        // second bind or further native request.
        fs.writeFileSync(path.join(run,'PERMANENT-UNKNOWN.json'),JSON.stringify({name:mode,at:Date.now()/1000,noLaterRequests:true,receipt:r}),{flag:'wx'});
      }
      assert(fs.existsSync(path.join(run,'PERMANENT-UNKNOWN.json')));
      const count=requests,ledger=fs.readFileSync(path.join(run,'requests.jsonl'),'utf8');
      for(const args of [['capture','after-unknown'],['bind','fault-scene'],['intent','retry','fault-scene','215','139','install']])await controller(args,1);
      assert.equal(requests,count);assert.equal(fs.readFileSync(path.join(run,'requests.jsonl'),'utf8'),ledger);
      save(mode+'-terminal.json',{permanentUNKNOWN:true,laterRequests:0,rebindReplayRetry:false,hostTeardownOnly:true});
    }else{
      let generation;
      for(let i=0;i<2;i++){
        const controls=await s.send({action:'eval',code:'(()=>{const e=instance.exports,h=e.modal_dialog_hwnd(),out=[];for(let s=0;(s=e.wnd_next_child_slot(h,s))!==-1;s++){const c=e.wnd_slot_hwnd(s);out.push({id:e.ctrl_get_id(c),x:e.wnd_window_screen_x(c),y:e.wnd_window_screen_y(c),w:e.wnd_screen_w(c),h:e.wnd_screen_h(c)})}return out})()'});
        const b=controls.find(x=>x.id===1);assert(b);
        const name='scene'+i;await controller(['capture',name]);
        const record=JSON.parse(fs.readFileSync(path.join(run,name+'.json')));
        const modal=record.snapshot.windows.find(w=>w.hwnd===record.snapshot.modalHwnd);
        assert.equal(modal.title,'Native controller: '+(i?'second':'first'));
        const png=require('pngjs').PNG.sync.read(fs.readFileSync(path.join(run,name+'.png')));
        assert.equal(png.width,800);assert.equal(png.height,600);
        const colors=new Set();for(let y=modal.y;y<modal.y+modal.h;y++)for(let x=modal.x;x<modal.x+modal.w;x++)colors.add(png.data.readUInt32LE((y*png.width+x)*4));
        assert(colors.size>8,'modal must have visible rendered content');
        if(i)assert.notEqual(record.pngSHA256,JSON.parse(fs.readFileSync(path.join(run,'scene0.json'))).pngSHA256,'distinct native dialog must have distinct paint');
        if(i)assert.notEqual(modal.generation,generation);generation=modal.generation;
        let description='Automated generated native USER protocol fixture; no personal original review claim';
        if(process.env.VB5_PERSONAL_FIXTURE_REVIEW==='1'){
          const personal=path.join(run,name+'-personal.json'),due=record.at*1000+29000;
          while(!fs.existsSync(personal)){assert(Date.now()<due,'personal complete fixture review expired');await pause(10);}
          const reviewed=JSON.parse(fs.readFileSync(personal));
          assert.equal(reviewed.pngSHA256,record.pngSHA256);assert(reviewed.at>=record.completedAt&&reviewed.at<=Date.now()/1000);
          description=reviewed.observation;assert(description.length>20);
        }
        await controller(['review',name,description,'OK',i?'quit':'install',record.snapshot.windows.find(w=>w.isChild&&w.controlClass===1&&w.controlId===1&&w.title==='OK').hwnd]);
        if(mode==='repaint-positive'){
          await s.send({action:'eval',code:`renderer.colors.desktop='${i?"#335522":"#552233"}';renderer.repaint();true`});
          const current=await s.send({action:'png',path:path.join(run,name+'-repaint.png')});
          const hash=require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(run,name+'-repaint.png'))).digest('hex');
          assert.notEqual(hash,record.pngSHA256,'same-target repaint must actually change full PNG');
          save(name+'-repaint-proof.json',{original:record.pngSHA256,current:hash,unchangedTarget:true});
        }
        if(!i)await controller(['bind',name]);
        await controller(['intent','press'+i,name,String(b.x+Math.floor(b.w/2)),String(b.y+Math.floor(b.h/2)),i?'quit':'install']);
      }
      const end=Date.now()+4000;while(s.child.exitCode===null){assert(Date.now()<end,'native ExitProcess not observed');await pause(20);}
      assert.equal(s.child.exitCode,0);save(mode+'-positive.json',{nativeExit:0,ordinaryNativeUser:true,twoGenerations:true});
    }
  }catch(error){
    const terminal=path.join(run,'PERMANENT-UNKNOWN.json');
    if(!fs.existsSync(terminal))fs.writeFileSync(terminal,JSON.stringify({name:'fixture',error:String(error),at:Date.now()/1000,noLaterRequests:true}),{flag:'wx'});
    throw error;
  }finally{
    // UNKNOWN forbids even the historical generic teardown request. Host
    // process-group termination is distinct from ordinary guest native Quit.
    if(s.child.exitCode===null)try{process.kill(-s.child.pid,'SIGTERM');}catch(error){if(error.code!=='ESRCH')throw error;}
    await s.exited;
    fs.writeFileSync(path.join(run,'native.log'),s.output());
    save(mode+'-native-wait.json',{pid:s.child.pid,exit:s.child.exitCode,signal:s.child.signalCode,actualWait:true,stdoutEOF:s.child.stdout.readableEnded,stderrEOF:s.child.stderr.readableEnded,nativeQuit:['positive','repaint-positive'].includes(mode)&&s.child.exitCode===0,hostTeardown:!['positive','repaint-positive'].includes(mode)});
    watchdog.stdin.end();const w=await wclosed;save(mode+'-watchdog-wait.json',{pid:watchdog.pid,...w,actualWait:true,stdoutEOF:watchdog.stdout.readableEnded,stderrEOF:watchdog.stderr.readableEnded,stdout:ws,stderr:we});
    assert.equal(w.exit,0,'independent watchdog must close normally');
  }
 }
 save('vb-original-admission.json',{generatedTestsPassed:true,safeForVBOriginal:true,actualNativeButtonTargets:true,childCaptionChangeRefused:true,originalStarted:false});
 console.log('PASS actual native two-dialog transition/independent UP/ExitProcess, focus/owner/semantic/stale faults, repaint admitted and permanent UNKNOWN zero later requests');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
