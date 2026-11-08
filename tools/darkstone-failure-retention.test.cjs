'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),Module=require('node:module');
const {spawn,execFileSync}=require('node:child_process'),{once}=require('node:events');
const root=path.resolve(__dirname,'..'),run=root+'/scratch/runs/20261108-darkstone-failure-retention-2116';
const prior='2a83f628d1ac15d705e97b7247dce59e97420d16';
const base=require('./gltron-logical-fps-local.cjs');
const transport=require('./darkstone-command-transport.cjs').loadTransport(root+'/scratch/runs/20261108-darkstone-current-bat-2025/transport.cjs');
function consumer(version){
 const driver=new Module(__filename,module);driver.filename=__filename;driver.paths=module.paths;
 driver._compile(version==='before'?execFileSync('git',['show',prior+':tools/darkstone-browser-driver.cjs'],{encoding:'utf8'}):fs.readFileSync(__dirname+'/darkstone-browser-driver.cjs','utf8'),__filename);
 const file=root+'/scratch/runs/20261108-darkstone-de53-encounter-2105/consumer.cjs';
 const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));
 const original=m.require.bind(m);m.require=name=>name===root+'/tools/darkstone-browser-driver.cjs'?driver.exports:original(name);
 m._compile(fs.readFileSync(file,'utf8'),file);return m.exports.buildSource();
}
for(const version of ['before','after'])for(const mode of ['startup-timeout','normal','late-client-fault','close-evaluate-timeout'])test(version+' exact2105 automatic close '+mode,{timeout:45000},async t=>{
 fs.mkdirSync(run,{recursive:true});const out=fs.mkdtempSync(run+'/case-'+version+'-'+mode+'-');
 fs.mkdirSync(out+'/commands');fs.mkdirSync(out+'/chrome-profile');fs.writeFileSync(out+'/chrome-profile/sentinel','retain exact profile');
 const source=consumer(version);new vm.Script(source);
 const browser=spawn(process.execPath,['-e',`
 const {spawn}=require('node:child_process');
 process.send('ready');process.on('message',()=>{
 const writer=spawn(process.execPath,['-e',"setTimeout(()=>{console.log('inherited writer EOF');process.exit(0)},350)"],{stdio:['ignore',process.stdout,process.stderr]});
 writer.unref();process.exit(0);});
 `],{stdio:['ignore','pipe','pipe','ipc']});
 const closed=once(browser,'close');await once(browser,'message');
 const logs=require('./native-command-log.cjs').createLogs(out);logs.attach('chrome.stdout',browser.stdout);logs.attach('chrome.stderr',browser.stderr);
 t.after(async()=>{if(browser.exitCode===null)browser.kill('SIGKILL');await closed;logs.close();});
 let requests=0,unknown=false,lateResponse,cdpTimer;
 const pending=new Map(),ctx=vm.createContext({fs,require,console,root,out,browser,server:null,compressedLogs:logs,process:{exitCode:0},
 closing:false,timer:null,diskMonitor:null,pending,id:0,pageSession:'page',Date,assert,deadline:Date.now()+5000,
 setTimeout:(fn,ms)=>{assert.equal(ms,20000);cdpTimer=setTimeout(fn,version==='after'&&mode==='startup-timeout'?ms:25);return cdpTimer;},clearTimeout,clearInterval,
 save:(n,v)=>base.writeJson(out+'/'+n,v),log:(n,v)=>logs.append(n,JSON.stringify(v)+'\n'),t:transport,
 ws:{readyState:1,close(){},send(s){const request=JSON.parse(s),reply=result=>ctx.ws.onmessage({data:JSON.stringify({id:request.id,result})});
 if(request.method==='Browser.close'){requests++;browser.send('close');reply({});}
 else if(unknown){lateResponse=()=>reply({result:{value:[]}});}
 else{reply({result:{value:[]}});}
 }}});
 vm.runInContext(source.slice(source.indexOf(version==='before'?'async function send(':'async function rawSend('),source.indexOf('async function event('))+source.slice(source.indexOf('let closePromise;function close(reason)'),source.indexOf('(async()=>{\n server=')),ctx);
 const handler=source.slice(source.indexOf('ws.onmessage=msg=>{'),source.indexOf("\n save('browser-version.json'"));vm.runInContext(handler,ctx);
 if(mode==='startup-timeout'){
  unknown=true;await assert.rejects(ctx.evaluate('startup'),/CDP UNKNOWN Runtime.evaluate/);unknown=false;
  // Execute the actual outer rejection handler, not a substitute cleanup call.
  const body=source.slice(source.indexOf('})().catch(async e=>{')+'})().catch(async e=>{'.length,source.lastIndexOf('});'));
  const failed=vm.runInContext('(async e=>{'+body+'})',ctx)(Error('CDP UNKNOWN Runtime.evaluate; no replay')).then(()=>null,e=>e);
  await new Promise(r=>setTimeout(r,60));assert(fs.existsSync(out+'/chrome-profile'));assert(!fs.existsSync(out+'/cleanup.json'));
  lateResponse();const error=await failed;
  assert.equal(Boolean(error),version==='after');
 }else{
  const request=transport.request(out,'finish',{action:'quit'},55000).then(v=>({v}),e=>({e}));
  if(mode==='close-evaluate-timeout')unknown=true;
  const consume=transport.consume(out,0,ctx.execute).then(v=>({v}),e=>({e}));
  await new Promise(r=>setTimeout(r,60));assert(fs.existsSync(out+'/chrome-profile'));assert(!fs.existsSync(out+'/reply-0.json'));
  if(mode==='close-evaluate-timeout'){unknown=false;lateResponse();}
  if(mode==='late-client-fault')base.writeJson(out+'/transport-closed.json',{error:'ACK UNKNOWN',sticky:true});
  const result=await consume;
  // Avoid waiting 55 seconds after an intentionally suppressed ACK. The real
  // client's timeout is separately covered; report the actual runtime failure.
  if(result.e)base.writeJson(out+'/first-failure.json',{error:String(result.e),noReplay:true});
  const reply=await request;assert.equal(Boolean(result.e),version==='after'&&mode!=='normal');
  assert.equal(Boolean(reply.e),Boolean(result.e));
 }
 await closed;assert.equal(browser.exitCode,0);assert(browser.stdout.readableEnded);
 assert.equal(JSON.parse(fs.readFileSync(out+'/browser-terminal.json')).drained,true);
 assert.equal(JSON.parse(fs.readFileSync(out+'/stream-log-drain.json')).eof,true);assert.equal(requests,1);
 const retained=version==='after'&&mode!=='normal';assert.equal(fs.existsSync(out+'/chrome-profile'),retained);assert.equal(fs.existsSync(out+'/cleanup.json'),!retained);
 if(retained){assert.equal(fs.readFileSync(out+'/chrome-profile/sentinel','utf8'),'retain exact profile');assert(!fs.existsSync(out+'/reply-0.json'));await assert.rejects(transport.request(out,'retry',{action:'quit'},55000),/sticky/);}
 console.log(JSON.stringify({version,mode,retained,actualNodeWait:browser.exitCode,streamEOF:true}));
});

test('actual2105 missing lineage preserves kernel EXIT and terminal wait without PPID inference',()=>{
 const zlib=require('node:zlib'),crypto=require('node:crypto');
 const dir=root+'/scratch/runs/20261108-darkstone-de53-encounter-2105/remote-evidence';
 const data=zlib.gunzipSync(fs.readFileSync(dir+'/custody.ndjson.gz'));
 const drain=JSON.parse(zlib.gunzipSync(fs.readFileSync(dir+'/kernel-drain.json.gz')));
 assert.equal(crypto.createHash('sha256').update(data).digest('hex'),drain.journal.originalSha256);
 assert.equal(data.length,drain.journal.originalBytes);
 const rows=data.toString().trim().split('\n').map(JSON.parse);
 assert.equal(drain.complete,false);assert.equal(drain.kernelForkLineageComplete,false);assert.deepEqual(drain.cancellation,[]);
 assert.equal(drain.owned.length,314);assert.equal(drain.reaped.length,314);
 assert.deepEqual(drain.unresolvedLineage.map(r=>[r.pid,r.start,r.tgid,r.ppid,r.parentCustodian]),[[7535,'17834',6629,6533,null]]);
 assert(!rows.some(r=>(r.kind==='fork-parent-release'&&r.child===7535)||(r.kind==='fork-lineage'&&r.pid===7535)));
 const exit=rows.find(r=>r.sequence===2441),reap=rows.find(r=>r.sequence===2446);
 assert.equal(exit.kind,'unlinked-exit-retirement');assert.equal(exit.exitStatus,0);assert.equal(exit.lineageResolved,false);
 assert.equal(reap.kind,'reaped');assert.equal(reap.pid,7535);assert.equal(reap.start,'17834');assert.equal(reap.status,0);
 assert.deepEqual(drain.remaining,[]);assert.deepEqual(drain.unreaped,[]);
 console.log(JSON.stringify({actual2105:{terminalReaps:314,unresolved:7535,exitSequence:2441,reapSequence:2446,causalRepairSupported:false,startupCause:'UNKNOWN'}}));
});
