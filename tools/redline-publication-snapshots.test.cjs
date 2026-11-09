'use strict';
// Executable retrieval race controls; synthetic journals prove integrity only.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const {once}=require('node:events');
const adapterPath=path.join(__dirname,'redline-publication-caller.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
if(process.env.REDLINE_SNAPSHOT_PRELOAD){
 if(process.env.REDLINE_SNAPSHOT_OLD){
  const Module=require('node:module'),original=Module._extensions['.cjs'];
  Module._extensions['.cjs']=function(mod,file){
   if(file===adapterPath)return mod._compile(cp.execFileSync('git',['show',process.env.REDLINE_SNAPSHOT_OLD+':tools/redline-publication-caller.cjs'],{encoding:'utf8'}),file);
   return original(mod,file);
  };
 }
 const execute=cp.execFileSync;
 cp.execFileSync=function(exe,args,options){
  if(exe==='python3'){
   const dir=process.env.REDLINE_SNAPSHOT_PRELOAD,mode=process.env.REDLINE_SNAPSHOT_MUTATE;
   if(mode==='secondgzip'&&args[0]==='-c'){
    // Old executable adapter: mutate after its bounded gzip preflight has
    // obtained bytes, before validate_run reopens. No source file is copied.
    const prefix=`import pathlib,gzip,json,hashlib\n_snapshot_read=pathlib.Path.read_bytes\n_snapshot_done=False\ndef _snapshot_race(p):\n global _snapshot_done\n raw=_snapshot_read(p)\n if p.name=='custody.ndjson.gz' and not _snapshot_done:\n  _snapshot_done=True\n  data=(json.dumps(dict(sequence=1,kind='fixture',padding='x'*(64*1024*1024)))+'\\n').encode()\n  p.write_bytes(gzip.compress(data))\n  drain=p.parent/'kernel-drain.json'\n  meta=json.loads(drain.read_text());meta['journal'].update(originalSha256=hashlib.sha256(data).hexdigest(),originalBytes=len(data));drain.write_text(json.dumps(meta))\n return raw\npathlib.Path.read_bytes=_snapshot_race\n`;
    args=[args[0],prefix+args[1],...args.slice(2)];
   }
   const file=path.join(dir,mode==='expanded'?'custody.ndjson.gz':'kernel-command.log');
   if(mode==='replace'){fs.renameSync(file,file+'.before');fs.writeFileSync(file,'different bytes');}
   if(mode==='growth')fs.appendFileSync(file,Buffer.alloc(4096,120));
   if(mode==='fifo'){fs.unlinkSync(file);execute('mkfifo',[file]);}
   if(mode==='symlink'){fs.unlinkSync(file);fs.symlinkSync('missing-target',file);}
   if(mode==='expanded')fs.writeFileSync(file,zlib.gzipSync(Buffer.alloc(1024*1024,120)));
  }
  return execute.call(this,exe,args,options);
 };
}else if(require.main===module){main().catch(e=>{console.error(e);process.exitCode=1;});}

function fixture(dir){
 fs.mkdirSync(dir,{recursive:true});
 const custody=Buffer.from(JSON.stringify({sequence:1,kind:'fixture'})+'\n');
 const begin=JSON.stringify({kind:'begin',observerSequence:1,previousSha256:'0'.repeat(64),maxRecords:4096,maxBytes:4194304})+'\n';
 const end=JSON.stringify({kind:'end',observerSequence:2,previousSha256:sha(begin),complete:true,incompleteReasons:[],observationOnly:true})+'\n';
 for(const [name,bytes] of Object.entries({
  'kernel-drain.json':JSON.stringify({journal:{path:'custody.ndjson.gz',originalSha256:sha(custody),originalBytes:custody.length},reaped:[],complete:false,exit:null,commandLog:{eof:false}}),
  'publication-launch.json':'{}','publication-syscalls.ndjson':begin+end,
  'custody.ndjson.gz':zlib.gzipSync(custody),'kernel-command.log':'initial log'
 }))fs.writeFileSync(path.join(dir,name),bytes);
}
async function cli(dir,mode,old){
 // Sibling watchdog is outside every target's wait domain, armed before spawn.
 const watchdog=cp.spawn(process.execPath,['-e',`let pid;console.log('ARMED');process.stdin.on('data',b=>{if(b.toString().trim()==='DONE')process.exit(0);pid=Number(b)});setTimeout(()=>{if(pid)try{process.kill(-pid,'SIGKILL')}catch{};process.exit(9)},20000)`],{stdio:['pipe','pipe','pipe']});
 const wx=once(watchdog,'exit'),wc=once(watchdog,'close');watchdog.stderr.resume();
 assert.match(String((await once(watchdog.stdout,'data'))[0]),/ARMED/);watchdog.stdout.resume();
 const child=cp.spawn(process.execPath,['--require',__filename,adapterPath,'--retrieve',dir],{detached:true,env:{...process.env,REDLINE_SNAPSHOT_PRELOAD:dir,REDLINE_SNAPSHOT_MUTATE:mode,...(old?{REDLINE_SNAPSHOT_OLD:old}:{})},stdio:['ignore','pipe','pipe']});
 watchdog.stdin.write(String(child.pid)+'\n');let stdout='',stderr='';
 child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
 const ex=once(child,'exit'),closed=once(child,'close');const [code,signal]=await ex;await closed;
 watchdog.stdin.write('DONE\n');const [watchdogCode]=await wx;await wc;assert.equal(watchdogCode,0);
 return {code,signal,stdout,stderr,actualWait:true,stdoutEOF:true,stderrEOF:true,watchdogCode,watchdogSeparateEOF:true};
}
async function main(){
 const base=path.resolve(process.env.SNAPSHOT_RUN||'scratch/runs/20261109-redline-retrieval-snapshot-repair-1545/snapshots');fs.mkdirSync(base,{recursive:true});
 const adapter=require(adapterPath),results=[];
 const old=process.env.SNAPSHOT_BASE||'de80d8a8739e248c79aabc8fdc15c9ca3678d1b0';
 const oldDir=path.join(base,'old-replace');fixture(oldDir);
 const before=await cli(oldDir,'replace',old);assert.equal(before.code,0,before.stderr);
 const bad=JSON.parse(before.stdout);assert.notEqual(bad.artifacts['kernel-command.log'].sha256,bad.commandLog.sha256,'old actual CLI hash/validation mismatch reproduced');
 results.push({name:'oldFAIL',...before});
 const oldGzip=path.join(base,'old-secondgzip');fixture(oldGzip);
 const overflow=await cli(oldGzip,'secondgzip',old);assert.equal(overflow.code,0,overflow.stderr);
 assert(JSON.parse(overflow.stdout).custodyIntegrity.originalBytes>64*1024*1024,'old second expansion bypassed decoded cap');
 results.push({name:'old-secondgzip-FAIL',...overflow});
 for(const mode of ['replace','growth','fifo','symlink','expanded','secondgzip']){
  const dir=path.join(base,mode);fixture(dir);const expected=sha(fs.readFileSync(path.join(dir,'kernel-command.log')));
  const receipt=await cli(dir,mode);assert.equal(receipt.code,0,receipt.stderr);const r=JSON.parse(receipt.stdout);
  assert.equal(r.commandLog.sha256,expected);assert.equal(r.commandLog.sha256,r.artifacts['kernel-command.log'].sha256);
  assert.equal(r.custodyIntegrity.sha256,r.artifacts['custody.ndjson.gz'].sha256);assert.equal(r.publication,'UNKNOWN');
  results.push({name:mode,...receipt});
 }
 const invalid=path.join(base,'invalid');fixture(invalid);const gz=path.join(invalid,'custody.ndjson.gz'),good=fs.readFileSync(gz);
 for(const [name,bytes,cap] of [['zero',Buffer.alloc(0),1024],['empty',zlib.gzipSync(Buffer.alloc(0)),1024],['damaged',Buffer.from('bad gzip'),1024],['truncated',good.subarray(0,good.length-1),1024],['expanded-cap',zlib.gzipSync(Buffer.alloc(4096)),1024],['compressed-cap',good,1],['concatenated-cap',Buffer.concat([good,zlib.gzipSync(Buffer.alloc(4096))]),1024]]){
  fs.writeFileSync(gz,bytes);assert.throws(()=>adapter.retrieve(invalid,{maxCustodyBytes:cap}),undefined,name);results.push({name,expected:'INVALID'});
 }
 fs.writeFileSync(gz,good);
 // Race inside the fd capture as well as at the Python handoff. A short read
 // or changed descriptor size must fail before any validation is attempted.
 for(const mode of ['grow-during-read','truncate-during-read']){
  const dir=path.join(base,mode);fixture(dir);
  const read=fs.readSync,open=fs.openSync;let target,changed=false;
  fs.openSync=function(file,...args){const fd=open.call(this,file,...args);if(file===path.join(dir,'kernel-command.log'))target=fd;return fd;};
  fs.readSync=function(fd,...args){
   if(fd===target&&!changed){changed=true;
    if(mode==='grow-during-read')fs.appendFileSync(path.join(dir,'kernel-command.log'),'grew');
    else fs.truncateSync(path.join(dir,'kernel-command.log'),0);
   }
   return read.call(this,fd,...args);
  };
  try{assert.throws(()=>adapter.retrieve(dir),/evidence (grew|changed)/);assert(changed);}
  finally{fs.readSync=read;fs.openSync=open;}
  results.push({name:mode,expected:'INVALID'});
 }
 const emptyLog=path.join(base,'empty-command-log');fixture(emptyLog);
 fs.writeFileSync(path.join(emptyLog,'kernel-command.log'),'');
 const emptyReport=adapter.retrieve(emptyLog);
 assert.equal(emptyReport.commandLog.valid,false);assert.equal(emptyReport.commandLog.error,'empty evidence INVALID');
 assert.equal(emptyReport.commandLog.sha256,emptyReport.artifacts['kernel-command.log'].sha256);
 results.push({name:'empty-command-log',expected:'INVALID',report:emptyReport.commandLog});
 for(const mode of ['fifo','symlink','growth']){
  const dir=path.join(base,'initial-'+mode);fixture(dir);const f=path.join(dir,'kernel-command.log');
  if(mode==='growth')fs.truncateSync(f,64*1024*1024+1);
  else{fs.unlinkSync(f);if(mode==='fifo')cp.execFileSync('mkfifo',[f]);else fs.symlinkSync('publication-launch.json',f);}
  assert.throws(()=>adapter.retrieve(dir));fs.unlinkSync(f);results.push({name:'initial-'+mode,expected:'INVALID'});
 }
 const observer=path.join(invalid,'publication-syscalls.ndjson'),raw=fs.readFileSync(observer);
 for(const bytes of [Buffer.alloc(0),raw.subarray(0,raw.length-1),Buffer.from(raw.toString().replace('"observerSequence":1','"observerSequence":7'))]){fs.writeFileSync(observer,bytes);assert.throws(()=>adapter.retrieve(invalid));}
 fs.writeFileSync(observer,raw);
 const drain=path.join(invalid,'kernel-drain.json'),data=JSON.parse(fs.readFileSync(drain));data.journal.path='../custody.ndjson.gz';fs.writeFileSync(drain,JSON.stringify(data));assert.throws(()=>adapter.retrieve(invalid),/uncaptured custody/);
 fs.writeFileSync(path.join(base,'results.json'),JSON.stringify({passed:true,syntheticIntegrityControlsOnly:true,results},null,2));
 console.log('PASS executable actual CLI oldFAIL/newPASS replacement/growth/FIFO/symlink/expanded replacement; compressed+expanded caps, CRC/truncation/EMPTYINVALID and uncaptured-path refusals');
}
