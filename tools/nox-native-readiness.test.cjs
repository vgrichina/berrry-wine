'use strict';
// Real generated Nox consumer + real fork/exec/waits under slow durable storage.
// The browser boundary is a Node peer; no Chrome, compositor or guest claim.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const assert=require('node:assert/strict'),current=require('./nox-current-driver.cjs');
const root=current.ROOT,out=path.resolve(process.argv[3]||'');
assert(process.argv[2]&&process.argv[3]&&out.startsWith(root+'/scratch/runs/')&&!fs.existsSync(out));
fs.mkdirSync(out,{recursive:true});
const generated=out+'/generated';current.generate(path.resolve(process.argv[2]),generated);
for(const name of ['tools/q3-startup-custody.py','tools/native_kernel_custody.py']){
 const check=String.raw`import runpy,sys
from pathlib import Path
read=Path.read_bytes
def corrupt(p):
 b=read(p)
 return b+b'WRONG' if str(p).endswith(sys.argv[2]) else b
Path.read_bytes=corrupt
try:runpy.run_path(sys.argv[1])
except AssertionError as error:assert str(error)==sys.argv[2]
else:raise AssertionError('changed service admitted')
`;
 const r=cp.spawnSync('python3',['-B','-c',check,generated+'/custody-run.py',name],{encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);
}
const script=String.raw`
import os,sys,time,runpy,json,gzip
from pathlib import Path
root,out,generated=map(Path,sys.argv[1:4]);before=sys.argv[4]=='before'
if before: kernel=runpy.run_path(str(root/'tools/nox-startup-custody.py'))['load']()
else: kernel=runpy.run_path(str(generated/'custody-run.py'))['adapter']['load']()
sync=kernel.os.fsync;calls=[]
def slow(fd):
 calls.append(time.monotonic_ns());time.sleep(.08);return sync(fd)
kernel.os.fsync=slow
start=time.time();deadline=start+60
try:
 kernel.supervise(out/'custody',['node',str(root/'tools/nox-current-driver.test.cjs')],deadline=deadline,cleanup_deadline=deadline+10,journal_compression='gzip',command_compression='gzip')
except AssertionError as error:
 assert error.args==(1,),error
finally:kernel.os.fsync=sync
drain=json.loads((out/'custody/kernel-drain.json').read_text())
assert drain['complete'] and not drain['unreaped'] and not drain['remaining'],drain
assert drain['deadline']==deadline and drain['cleanupDeadline']==deadline+10
assert drain['commandLog']['closed'] and drain['commandLog']['eof']
rows=[json.loads(s) for s in gzip.open(out/'custody/custody.ndjson.gz','rt')]
assert rows and [r['sequence'] for r in rows]==list(range(1,len(rows)+1))
(out/'service.json').write_text(json.dumps(dict(seconds=time.time()-start,fsyncCalls=len(calls),owned=len(drain['owned']),reaped=len(drain['reaped']),complete=True,immutableDeadline=deadline)))
`;
const results=[];
for(const [label,mode] of [['before','delayed-port'],['after','delayed-port'],['missing','missing-port'],['refusal','malformed-port']]){
 const dir=out+'/'+label;fs.mkdirSync(dir);
 const r=cp.spawnSync('python3',['-B','-c',script,root,dir,generated,label],{cwd:root,
  env:{...process.env,NOX_TEST_CHILD:'1',NOX_TEST_MODE:mode,NOX_TEST_DIR:dir,NOX_TEST_GENERATED:generated},
  encoding:'utf8',timeout:75000,maxBuffer:1024*1024});
 fs.writeFileSync(dir+'/stdout',r.stdout||'');fs.writeFileSync(dir+'/stderr',r.stderr||'');
 assert.equal(r.status,0,r.stderr+'\n'+r.stdout);
 const runtime=generated+'/'+(mode==='delayed-port'?'production-preflight':'original');
 fs.renameSync(runtime,dir+'/runtime');
 const peer=JSON.parse(fs.readFileSync(dir+'/peer.json')),wait=JSON.parse(fs.readFileSync(dir+'/child-wait.json'));
 const timing=JSON.parse(fs.readFileSync(dir+'/runtime/native-startup-timing.json'));
 assert(peer.compiled&&!peer.chromeStarted);assert(wait.stdoutEOF&&wait.stderrEOF);
 const service=JSON.parse(fs.readFileSync(dir+'/service.json'));
 if(label==='after'){
  assert.equal(peer.code,0);assert.equal(wait.code,0);assert(timing.portRead&&timing.polls<100);
  assert(timing.polls>=4,'actual delayed readiness, no immediate port shortcut');
  assert(!fs.existsSync(dir+'/runtime/native-startup-failure.json'));
 }else{
  assert.equal(peer.code,1);assert.equal(peer.protocol.length,0,'first readiness failure admits no CDP');
  const failure=JSON.parse(fs.readFileSync(dir+'/runtime/native-startup-failure.json'));
  assert.equal(failure.pollLimit,100);assert.equal(failure.pollIntervalMs,100);
  if(label!=='refusal'){assert.equal(failure.polls,100);assert.equal(failure.error.code,'ENOENT');}
  else {assert(failure.portFile.readCompleted);assert.equal(failure.error.name,'TypeError');}
  assert.equal(wait.signal,'SIGTERM');assert.equal(peer.protocol.length,peer.failurePublishedIndex);
 }
 assert(!fs.existsSync(dir+'/runtime/chrome-profile'));
 results.push({label,mode,polls:timing.polls,portRead:timing.portRead,...service});
 console.log('PASS '+label+' '+JSON.stringify(results.at(-1)));
}
assert(results[1].fsyncCalls<results[0].fsyncCalls,'shared durable service reduces actual fsync count');
fs.writeFileSync(out+'/results.json',JSON.stringify({passed:true,actualGeneratedConsumer:true,realPtrace:true,noLocalChrome:true,deadlinesUnchanged:true,results},null,2));
