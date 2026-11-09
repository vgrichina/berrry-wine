'use strict';
// Full generated fixture and full retained controller; only external browser,
// graphics and guest execution are inert. Production physical handlers and
// composed PAGE_READ/progress/hold execute without mocked key answers.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict'),z=require('node:zlib'),cp=require('node:child_process');
const {once}=require('node:events'),{webcrypto}=require('node:crypto');
const root=path.resolve(__dirname,'..'),composition=require('./q3-native-driver-composition.cjs');
const base=path.dirname(path.join(root,composition.consumerPath));
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function createPage(result) {
  const listeners=new Map();let allocated=4096;
  const scope={console,ArrayBuffer,Uint8Array,Int32Array,DataView,Set,WeakMap,Map,Date,
    performance,crypto:webcrypto,crossOriginIsolated:true,URL,RegionMap:{BASE:{THUNK_BASE:512}},
    document:{createElement:()=>({getContext:()=>({drawImage(){}})}),body:{append(c){scope.canvas=c;}},getElementById:()=>scope.canvas},
    addEventListener(type,fn){listeners.set(type,fn);},
    WINE_REDLINE_STARTUP:{compile:async()=>({}),park:async()=>{},retired(){}},
    WebAssembly:{compile:async()=>({}),Memory:class{constructor(){this.buffer=new ArrayBuffer(1024*1024);}}},
    fetch:async url=>({arrayBuffer:async()=>new ArrayBuffer(128),json:async()=>url.includes('sigs')?{sigs:{}}:
      ['ChoosePixelFormat','SetPixelFormat','wglCreateContext','wglMakeCurrent'].map((name,id)=>({name,id}))}),
    createHostImports:()=>({host:{}}),GuestRpc:{createMainBroker:()=>({})},
    RenderWorker:{Manager:class{constructor(){this.ready=Promise.resolve();}async stop(){}}},
    GLRenderHost:{Bridge:class{}},
    GuestWorkerLink:class{constructor(opts){Object.assign(this,opts);this.worker={};this.endpointIdentity='fixture-endpoint';}
      async start(){}async stop(){this._stopping=true;}
      async callExport(name,...args){if(name==='guest_alloc'){allocated+=args[0];return allocated;}
        if(name==='guest_to_wasm')return args[0];if(name==='get_eip')return 0;return 1;}
    }};
  scope.window=scope;scope.self=scope;
  const page=vm.createContext(scope);
  vm.runInContext(fs.readFileSync(root+'/lib/renderer-input.js','utf8'),page);
  vm.runInContext(result.fixtureSource+'\nglobalThis.runFixture=fixture;',Object.assign(page,{
    require,module:{exports:{}},__dirname:base}));
  await scope.runFixture('webgl');
  return {scope,evaluate:expression=>vm.runInContext(expression,page),
    dispatch(params,mode){
      if(mode==='missing-key')return;
      const vk=mode==='wrong-key'?40:params.windowsVirtualKeyCode;
      if(mode==='release-stuck'&&params.type==='keyUp')return;
      listeners.get(params.type==='keyDown'?'keydown':'keyup')?.({isTrusted:mode!=='untrusted',keyCode:vk,
        code:params.code,preventDefault(){}});
    }};
}
module.exports={createPage};
async function until(fn){const end=Date.now()+7000;while(Date.now()<end){if(fn())return;await pause(10);}throw Error('controller fixture deadline');}
const read=p=>JSON.parse(fs.readFileSync(p));
async function scenario(run,mode,old=false){
  const dir=path.join(run,(old?'old-':'new-')+mode);fs.mkdirSync(dir,{recursive:true});
  const tag='offline-fixture-input-'+process.pid+'-'+(old?'old-':'')+mode,out=path.join(base,tag);
  const args=[process.execPath,'--require',__dirname+'/q3-native-driver-composition.test.cjs',
    '--require',__dirname+'/q3-native-driver-composition.cjs','--require',__dirname+'/q3-execution-boundary.cjs',root+'/'+composition.consumerPath];
  const supervisor="import subprocess,sys,json,os,signal,gzip\np=subprocess.Popen(json.loads(sys.argv[1]),start_new_session=True)\nopen(sys.argv[2]+'.pid','w').write(str(p.pid))\ntry:s=p.wait(timeout=12)\nexcept subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);s=p.wait()\nopen(sys.argv[2],'wb').write(gzip.compress(json.dumps(dict(actualWait=s)).encode()))\nsys.exit(s if s>=0 else 128-s)\n";
  fs.writeFileSync(dir+'/watchdog-armed.json.gz',z.gzipSync(JSON.stringify({supervisorMs:12000,outerMs:14000})));
  const child=cp.spawn('python3',['-c',supervisor,JSON.stringify(args),dir+'/wait.json.gz'],{cwd:root,
    env:{...process.env,Q3_NODE_FIXTURE:'preload',Q3_FIXTURE_DIR:dir,Q3_FIXTURE_DELAY:'5',
      Q3_PHYSICAL_CASE:mode,Q3_INPUT_OLD:old?'1':'',Q3_INPUT_BASE:process.env.Q3_FIXTURE_BASE,
      Q3_NATIVE_COMPOSITION:old?'':'1',LOCAL_PRODUCTION_FIXTURE:'1',Q3_NATIVE_JOINED_FIXTURE:'1',
      CASE_TAG:tag,BROWSER_DEADLINE:String(Date.now()+150000),Q3_EXECUTION_BOUNDARY_OUT:dir+'/execution.jsonl.gz'},stdio:['ignore','pipe','pipe']});
  const logs=require('./native-command-log.cjs').createLogs(dir);logs.attach('stdout',child.stdout);logs.attach('stderr',child.stderr);
  const done=once(child,'close');const watchdog=setTimeout(()=>{try{process.kill(-Number(fs.readFileSync(dir+'/wait.json.gz.pid')),'SIGKILL');}catch{}},14000);
  try{
    await until(()=>fs.existsSync(out+'/fixture-complete-awaiting-quit.json')||child.exitCode!==null);
    assert.equal(child.exitCode,null,'full fixture controller reached input loop');
    const transport=require(base+'/transport.cjs');
    const request=transport.request(out,'physical',{...(mode==='combo'?{action:'combo',keys:['a','Control']}:
      {action:'key',key:mode==='arrow'?'ArrowUp':'Enter'}),holdMs:100,waitMs:0,label:'after',reviewRef:'fixture-startup'},1).then(value=>({value}),error=>({error:String(error)}));
    await until(()=>fs.existsSync(out+'/input-physical-hold.json')||fs.existsSync(out+'/first-transport-failure.json'));
    const negative=['missing-key','wrong-key','release-stuck','source-race','untrusted'].includes(mode);
    let receipt;
    if(old){
      receipt=read(out+'/input-physical-hold.json');
      assert.throws(()=>require('./q3-fixture-input.cjs').checkSample(receipt.samples[0],['Enter'],true),/source missing/);
      assert(receipt.samples.every(s=>s.physical.every(r=>r.state===0)));
    }else if(negative){
      const first=fs.readFileSync(out+'/first-transport-failure.json','utf8');
      assert(!fs.existsSync(out+'/after.png'));assert(!fs.existsSync(out+'/reply-1.json'));
      await assert.rejects(transport.request(out,'later',{action:'capture',waitMs:0,label:'later'},1));
      assert.equal(fs.readFileSync(out+'/first-transport-failure.json','utf8'),first);
    }else{
      receipt=read(out+'/input-physical-hold.json');assert.equal(receipt.fixturePhysicalGate,'PASS');
      const expected=mode==='combo'?[65,17]:mode==='arrow'?[38]:[13];
      assert(receipt.samples.some(s=>s.whollyDuringHold&&expected.every(k=>s.physical.some(r=>r.key===k&&r.state===32768))));
      assert(expected.every(k=>receipt.releaseSample.physical.some(r=>r.key===k&&r.state===0)));
      assert.equal(receipt.releaseSample.physicalSource.renderer,receipt.samples[0].physicalSource.renderer);
      assert(receipt.releaseAt-receipt.started<250,'100ms timer retains pre-DOWN origin');
      assert.equal(receipt.guestPolls,'UNKNOWN');
    }
    if(!negative||old){await request;await transport.request(out,'quit',{action:'quit'},2);}
    else assert((await request).error);
    const [code,signal]=await done;await logs.drainStreams();logs.close();
    assert.equal(code,negative&&!old?1:0);assert.equal(signal,null);
    const browser=JSON.parse(z.gunzipSync(fs.readFileSync(dir+'/browser-actual-wait.json.gz')));
    assert.equal(browser.code,0);assert(browser.stdoutEOF&&browser.stderrEOF);
    assert.equal(JSON.parse(z.gunzipSync(fs.readFileSync(dir+'/writer-actual-wait.json.gz'))).code,0);
    if(negative&&!old){
      const terminal=Date.parse(read(out+'/first-transport-failure.json').at);
      const protocol=z.gunzipSync(fs.readFileSync(dir+'/protocol.jsonl.gz')).toString().trim().split('\n').filter(Boolean).map(JSON.parse);
      assert(!protocol.some(r=>r.at>terminal&&(r.method.startsWith('Input.')||r.method==='Page.captureScreenshot')),'no postterminal input/capture');
    }
    fs.writeFileSync(dir+'/result.json.gz',z.gzipSync(JSON.stringify({passed:true,expectedOldFailure:old,mode,receipt,code,stdoutEOF:child.stdout.readableEnded,stderrEOF:child.stderr.readableEnded,scope:'offline inert full composed controller and generated fixture; no guest poll or native claim'})));
  }finally{
    clearTimeout(watchdog);
    if(child.exitCode===null&&child.signalCode===null){try{process.kill(-Number(fs.readFileSync(dir+'/wait.json.gz.pid')),'SIGKILL');}catch{}}
    await done;
    if(fs.existsSync(out)){for(const name of fs.readdirSync(out)){const p=out+'/'+name;if(fs.statSync(p).isFile()){const b=fs.readFileSync(p);fs.writeFileSync(dir+'/consumer-'+name+(name.endsWith('.gz')?'':'.gz'),name.endsWith('.gz')?b:z.gzipSync(b));}}fs.rmSync(out,{recursive:true,force:true});}
    // Keep unique diagnostic bytes in a compressed file log, avoiding the
    // filesystem's per-file block cost. No source tree or game media enters it.
    const records=fs.readdirSync(dir).filter(n=>fs.statSync(dir+'/'+n).isFile()).map(name=>{
      const b=fs.readFileSync(dir+'/'+name);return {name,sha256:require('node:crypto').createHash('sha256').update(b).digest('hex'),base64:b.toString('base64')};
    });
    const journal=dir+'/diagnostics.jsonl.gz';
    fs.writeFileSync(journal,z.gzipSync(records.map(r=>JSON.stringify(r)).join('\n')));
    const recovered=z.gunzipSync(fs.readFileSync(journal)).toString().split('\n').map(JSON.parse);
    for(const row of recovered){const b=Buffer.from(row.base64,'base64');assert.deepEqual(b,fs.readFileSync(dir+'/'+row.name));assert.equal(require('node:crypto').createHash('sha256').update(b).digest('hex'),row.sha256);}
    for(const row of records)fs.unlinkSync(dir+'/'+row.name);
  }
}
if(require.main===module)(async()=>{
  const run=path.resolve(process.env.Q3_FIXTURE_TEST_RUN);fs.mkdirSync(run,{recursive:true});
  await scenario(run,'enter',true);
  for(const mode of ['enter','arrow','combo','missing-key','wrong-key','release-stuck','source-race','untrusted'])await scenario(run,mode);
  console.log('PASS actual full composed fixture/controller: old FAIL; Enter/arrow/combo held and release PASS; missing/wrong/stuck/replaced/untrusted refused terminal; normal child waits and separate EOF; offline only');
})().catch(error=>{console.error(error);process.exitCode=1;});
