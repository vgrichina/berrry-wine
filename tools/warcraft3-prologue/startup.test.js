'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const {once}=require('node:events'),{observe}=require('./startup'),{compose}=require('./native-composition'),{fixtureSource}=require('./startup-fixture');
const root=path.resolve(__dirname,'../..'),base=path.resolve(process.argv[2]||'scratch/runs/20261109-warcraft-startup-terminal-repair-0244/node-controls');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const manifest=process.argv[3];
async function main(){
 fs.mkdirSync(base,{recursive:true});
 for(const repair of [true,false])new(require('node:vm').Script)(compose({root,repair}));
 for(const mode of ['normal','before-late','after-late','late-deadline','early','cancel','noendpoint','force'])new(require('node:vm').Script)(fixtureSource({root,mode}));
 const production=compose({root});assert(production.includes('guard.qualify()'));assert(production.includes("createRendererIdentity"));assert(!production.includes('for(let i=0;i<100&&!fs.existsSync(active)'));
 // Pending request never prevents terminal/EOF observation; force stays abnormal.
 if(!process.env.RACE_ONLY)for(const control of ['exit-before-close','kill','separate-eof','cancel-after-ready','deadline-sticky']){
  const script=['cancel-after-ready','deadline-sticky'].includes(control)?"process.stdin.once('data',()=>process.exit(0))":control==='exit-before-close'?'process.exit(0)':control==='separate-eof'?"const cp=require('child_process');cp.spawn(process.execPath,['-e','setTimeout(()=>{},250)'],{stdio:['ignore',process.stdout,process.stderr]});process.exit(0)":"setInterval(()=>{},100);process.on('SIGTERM',()=>{})";
  const child=cp.spawn(process.execPath,['-e',script],{stdio:['pipe','pipe','pipe']}),rows=[];
  const custody=observe(child,{deadline:Date.now()+1200,record:r=>rows.push(r)});child.stdout.resume();child.stderr.resume();
  if(control==='cancel-after-ready')custody.cancel();
  if(control==='deadline-sticky'){await pause(1250);assert.throws(()=>custody.check(),/immutable run deadline/);custody.cancel('later cancellation');assert.throws(()=>custody.check(),/immutable run deadline/);child.kill('SIGTERM');await once(child,'close')}
  if(!['kill','cancel-after-ready','deadline-sticky'].includes(control))while(!custody.state.terminal)await pause(5);
  const receipt=await custody.close(()=>control==='cancel-after-ready'?new Promise(r=>{child.stdin.end('close');r()}):new Promise(()=>{}));assert(receipt.drained);assert(!receipt.normal);assert(rows.some(r=>r.kind==='stdout-eof'));assert(rows.some(r=>r.kind==='stderr-eof'));if(control==='separate-eof')assert(receipt.elapsedMs>100);if(control==='kill')assert(receipt.signals.length);
  fs.writeFileSync(base+'/'+control+'.json',JSON.stringify({receipt,rows},null,2));
 }
 const races=['race-version-cap','race-version-cancel','race-completed-version','race-connection-cap','race-ordinary-version','race-sticky-version'];
 for(const mode of process.env.RACE_ONLY?races:['late-deadline','early','cancel','noendpoint','force','normal','after-late',...races]){
  const dir=base+'/'+mode;
  if(manifest)cp.execFileSync(process.execPath,[__dirname+'/prepare.js','--native',manifest,dir],{stdio:'pipe'});
  else {fs.mkdirSync(dir);fs.writeFileSync(dir+'/runtime-pins.json',JSON.stringify({files:[],httpPins:[]}))}
  const child=cp.spawn(process.execPath,[__dirname+'/startup-fixture.js',dir,mode,'--node-only',...(manifest?['--prepared']:[])],{env:{...process.env,BROWSER_DEADLINE:String(Date.now()+45000)},stdio:['ignore','pipe','pipe']});
  const chunks={stdout:[],stderr:[]};for(const name of ['stdout','stderr'])child[name].on('data',b=>chunks[name].push(b));
  let timer;if(mode==='cancel')timer=setTimeout(()=>child.kill('SIGTERM'),350);
  const failsafe=setTimeout(()=>child.kill('SIGKILL'),47000);
  const [code,signal]=await once(child,'close');clearTimeout(failsafe);clearTimeout(timer);
  fs.writeFileSync(dir+'/driver.wait.json',JSON.stringify({code,signal,stdoutEOF:child.stdout.readableEnded,stderrEOF:child.stderr.readableEnded}));
  assert(child.stdout.readableEnded&&child.stderr.readableEnded,mode+' separate driver EOF');
  for(const name of ['stdout','stderr'])fs.writeFileSync(dir+'/driver.'+name,Buffer.concat(chunks[name]));
  assert.equal(signal,null,mode+' driver must exit without independent kill');assert.equal(code,['normal','after-late'].includes(mode)?0:1,mode+' '+Buffer.concat(chunks.stderr));
  const out=dir+'/original',receipt=JSON.parse(fs.readFileSync(out+'/browser-terminal.json'));
  assert(receipt.drained&&receipt.stdoutEOF&&receipt.stderrEOF,mode);assert.equal(receipt.normal,['normal','after-late'].includes(mode));
  if(['normal','after-late'].includes(mode))assert(fs.existsSync(out+'/fixture-startup.json'));
  else assert(!fs.existsSync(out+'/fixture-startup.json')||mode==='force');
  if(races.includes(mode)){
   const rows=fs.readFileSync(dir+'/node-protocol.jsonl','utf8').trim().split('\n').map(JSON.parse),closed=JSON.parse(fs.readFileSync(out+'/close-reason.json'));
   assert.equal(closed.reason,mode.includes('cancel')?'explicit cancellation':mode==='race-ordinary-version'?'ordinary completion':'immutable runtime cap');
   assert.equal(JSON.parse(fs.readFileSync(out+'/transport-closed.json')).error,closed.reason+'; UNKNOWN; no replay');
   assert(!fs.existsSync(out+'/browser-version.json'));assert(!fs.existsSync(out+'/ready.json'));
   assert.equal(receipt.unknown,closed.reason,mode+' retains earliest reason even after later cancellation');
   for(const label of ['command','input','spoof-release','capture','quit'])assert(rows.some(r=>r.kind==='probe'&&r.label===label&&!r.accepted),mode+' rejected '+label);
   for(const label of ['release','mouse-release'])assert(rows.some(r=>r.kind==='probe'&&r.label===label&&r.accepted),mode+' allowed '+label);
   const trigger=rows.findIndex(r=>r.kind==='close-trigger');assert(trigger>=0);
   assert(rows.slice(trigger+1).filter(r=>r.kind==='request').every(r=>r.method==='Browser.close'||['keyUp','mouseReleased'].includes(r.params.type)),mode+' no later ordinary requests');
   assert(rows.some(r=>r.kind==='request'&&r.method==='Browser.close'));
   assert(rows.some(r=>r.kind==='delivery'&&r.method==='Browser.getVersion')||mode.includes('connection'),mode+' real late response');
   if(mode==='race-completed-version'){
    const lifecycle=fs.readFileSync(out+'/browser-lifecycle.jsonl','utf8').trim().split('\n').map(JSON.parse);
    assert(rows.find(r=>r.kind==='delivery'&&r.method==='Browser.getVersion').at>=lifecycle.find(r=>r.kind==='terminal-result').at);
   }
  }
  assert(!fs.existsSync(out+'/chrome-profile'));console.log(mode+' PASS actual composed startup/close; Node child only');
 }
 console.log('Production composition, signal terminal, separate EOF, cancellation and endpoint negatives PASS; no Chrome started');
}
main().catch(e=>{console.error(e);process.exitCode=1});
