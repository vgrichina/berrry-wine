'use strict';
// Whole retained controller, real numbered transport, real send/pending map,
// composed bound module. Only external browser/page/guest are inert seams.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const assert=require('node:assert/strict'),z=require('node:zlib'),{once}=require('node:events');
const root=path.resolve(__dirname,'..'),composition=require('./q3-native-driver-composition.cjs');
const base=path.dirname(path.join(root,composition.consumerPath));
const run=path.resolve(process.env.Q3_DELIVERY_TEST_RUN||'scratch/runs/20261109-q3-bounded-delivery-repair-0950/controller');
const read=file=>JSON.parse(fs.readFileSync(file));
const rows=file=>z.gunzipSync(fs.readFileSync(file)).toString().trim().split('\n').filter(Boolean).map(JSON.parse);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=5000){const end=Date.now()+ms;while(Date.now()<end){if(fn())return;await wait(10);}throw Error('inert controller observation deadline');}
async function scenario(mode,old=false){
  const name=(old?'old-':'new-')+mode,dir=path.join(run,name);fs.mkdirSync(dir,{recursive:true});
  const tag='offline-q3-delivery-'+process.pid+'-'+name,out=path.join(base,tag);
  const args=[process.execPath,'--require',path.join(__dirname,'q3-native-driver-composition.test.cjs'),
    '--require',path.join(__dirname,'q3-native-driver-composition.cjs'),'--require',path.join(__dirname,'q3-execution-boundary.cjs'),path.join(root,composition.consumerPath)];
  // Independent parent owns the process group and actually waits the driver;
  // the outer watchdog below remains separate from controller deadlines.
  const supervisor=`import subprocess,sys,json,os,signal,gzip
p=subprocess.Popen(json.loads(sys.argv[1]),start_new_session=True)
open(sys.argv[2]+'.pid','w').write(str(p.pid))
try:s=p.wait(timeout=12)
except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);s=p.wait()
open(sys.argv[2],'wb').write(gzip.compress(json.dumps(dict(actualWait=s,pid=p.pid)).encode()))
sys.exit(s if s>=0 else 128-s)
`;
  fs.writeFileSync(dir+'/watchdog-armed.json.gz',z.gzipSync(JSON.stringify({at:Date.now(),supervisorMs:12000,independentOuterMs:14000})));
  const child=cp.spawn('python3',['-c',supervisor,JSON.stringify(args),dir+'/supervisor-wait.json.gz'],{
    cwd:root,env:{...process.env,Q3_NODE_FIXTURE:'preload',Q3_FIXTURE_DIR:dir,Q3_FIXTURE_DELAY:'5',
      Q3_INPUT_CASE:mode,Q3_INPUT_OLD:old?'1':'',Q3_INPUT_BASE:process.env.Q3_INPUT_BASE||'80a51dc1ca1730a501a25c8f267fa153084ac2af',
      Q3_NATIVE_COMPOSITION:old?'':'1',CASE_TAG:tag,BROWSER_DEADLINE:String(Date.now()+150000),Q3_EXECUTION_BOUNDARY_OUT:dir+'/execution.jsonl.gz'},stdio:['ignore','pipe','pipe']});
  const logs=require('./native-command-log.cjs').createLogs(dir);logs.attach('stdout',child.stdout);logs.attach('stderr',child.stderr);
  const done=once(child,'close');
  const watchdog=setTimeout(()=>{try{process.kill(-Number(fs.readFileSync(dir+'/supervisor-wait.json.gz.pid')),'SIGKILL');}catch{}},14000);
  let observation;
  try {
    await until(()=>fs.existsSync(out+'/ready.json')||child.exitCode!==null);
    assert.equal(child.exitCode,null,'actual composed controller ready');
    const review=read(out+'/startup-capture.json');review.review='Inert Node bytes only';
    fs.writeFileSync(out+'/startup-review.json',JSON.stringify(review));
    const transport=require(base+'/transport.cjs');
    const command=['independent-up','combo-normal'].includes(mode)?{action:'combo',keys:['a','Control'],holdMs:100}:{action:'key',key:'Enter',holdMs:100};
    const request=transport.request(out,'delivery',{...command,waitMs:0,label:'after-input',reviewRef:'startup'},1).then(value=>({value}),error=>({error:String(error)}));
    await until(()=>fs.existsSync(out+'/consumed-delivery'));
    await wait(350);
    if(mode==='normal'||mode==='combo-normal'){
      assert((await request).value.ok);
      const receipt=read(out+'/input-delivery-delivery.json');assert(receipt.ok);
      assert(receipt.events.every(e=>e.reply?.ok));assert(receipt.samples.length>0);
      assert(fs.existsSync(out+'/after-input.png'));assert(!fs.existsSync(out+'/first-transport-failure.json'));
      assert((await transport.request(out,'quit',{action:'quit'},1)).ok);
      const [code,signal]=await done;await logs.drainStreams();logs.close();assert.equal(code,0);assert.equal(signal,null);
      const browser=JSON.parse(z.gunzipSync(fs.readFileSync(dir+'/browser-actual-wait.json.gz')));
      assert.equal(browser.code,0);assert(browser.stdoutEOF&&browser.stderrEOF);
      fs.writeFileSync(dir+'/result.json.gz',z.gzipSync(JSON.stringify({passed:true,receipt,code,signal,browser,stdoutEOF:child.stdout.readableEnded,stderrEOF:child.stderr.readableEnded,scope:'inert success and ordinary quit; no native claim'})));
      return;
    }
    if(old){
      // The desired guarantee fails on the actual prior implementation:
      // it has neither terminal admission nor a per-command failed receipt.
      assert(!fs.existsSync(out+'/first-transport-failure.json'));
      assert(!fs.existsSync(out+'/input-delivery-delivery.json'));
      observation={expectedOldFailure:true,missingPromptTerminal:true,missingCommandReceipt:true};
      if(mode==='independent-up'){
        const inputs=rows(dir+'/protocol.jsonl.gz').filter(r=>r.method==='Input.dispatchKeyEvent');
        assert.deepEqual(inputs.map(r=>r.params.type+':'+r.params.key),['keyDown:a','keyDown:Control','keyUp:Control'],'old awaited first UP prevents second submission');
      }
      if(mode==='stalled-down'||mode==='independent-up')fs.writeFileSync(dir+'/caller-cancelled.json',JSON.stringify({reason:'end old negative control'}));
    }else{
      if(mode==='independent-up'){
        const inputs=rows(dir+'/protocol.jsonl.gz').filter(r=>r.method==='Input.dispatchKeyEvent');
        assert.deepEqual(inputs.map(r=>r.params.type+':'+r.params.key),['keyDown:a','keyDown:Control','keyUp:Control','keyUp:a']);
        // The second UP was submitted while the first UP was still pending.
        assert(inputs.at(-1).at-inputs.at(-2).at<100);
        fs.writeFileSync(dir+'/caller-cancelled.json',JSON.stringify({reason:'release pending; terminate inert fixture'}));
      }else{
        assert(fs.existsSync(out+'/first-transport-failure.json'),'failure closes admission at existing hold bound');
      }
      await until(()=>fs.existsSync(out+'/input-delivery-delivery.json'));
      await until(()=>fs.existsSync(out+'/first-transport-failure.json'));
      const receipt=read(out+'/input-delivery-delivery.json');
      assert.equal(receipt.applicationTiming,'UNKNOWN');assert.equal(receipt.actualHeldInterval,'UNKNOWN');assert.equal(receipt.guestPolls,'UNKNOWN');
      assert(receipt.events.some(e=>e.type==='keyUp'),'release submission retained');
      assert(receipt.releaseAt-receipt.started<250,'same 100ms release origin');
      const first=fs.readFileSync(out+'/first-transport-failure.json','utf8');
      await assert.rejects(transport.request(out,'later-input',{action:'key',key:'Enter',holdMs:100,waitMs:0,label:'later',reviewRef:'startup'},1));
      await assert.rejects(transport.request(out,'later-capture',{action:'capture',waitMs:0,label:'later'},1));
      assert.equal(fs.readFileSync(out+'/first-transport-failure.json','utf8'),first,'first failure sticky');
      assert(!fs.existsSync(out+'/after-input.png'));assert(!fs.existsSync(out+'/reply-0.json'));
      observation={passed:true,receipt,first:JSON.parse(first)};
    }
    const [code,signal]=await done;await logs.drainStreams();logs.close();
    assert.equal(code,1);assert.equal(signal,null);
    const result=await request;assert(result.error,'failed hold has no positive ACK');
    const browser=JSON.parse(z.gunzipSync(fs.readFileSync(dir+'/browser-actual-wait.json.gz')));
    assert.equal(browser.code,0);assert(browser.stdoutEOF&&browser.stderrEOF);
    const writer=JSON.parse(z.gunzipSync(fs.readFileSync(dir+'/writer-actual-wait.json.gz')));assert.equal(writer.code,0);
    const protocol=rows(dir+'/protocol.jsonl.gz');
    const terminalFile=fs.existsSync(out+'/first-transport-failure.json')?out+'/first-transport-failure.json':out+'/first-browser-failure.json';
    const terminal=Date.parse(read(terminalFile).at);
    assert(!protocol.some(r=>r.at>terminal&&(r.method.startsWith('Input.')||r.method==='Page.captureScreenshot')),'no postterminal input/capture');
    if(!old&&mode==='sample-error')assert.match(read(out+'/first-transport-failure.json').error,/FIRST inert sample failure/);
    if(old&&['delayed-reply','delayed-application'].includes(mode))assert.match(read(out+'/first-browser-failure.json').error,/input delivery exceeded hold bound/,'reply delay and service delay reach the same old assertion');
    const application=fs.existsSync(dir+'/application.jsonl.gz')?rows(dir+'/application.jsonl.gz'):[];
    if(mode==='delayed-reply')assert(application.some(e=>e.type==='keyDown'),'inert fixture applied DOWN before delayed reply');
    if(mode==='delayed-application'&&!old)assert.equal(application.length,0,'terminal before inert fixture application; no native inference');
    if(!old&&(mode==='delayed-reply'||mode==='delayed-application'||mode==='stalled-down')){
      assert.equal(observation.receipt.samples.length,0);
      assert(observation.receipt.events.find(e=>e.type==='keyDown').reply?.ok!==true);
    }
    fs.writeFileSync(dir+'/result.json.gz',z.gzipSync(JSON.stringify({...observation,code,signal,request:result,browser,writer,stdoutEOF:child.stdout.readableEnded,stderrEOF:child.stderr.readableEnded,scope:'Node inert controller only; no native claim'})));
  }finally{
    clearTimeout(watchdog);
    if(child.exitCode===null&&child.signalCode===null){try{process.kill(-Number(fs.readFileSync(dir+'/supervisor-wait.json.gz.pid')),'SIGKILL');}catch{}}
    await done;
    if(fs.existsSync(out)){
      for(const name of fs.readdirSync(out)){const file=out+'/'+name;if(fs.statSync(file).isFile()){const bytes=fs.readFileSync(file);fs.writeFileSync(dir+'/consumer-'+name+(name.endsWith('.gz')?'':'.gz'),name.endsWith('.gz')?bytes:z.gzipSync(bytes));}}
      fs.rmSync(out,{recursive:true,force:true});
    }
  }
}
(async()=>{
  fs.mkdirSync(run,{recursive:true});
  for(const mode of ['delayed-reply','delayed-application','stalled-down','independent-up'])await scenario(mode,true);
  for(const mode of ['delayed-reply','delayed-application','stalled-down','independent-up','sample-error','normal','combo-normal'])await scenario(mode);
  console.log('PASS actual composed full controller: 4 old guarantee FAIL controls, 7 repaired PASS; independent UP, sticky first failure, no postterminal input/capture, success/quit, actual child waits and EOF; inert only');
})().catch(error=>{console.error(error);process.exitCode=1;});
