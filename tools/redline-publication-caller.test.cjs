'use strict';
// Actual generated launch/finalize seams with real inert children under custody.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const assert=require('node:assert/strict'),vm=require('node:vm'),{once}=require('node:events');
const adapter=require('./redline-publication-caller.cjs'),trace=require('./redline-native-trace.cjs');
const base=path.resolve(process.env.REDLINE_PUBLICATION_RUN||'scratch/runs/20261109-redline-publication-caller-integration-1515/tests');
const save=(dir,name,value)=>fs.writeFileSync(path.join(dir,name),JSON.stringify(value,null,2),{flag:'wx'});
async function runner(){
 const [out,writer,mode,target]=process.argv.slice(3);const source=adapter.candidate();
 // Execute the literal shipped generated browser launch and retrieval expressions.
 const site=source.split('\n').find(l=>l.includes("browser=nativeTrace.launch({spawn:cp.spawn"));
 const retrieval=source.match(/save\('native-trace-retrieval.json',nativeTrace.retrieve\(out,receipt\)\);/)[0];
 const context=vm.createContext({assert,out,save:(n,v)=>save(out,n,v),closing:false,nativeTrace:trace,
  cp:{spawn:(executable,argv,options)=>{
   save(out,'actual-generated-argv.json',{executable,argv,options});
   return cp.spawn(writer,[mode,target,...argv],options);
  }}});
 vm.runInContext('let browser;'+site+';globalThis.child=browser;',context);
 const child=context.child;let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
 const exited=once(child,'exit'),closed=once(child,'close');
 process.on('SIGTERM',()=>child.kill('SIGTERM'));
 save(out,'runner-cancellation-ready.json',{pid:process.pid});
 const [code,signal]=await exited;await closed;
 context.receipt={actualBrowserExit:{code,signal},streamEOF:true,firstFailure:mode==='cancel'?'SIGTERM':null};
 vm.runInContext(retrieval,context);save(out,'actual-waits.json',{...context.receipt,stdout,stderr});
 if(signal||code)process.exitCode=1;
}
async function execute(name,mode,enabled=true){
 const dir=path.join(base,name);fs.mkdirSync(dir);const out=path.join(dir,'browser');fs.mkdirSync(out);
 const deadline=Date.now()+90000;save(dir,'lifecycle.json',{browserDeadline:deadline});
 const target=path.join(dir,'DevToolsActivePort');if(mode==='failedopen')fs.writeFileSync(target,'existing');
 const watchdog=cp.spawn(process.execPath,['-e',`let pid;console.log('ARMED');process.stdin.on('data',b=>{if(b.toString().trim()==='DONE')process.exit(0);pid=Number(b)});setTimeout(()=>{if(pid)try{process.kill(pid,'SIGTERM')}catch{}},95000);setTimeout(()=>{if(pid)try{process.kill(pid,'SIGKILL')}catch{};process.exit(9)},100000);`],{stdio:['pipe','pipe','pipe']});
 const wx=once(watchdog,'exit'),wc=once(watchdog,'close');watchdog.stderr.resume();assert.match(String((await once(watchdog.stdout,'data'))[0]),/ARMED/);watchdog.stdout.resume();
 save(dir,'watchdog-armed.json',{pid:watchdog.pid,finiteMs:100000,outsideCustodyP_ALL:true});
 let child,code,signal;
 try{
  child=cp.spawn(process.execPath,[path.join(__dirname,'redline-publication-caller.cjs'),'--launch',dir,
   ...(enabled?['--publication-observer='+adapter.version,'--max-records=16384']:[]),'--',
   process.execPath,__filename,'--runner',out,path.join(base,'writer'),mode,target],{stdio:['ignore','pipe','pipe']});
  watchdog.stdin.write(String(child.pid)+'\n');const exit=once(child,'exit'),close=once(child,'close');let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
  if(mode==='cancel'){
   const until=Date.now()+80000;
   while(!fs.existsSync(path.join(out,'runner-cancellation-ready.json'))&&Date.now()<until)await new Promise(r=>setTimeout(r,10));
   assert(fs.existsSync(path.join(out,'runner-cancellation-ready.json')),'actual generated spawn and cancellation handler ready');child.kill('SIGTERM');
  }
  [code,signal]=await exit;await close;save(dir,'owner-wait.json',{code,signal,stdoutEOF:true,stderrEOF:true,stdout,stderr});
  assert.equal(code,mode==='cancel'?1:0,stderr);
 }finally{
  if(child&&child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');
  watchdog.stdin.write('DONE\n');const [watchdogCode]=await wx;await wc;save(dir,'watchdog-wait.json',{actualWait:watchdogCode,separateEOF:true});assert.equal(watchdogCode,0);
 }
 const generated=JSON.parse(fs.readFileSync(path.join(out,'actual-generated-argv.json')));
 assert.equal(generated.executable,'/usr/bin/google-chrome');assert(generated.argv.includes('--trace-startup-duration=10'));
 assert(generated.argv.includes('--trace-startup-file='+out+'/native-startup-trace.json'));
 if(enabled){
  const report=adapter.retrieve(dir);save(dir,'adapter-retrieval.json',report);
  assert(report.custodyComplete);assert.equal(report.publication,'UNKNOWN');assert.equal(report.ancestry,'UNKNOWN');assert(report.observerIntegrity.valid);
  const meta=JSON.parse(fs.readFileSync(path.join(dir,'publication-launch.json')));assert.equal(meta.browserDeadline,deadline);assert.equal(meta.cleanupDeadline,deadline+30000);
  const drain=JSON.parse(fs.readFileSync(path.join(dir,'kernel-drain.json')));assert.equal(drain.remaining.length,0);assert.equal(drain.unreaped.length,0);
  for(const p of drain.owned){assert(drain.reaped.some(r=>r.pid===p.pid&&r.start===p.start));assert(!fs.existsSync('/proc/'+p.pid));}
  const records=fs.readFileSync(path.join(dir,'publication-syscalls.ndjson'),'utf8').trim().split('\n').map(JSON.parse);
  if(mode.startsWith('failed'))assert(records.some(r=>r.kind==='return'&&r.errno===({failedopen:20,failedwrite:9,failedrename:2})[mode]));
 }else assert(!fs.existsSync(path.join(dir,'publication-syscalls.ndjson')));
 return dir;
}
async function main(){
 fs.mkdirSync(base,{recursive:true});assert(!fs.existsSync(path.join(base,'results.json')),'fresh run');
 const actual=trace.integrate();assert.equal(adapter.candidate(),actual,'candidate byte identical');
 const argv=['literal executable','space argument','$(inert);`literal`','--flag=x=y'];let called;
 const options={stdio:'inherit'};adapter.launch({argv,options,spawn:(...a)=>called=a});assert.deepEqual(called,[argv[0],argv.slice(1),options]);
 assert.throws(()=>adapter.launch({observerVersion:'stale',run:base,spawn:()=>assert.fail('spawn')}),/unknown/);
 const read=fs.readFileSync;
 for(const name of Object.keys(adapter.providers)){
  fs.readFileSync=function(file,...rest){const b=read.call(this,file,...rest);return file===path.resolve(__dirname,'..',name)?Buffer.concat([Buffer.from(b),Buffer.from('\n')]):b;};
  try{assert.throws(()=>adapter.launch({observerVersion:adapter.version,run:base,spawn:()=>assert.fail('spawn')}),/provider drift/);}finally{fs.readFileSync=read;}
 }
 const c=cp.execFileSync('python3',['-c',"import sys;sys.path.insert(0,'tools');from native_publication_observer_test import C;print(C)"] ,{encoding:'utf8'});
 const extra='for(int i=3;i<n;i++)if(!strncmp(v[i],"--trace-startup-file=",21)){int t=open(v[i]+21,O_CREAT|O_WRONLY|O_TRUNC,0600);write(t,"{\\\"traceEvents\\\":[]}",18);close(t);}';
 const input=c.replace('int main(int n,char **v) {','int main(int n,char **v) {\n'+extra);
 fs.writeFileSync(path.join(base,'writer.c'),input,{flag:'wx'});cp.execFileSync('cc',['-Wall','-Werror','-O0',path.join(base,'writer.c'),'-o',path.join(base,'writer')]);
 const rows=[];
 try{
  for(const mode of ['same','rename','failedopen','failedwrite','failedrename','childexec','cancel'])rows.push(await execute(mode,mode));
  for(const mode of ['same','cancel'])rows.push(await execute('off-'+mode,mode,false));
  const good=path.join(base,'same'),file=path.join(good,'publication-syscalls.ndjson'),raw=fs.readFileSync(file);
  for(const damaged of [raw.subarray(0,raw.lastIndexOf('\n',raw.length-2)+1),Buffer.from(raw.toString().replace(/"observerSequence": 1/, '"observerSequence": 7'))]){
   fs.writeFileSync(file,damaged);assert.throws(()=>adapter.retrieve(good));
  }
  fs.writeFileSync(file,raw);
  const gzip=path.join(good,'custody.ndjson.gz'),original=fs.readFileSync(gzip);
  for(const b of [Buffer.alloc(0),require('node:zlib').gzipSync(Buffer.alloc(0)),Buffer.from('broken')]){fs.writeFileSync(gzip,b);assert.throws(()=>adapter.retrieve(good));}
  fs.writeFileSync(gzip,original);assert.throws(()=>adapter.retrieve(good,{maxCustodyBytes:1}));
  save(base,'results.json',{passed:true,rows,defaultOffArgvExact:true,candidateByteIdentical:true,preSpawnProviderRefusals:4,nativeReady:false,publication:'UNKNOWN',box:'NOT_CREATED'});
 }finally{fs.unlinkSync(path.join(base,'writer'));fs.unlinkSync(path.join(base,'writer.c'));}
 console.log('PASS actual generated Redline launch/retrieval, real inert syscall/errno/childexec/cancellation OFF/ON, pre-spawn pins and damaged journal refusals');
}
(process.argv[2]==='--runner'?runner():main()).catch(e=>{console.error(e);process.exitCode=1;});
