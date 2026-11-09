'use strict';
// Actual current preparer dispatch first exercised in memory, then as shipped.
// Provider bytes are read in place; virtual staging never copies modules/media.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const assert=require('node:assert/strict'),crypto=require('node:crypto'),Module=require('node:module');
const {once}=require('node:events');
const root=path.resolve(__dirname,'..'),publication=require('./redline-current-publication.cjs');
const base=path.resolve(process.env.REDLINE_CLOSURE_RUN),memory=process.argv.includes('--memory');
fs.mkdirSync(base,{recursive:true});
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function memoryCurrent(){
 let source=cp.execFileSync('git',['show','8fd1a5421:tools/redline-current-module.cjs'],{cwd:root,encoding:'utf8'});
 for(const name of ['validate','prepare']){
  const before=name==='validate'?'function validate(){':'function prepare(run){';
  const after=name==='validate'?"function validate(options={}){\n  assert(Object.keys(options).every(k=>k==='publicationVersion'),'explicit supported validation options');\n  if(options.publicationVersion!==undefined)return require('./redline-current-publication.cjs').validate(options.publicationVersion);":
   "function prepare(run,options={}){\n  assert(Object.keys(options).every(k=>k==='publicationVersion'),'explicit supported preparation options');\n  if(options.publicationVersion!==undefined)return require('./redline-current-publication.cjs').prepare(run,options.publicationVersion);";
  assert.equal(source.split(before).length,2);source=source.replace(before,after);
 }
 const filename=path.join(__dirname,'redline-current-module.cjs'),m=new Module(filename,module);m.filename=filename;m.paths=module.paths;m._compile(source,filename);return m.exports;
}
const current=memory?memoryCurrent():require('./redline-current-module.cjs');
function reject(name,call){const target=path.join(base,name);assert(!fs.existsSync(target));assert.throws(()=>call(target));assert(!fs.existsSync(target),'refuse before destination/spawn');}
function substitute(name,kind,invoke){
 const original=fs.readFileSync,target=path.join(root,name);
 fs.readFileSync=function(file,...args){
  if(path.resolve(String(file))===target){
   if(kind==='missing'){const e=Error('missing staged '+name);e.code='ENOENT';throw e;}
   const raw=original.call(this,file);const b=Buffer.from(raw);b[b.length-1]^=1;
   return typeof args[0]==='string'?b.toString(args[0]):b;
  }
  return original.call(this,file,...args);
 };
 try{invoke();}finally{fs.readFileSync=original;}
}
async function bounded(executable,args,env){
 const watchdog=cp.spawn(process.execPath,['-e',"let p;console.log('ARMED');process.stdin.on('data',b=>{if(b.toString().trim()==='DONE')process.exit(0);p=Number(b)});setTimeout(()=>{if(p)try{process.kill(-p,'SIGKILL')}catch{};process.exit(9)},45000)"],{stdio:['pipe','pipe','pipe']});
 const wx=once(watchdog,'exit'),wc=once(watchdog,'close');watchdog.stderr.resume();
 assert.match(String((await once(watchdog.stdout,'data'))[0]),/ARMED/);watchdog.stdout.resume();
 const child=cp.spawn(executable,args,{detached:true,env:{...process.env,...env},stdio:['ignore','pipe','pipe']});
 const ex=once(child,'exit'),closed=once(child,'close');let stdout='',stderr='';
 child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);watchdog.stdin.write(child.pid+'\n');
 const [code,signal]=await ex;await closed;watchdog.stdin.write('DONE\n');
 const [watchdogCode]=await wx;await wc;assert.equal(watchdogCode,0);
 return {code,signal,stdout,stderr,actualWait:true,stdoutEOF:true,stderrEOF:true,watchdogCode,watchdogSeparateEOF:true};
}
async function main(){
 if(process.argv[2]==='--outer-runner'){
  const run=process.argv[3],deadline=Number(process.env.BROWSER_DEADLINE);
  const child=publication.launch({run,publicationVersion:publication.version,deadline,options:{stdio:'inherit',env:process.env}});
  const ex=once(child,'exit'),closed=once(child,'close');const [code,signal]=await ex;await closed;assert.equal(code,0);assert.equal(signal,null);return;
 }
 reject('default-old-refuses',dest=>current.prepare(dest));
 reject('unknown',dest=>current.prepare(dest,{publicationVersion:'unknown'}));
 reject('unknown-option',dest=>current.prepare(dest,{skipValidation:true}));
 const version=publication.version,closure=current.validate({publicationVersion:version});
 const required=Object.keys(publication.published).filter(n=>n.startsWith('tools/'));
 for(const name of required)assert.equal(closure.files.filter(p=>p.path===name).length,1,name);
 const dest=path.join(base,'prepared');const plan=current.prepare(dest,{publicationVersion:version});
 assert.equal(plan.nativeAttemptAuthorized,false);assert.equal(plan.nativeReady,false);
 const pins=publication.prelaunch(dest,version);assert.equal(hash(fs.readFileSync(dest+'/runtime-pins.json')),plan.manifestSHA256);
 // Execute every generated import from a different virtual staging root.
 const relocated='/virtual-redline-stage',stagedRun=path.join(relocated,path.relative(root,dest));let dispatched=false;
 for(const name of ['publication-caller.cjs','bound-input.cjs','ordinary-keys.cjs','native-mouse.cjs','relative-input.cjs','keyboard-bridge.cjs','transport.cjs']){
  const source=fs.readFileSync(path.join(dest,name),'utf8');
  require('node:vm').runInNewContext(source,{__dirname:stagedRun,module:{exports:{}},require:target=>{
   const resolved=path.resolve(stagedRun,target),relative=path.relative(relocated,resolved);
   assert(pins.files.some(p=>p.path===relative),'actual relocated import in staged closure: '+relative);
   if(name==='publication-caller.cjs')return {runCaller:(run,selected,digest)=>{assert.equal(run,stagedRun);assert.equal(selected,version);assert.match(digest,/^[a-f0-9]{64}$/);dispatched=true;}};
   return {};
  }});
 }
 assert(dispatched);
 for(const name of [...required,'host.js','src/05-alu.wat','build/wine-assembly.wasm'])for(const kind of ['missing','SHA']){
  substitute(name,kind,()=>{
   reject('refuse-'+name.replaceAll('/','-')+'-'+kind,d=>current.prepare(d,{publicationVersion:version}));
   let spawned=false;assert.throws(()=>publication.launch({run:dest,publicationVersion:version,deadline:Date.now()+30000,spawn:()=>{spawned=true;}}));assert(!spawned);
  });
 }
 assert.throws(()=>publication.launch({run:dest,publicationVersion:'unknown',spawn:()=>assert.fail('spawn')}));
 assert(!fs.existsSync(dest+'/publication-custody'),'negative prelaunch did not create custody');
 // Literal default OFF still delegates exactly to the published adapter.
 let called;const argv=['literal executable','space argument','$(inert);`literal`','--flag=x=y'],options={stdio:'inherit'};
 require('./redline-publication-caller.cjs').launch({argv,options,spawn:(...args)=>called=args});assert.deepEqual(called,[argv[0],argv.slice(1),options]);
 const generated=publication.fixtureSource(version);
 assert(generated.includes(".launch({run,publicationVersion:"));assert(generated.includes(".retrieve(run+'/publication-custody')"));
 assert(generated.includes('deadline+30000'));assert(generated.includes("[',','comma']"));
 // Execute the full generated caller through its real preflight return; the
 // retained process exits before HTTP server/browser/game creation.
 const receipt=await bounded(process.execPath,[dest+'/publication-caller.cjs'],{REDLINE_RUN:dest,REDLINE_NATIVE_FIXTURE:'1',REDLINE_NATIVE_TRACE:'1',REDLINE_STARTUP_BOUNDARY:'1',DRIVER_PREFLIGHT:'1',BROWSER_DEADLINE:String(Date.now()+40000)});
 assert.equal(receipt.code,0,receipt.stderr);assert.equal(JSON.parse(receipt.stdout).chromiumStarted,false);
 fs.writeFileSync(path.join(base,'generated-caller-preflight.json'),JSON.stringify(receipt,null,2));
 const outer=await bounded(process.execPath,[__filename,'--outer-runner',dest],{REDLINE_RUN:dest,REDLINE_NATIVE_FIXTURE:'1',REDLINE_NATIVE_TRACE:'1',REDLINE_STARTUP_BOUNDARY:'1',DRIVER_PREFLIGHT:'1',BROWSER_DEADLINE:String(Date.now()+40000)});
 fs.writeFileSync(path.join(base,'actual-outer-wait.json'),JSON.stringify(outer,null,2));
 assert.equal(outer.code,0,outer.stderr);
 // The unchanged collector merges the supervised command into its journal;
 // outer separate pipe EOF is not separate command/browser EOF.
 assert.equal(JSON.parse(fs.readFileSync(dest+'/publication-custody/kernel-command.log','utf8')).chromiumStarted,false);
 const retrieval=require('./redline-publication-caller.cjs').retrieve(dest+'/publication-custody');assert(retrieval.custodyComplete);assert.equal(retrieval.publication,'UNKNOWN');
 const drain=JSON.parse(fs.readFileSync(dest+'/publication-custody/kernel-drain.json'));assert.equal(drain.remaining.length,0);assert.equal(drain.unreaped.length,0);
 for(const p of drain.owned){assert(drain.reaped.some(r=>r.pid===p.pid&&r.start===p.start));assert(!fs.existsSync('/proc/'+p.pid));}
 fs.writeFileSync(path.join(base,'actual-outer-launch.json'),JSON.stringify({outer,retrieval},null,2));
 // Lossless compression of this run's recoverable raw journal immediately
 // after all assertions/retrieval; retain exact original SHA and byte count.
 const journal=dest+'/publication-custody/publication-syscalls.ndjson',rawJournal=fs.readFileSync(journal),compressed=require('node:zlib').gzipSync(rawJournal);
 assert.deepEqual(require('node:zlib').gunzipSync(compressed),rawJournal);fs.writeFileSync(journal+'.gz',compressed,{flag:'wx'});assert.deepEqual(require('node:zlib').gunzipSync(fs.readFileSync(journal+'.gz')),rawJournal);
 fs.writeFileSync(path.join(base,'journal-recovery.json'),JSON.stringify({path:journal,bytes:rawJournal.length,sha256:hash(rawJournal),gzip:journal+'.gz',gzipBytes:compressed.length,gzipSHA256:hash(compressed),recipe:'gzip -dc GZIP > ORIGINAL; verify SHA-256 and size'},null,2));fs.unlinkSync(journal);
 // Import and run the actual snapshot validator against a virtual staged
 // manifest. Its imports and helper/collector reads resolve authenticated bytes
 // in place. The earlier closure cannot even import the required snapshot API.
 const python=String.raw`import sys,json,pathlib,types,builtins,base64,hashlib,gzip
payload=json.load(sys.stdin);allowed=set(payload['files']);root=pathlib.Path.cwd()
original=pathlib.Path.read_bytes
def read(p):
 name=str(p.resolve().relative_to(root))
 if name.startswith('tools/') and name not in allowed:raise FileNotFoundError('unstaged transitive provider: '+name)
 return original(p)
pathlib.Path.read_bytes=read
launcher=types.ModuleType('native_publication_launch');launcher.__file__=str(root/'tools/native_publication_launch.py')
exec(compile(read(pathlib.Path(launcher.__file__)),launcher.__file__,'exec'),launcher.__dict__)
sys.modules[launcher.__name__]=launcher
snapshot=types.ModuleType('staged_snapshot');snapshot.__file__=str(root/'tools/redline-publication-snapshots.py')
exec(compile(read(pathlib.Path(snapshot.__file__)),snapshot.__file__,'exec'),snapshot.__dict__)
sha=lambda b:hashlib.sha256(b).hexdigest()
custody=b'{"sequence":1,"kind":"fixture"}\n'
begin=(json.dumps(dict(kind='begin',observerSequence=1,previousSha256='0'*64,maxRecords=4096,maxBytes=4194304))+'\n').encode()
end=(json.dumps(dict(kind='end',observerSequence=2,previousSha256=sha(begin),complete=True,incompleteReasons=[],observationOnly=True))+'\n').encode()
values={'kernel-drain.json':json.dumps(dict(journal=dict(path='custody.ndjson.gz',originalSha256=sha(custody),originalBytes=len(custody)),reaped=[],complete=False,exit=None,commandLog=dict(eof=False))).encode(),'custody.ndjson.gz':gzip.compress(custody),'publication-syscalls.ndjson':begin+end,'kernel-command.log':b'fixture','publication-launch.json':b'{}'}
report=snapshot.validate(values,4096)
assert report['custodyComplete'] is False and report['observerComplete'] is True
print(json.dumps(dict(passed=True,readiness=report['readiness'],publication=report['publication'])))
`;
 const staged=pins.files.map(p=>p.path),old=JSON.parse(fs.readFileSync(path.join(root,current.historical))).files.map(p=>p.path);
 const oldResult=cp.spawnSync('python3',['-B','-c',python],{input:JSON.stringify({files:old}),encoding:'utf8',timeout:10000});assert.notEqual(oldResult.status,0);assert.match(oldResult.stderr,/unstaged transitive provider/);
 const newResult=cp.spawnSync('python3',['-B','-c',python],{input:JSON.stringify({files:staged}),encoding:'utf8',timeout:10000});assert.equal(newResult.status,0,newResult.stderr);
 const importReceipts=[{name:'historical-closure-FAIL',status:oldResult.status,stdout:oldResult.stdout,stderr:oldResult.stderr},{name:'current-closure-PASS',status:newResult.status,stdout:newResult.stdout,stderr:newResult.stderr}];
 for(const name of ['tools/redline-publication-snapshots.py','tools/native_publication_launch.py','tools/native_publication_observer.py','tools/native_kernel_custody.py']){
  const r=cp.spawnSync('python3',['-B','-c',python],{input:JSON.stringify({files:staged.filter(n=>n!==name)}),encoding:'utf8',timeout:10000});assert.notEqual(r.status,0);assert.match(r.stderr,/unstaged transitive provider/);
  importReceipts.push({name:'missing-'+name,status:r.status,stdout:r.stdout,stderr:r.stderr});
 }
 fs.writeFileSync(path.join(base,'staged-import-receipts.json'),JSON.stringify({actualWait:true,stdoutEOF:true,stderrEOF:true,rows:importReceipts},null,2));
 if(!memory){
  const cli=await bounded(process.execPath,[path.join(__dirname,'redline-current-module.cjs'),'--prepare',path.join(base,'cli-prepared'),'--publication-version',version],{});assert.equal(cli.code,0,cli.stderr);assert.equal(JSON.parse(cli.stdout).moduleVersion,version);
  fs.writeFileSync(path.join(base,'actual-preparer-cli.json'),JSON.stringify(cli,null,2));
 }
 const result={passed:true,memoryCandidate:memory,actualGeneratedCaller:true,stagedImportOldFAIL:true,stagedImportNewPASS:true,preSpawnRefusals:2*(required.length+3)+1,providers:pins.files.length,defaultOffLiteralArgvExact:true,nativeReady:false,box:'NOT_CREATED'};
 fs.writeFileSync(path.join(base,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
