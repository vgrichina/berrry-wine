'use strict';
// Actual sealed consumer, real Node/ptrace tasks, real waits and independent EOF.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const assert=require('node:assert/strict'),zlib=require('node:zlib'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),current=require('./q3-current-module.cjs');
const route=require('./q3-current-foreign-closure-v1.cjs');
const out=path.resolve(process.argv[2]||'');
assert(process.argv[2]&&out.startsWith(root+'/scratch/runs/')&&!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const save=(n,v)=>fs.writeFileSync(out+'/'+n,JSON.stringify(v,null,2));
const script=String.raw`
import sys,os,time,runpy,json,gzip,subprocess,ctypes,signal
from pathlib import Path
from unittest.mock import patch
root=Path(sys.argv[1]);out=Path(sys.argv[2]);before=sys.argv[3]=='before'
helpers=runpy.run_path(str(root/'tools/q3-durable-release-service.test.py'))
kernel=helpers['module'](before)
if os.environ.get('Q3_STORAGE_CHILD')=='1':
 write=kernel.Journal.write;trace=kernel.ptrace;failed=[];later=[]
 def bad(journal,data):
  if (out/'stand-in-pid').exists() and journal.path.name=='custody.ndjson.gz':
   failed.append(time.monotonic_ns());journal.error='OFFLINE_REQUIRED_STORAGE_FAILURE'
   raise OSError(journal.error)
  return write(journal,data)
 def resumed(request,pid,addr=0,data=0):
  if request==kernel.CONT and failed:later.append(dict(pid=pid,data=data))
  return trace(request,pid,addr,data)
 try:
  with patch.object(kernel.Journal,'write',bad),patch.object(kernel,'ptrace',resumed):
   due=time.time()+45
   kernel.supervise(out/'custody',['node','--require',str(root/'tools/q3-page-session-startup.test.cjs'),str(out/'prepared/q3-runtime-caller.cjs')],deadline=due,cleanup_deadline=due+10,journal_compression='gzip',command_compression='gzip')
 except OSError as error:
  assert failed and 'journal' in str(error)
  assert not later,later
  (out/'storage-child.json').write_text(json.dumps(dict(failed=failed,laterCONT=later,error=str(error))))
 else:raise AssertionError('storage failure accepted')
 raise SystemExit(0)
if os.environ['Q3_PAGE_PEER_MODE']=='storage-failure':
 assert kernel.libc.prctl(36,1,0,0,0)==0
 env=dict(os.environ,Q3_STORAGE_CHILD='1',Q3_PAGE_PEER_MODE='single')
 child=subprocess.Popen([sys.executable,'-B','-c',sys.argv[4],*sys.argv[1:4]],env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 stdout,stderr=child.communicate(timeout=60)
 assert child.returncode==0,(child.returncode,stdout,stderr)
 receipts=[];due=time.monotonic()+5
 while True:
  try:peek=os.waitid(os.P_ALL,0,os.WEXITED|os.WNOHANG|os.WNOWAIT)
  except ChildProcessError:break
  assert time.monotonic()<due,'storage failure did not drain'
  if peek is None:time.sleep(.001);continue
  identity=kernel.identity(peek.si_pid)
  pid,status=os.waitpid(peek.si_pid,0)
  assert pid==peek.si_pid and os.WIFSIGNALED(status) and os.WTERMSIG(status)==signal.SIGKILL
  receipts.append(dict(identity=identity,status=status))
 assert receipts
 drain=json.loads((out/'custody/kernel-drain.json').read_bytes())
 assert not drain['complete'] and drain['journal']['error'] and 'OFFLINE_REQUIRED_STORAGE_FAILURE' in drain['failure']
 (out/'controlled-service.json').write_text(json.dumps(dict(passed=True,storageFailure=True,supervisorActualWait=True,
  supervisorStatus=child.returncode,stdoutEOF=True,stderrEOF=True,adoptedActualWaits=receipts,
  noLaterCONT=True,storageNeverAccepted=True)))
 raise SystemExit(0)
directory=out/'custody';directory.mkdir()
sync=os.fsync;calls=[]
def slow(fd):calls.append(time.monotonic_ns());time.sleep(.04);return sync(fd)
begin=time.monotonic();begin_epoch=time.time();due=begin_epoch+45
with patch.object(os,'fsync',side_effect=slow):
 rows,releases,patches=helpers['probe'](kernel,directory)
 try:
  with patches[0],patches[1],patches[2]:
   kernel.supervise(directory,['node','--require',str(root/'tools/q3-page-session-startup.test.cjs'),str(out/'prepared/q3-runtime-caller.cjs')],deadline=due,cleanup_deadline=due+10,journal_compression='gzip',command_compression='gzip')
 except AssertionError as error:assert error.args==(1,),error
 else:raise AssertionError('peer terminal refusal lost')
elapsed=time.monotonic()-begin
assert [json.loads(s) for s in gzip.open(directory/'custody.ndjson.gz','rt')]==rows
drain=json.loads((directory/'kernel-drain.json').read_bytes())
assert drain['complete'] and not drain['unreaped'] and not drain['remaining']
assert drain['commandLog']['closed'] and drain['commandLog']['eof']
assert drain['deadline']==due and drain['cleanupDeadline']==due+10
peer=json.loads(gzip.decompress((out/'peer.json.gz').read_bytes()))
from datetime import datetime
startup_seconds=datetime.fromisoformat(peer['firstFailure']['at'].replace('Z','+00:00')).timestamp()-begin_epoch
methods=[q['method'] for q in peer['protocol']]
assert not any(m.startswith('Input.') or m in ['Page.captureScreenshot','Browser.close','Page.navigate'] for m in methods),methods
assert methods.count('Target.setAutoAttach')==2
wait=json.loads(gzip.decompress((out/'browser-wait.json.gz').read_bytes()))
assert wait['stdoutEOF'] and wait['stderrEOF'],wait
if os.environ['Q3_PAGE_PEER_MODE']=='withheld-page-reply':assert wait['code']==9 and wait['signal'] is None,wait
else:assert wait['signal']=='SIGTERM',wait
(out/'controlled-service.json').write_text(json.dumps(dict(passed=True,fsyncCalls=len(calls),seconds=elapsed,startupSeconds=startup_seconds,
 releases=releases,methods=methods,actualOwned=len(drain['owned']),actualReaped=len(drain['reaped']),
 actualWait=True,stdoutEOF=True,stderrEOF=True,immutableDeadline=due)))
`;
const results=[];
const selected=process.argv.slice(3);
for(const [label,mode,before] of [['before','single',true],['after','single',false],
 ['delayed','delayed-inbound',false],['refusal','page-protocol-error',false],
 ['socket','page-socket-close',false],['send','send-throw',false],
 ['withheld','withheld-page-reply',false],['storage','storage-failure',false]]){
 if(selected.length&&!selected.includes(label))continue;
 const dir=out+'/'+label;fs.mkdirSync(dir);
 cp.execFileSync('python3',['-B',root+'/tools/q3-native-phase-inputs.py',dir]);
 const seal=current.prepare(dir+'/prepared',{foreignClosureVersion:route.version,
  checkpointObserverVersion:current.checkpointObserverVersion,nativeLifecycleVersion:'q3-native-lifecycle-foreign-v1',
  inputs:['control.py','physical_gate.py','cancellation_gate.py','phase-input.py'].map(n=>path.relative(root,dir+'/'+n)),
  caller:path.relative(root,dir+'/phase-input.py')});
 fs.mkdirSync(dir+'/cancellation/prepared',{recursive:true});
 const source=route.composition(route.version,dir+'/prepared').compose().source;
 assert(source.includes('},20000);'),'unchanged production CDP deadline');
 const env={...process.env,Q3_PAGE_PEER_CHILD:'1',Q3_PAGE_PEER_DIR:dir,Q3_PAGE_PEER_MODE:mode,
  Q3_NATIVE_PHASE:'cancellation',Q3_NATIVE_INPUT_CAUSE:'1',Q3_INPUT_WIRE:'1',
  Q3_EXECUTION_BOUNDARY_OUT:dir+'/boundary.jsonl.gz',BROWSER_DEADLINE:String(Date.now()+90000)};
 const r=cp.spawnSync('python3',['-B','-c',script,root,dir,before?'before':'after',script],
  {cwd:root,env,encoding:'utf8',timeout:65000,maxBuffer:1024*1024});
 save(label+'-wait.json',{status:r.status,signal:r.signal,stdout:r.stdout,stderr:r.stderr,
  actualWait:true,stdoutEOF:true,stderrEOF:true,manifestSHA256:seal.manifestSHA256,
  generatedConsumerSHA256:hash(Buffer.from(source)),generatedConsumerBytes:Buffer.byteLength(source),sourceCopied:false});
 assert.equal(r.status,0,r.stderr+'\n'+r.stdout);
 const result=JSON.parse(fs.readFileSync(dir+'/controlled-service.json'));results.push({label,...result});
 if(mode!=='storage-failure'){
  const peer=JSON.parse(zlib.gunzipSync(fs.readFileSync(dir+'/peer.json.gz')));
  const pattern=mode==='withheld-page-reply'?/CDP UNKNOWN Target.setAutoAttach/:
   mode==='page-protocol-error'?/OFFLINE_PAGE_REFUSAL/:mode==='page-socket-close'?/CDP close/:
   mode==='send-throw'?/OFFLINE_SEND_THROW/:/OFFLINE_STOP_BEFORE_NAVIGATION/;
  assert.match(peer.firstFailure.error,pattern);
 }
 console.log('PASS generated consumer '+label+' '+JSON.stringify({fsyncs:result.fsyncCalls,seconds:result.seconds}));
}
if(!selected.length||selected.includes('before')&&selected.includes('after')){
 assert(results[1].fsyncCalls<results[0].fsyncCalls*.9,JSON.stringify(results.slice(0,2)));
 assert(results[1].startupSeconds<results[0].startupSeconds*.9,JSON.stringify(results.slice(0,2)));
}
assert(results.length>0,'no selected cases');
save('result.json',{passed:true,cases:results,deadlinesUnchanged:true,noLocalChrome:true,nativeReadiness:'UNKNOWN'});
