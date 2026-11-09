'use strict';
// Offline dependency reproduction: actual composed driver + numbered Caller +
// close helper + unchanged ptrace supervisor. No Chrome, PE or guest executes.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const assert=require('node:assert/strict'),{once}=require('node:events'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),composition=require('./quake2-native-driver-composition.cjs');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const browserFixture=String.raw`
import sys,os,threading,signal,json,time
from pathlib import Path
profile=Path(sys.argv[1]);directory=Path(os.environ['Q2_FIXTURE_DIR'])
profile.mkdir(parents=True,exist_ok=True)
done=threading.Event()
threads=[threading.Thread(target=done.wait) for _ in range(110)]
for t in threads:t.start()
signal.signal(signal.SIGTERM,lambda *_:done.set())
(profile/'DevToolsActivePort').write_text('43123\n/devtools/browser/inert-threads\n')
print('inert threaded process ready',flush=True)
sys.stdin.readline()
(directory/'graceful-exit-start.json').write_text(json.dumps(dict(at=time.time(),pid=os.getpid(),threads=len(threads))))
done.set()
for t in threads:t.join()
print('all inert threads joined',flush=True)
`;

if(process.env.Q2_JOINED_PRELOAD==='1'){
  // Existing fixture retains the complete production command and close path.
  // Replace only its inert Node browser with inert Python native threads.
  const spawn=cp.spawn;
  cp.spawn=function(command,args,options){
    if(command===process.execPath&&args[1]==='node-browser')
      return spawn('python3',['-c',browserFixture,args[2]],options);
    return spawn(command,args,options);
  };
  process.env.Q2_NODE_FIXTURE='preload';process.env.Q2_CLOSE_MODE='normal';
  require('./quake2-native-driver-composition.test.cjs');
  const Socket=globalThis.WebSocket;
  globalThis.WebSocket=class extends Socket{
    send(text){super.send(text);const v=JSON.parse(text);
      if(v.method==='Browser.close')queueMicrotask(()=>this.onmessage?.({data:JSON.stringify({id:v.id,result:{}})}));
    }
  };
}

const supervisor=String.raw`
import sys,os,time,json
from pathlib import Path
root,directory,delay=sys.argv[1:];directory=Path(directory)
sys.path.insert(0,root+'/tools')
import native_kernel_custody as custody
# Model slow journal service, only after ordinary close starts.
# This is an explicit storage fault fixture, not a production-source change or
# a claim that the historical fsync syscall duration was measured.
original=custody.Journal.write
def delayed(self,data):
 if float(delay) and (directory/'close-at').exists():time.sleep(float(delay))
 return original(self,data)
custody.Journal.write=delayed
command=[os.environ['NODE_BINARY'],'--require',root+'/tools/quake2-joined-quit.test.cjs',root+'/'+os.environ['Q2_RETAINED']]
result=custody.supervise(directory/'custody',command,deadline=time.time()+80,cleanup_deadline=time.time()+100,journal_compression='gzip',command_compression='gzip')
(directory/'supervisor-result.json').write_text(json.dumps(result))
`;
const caller=String.raw`
import ast,hashlib,importlib.util,json,sys,threading
from pathlib import Path
root,directory,runtime=sys.argv[1:];root=Path(root);directory=Path(directory);runtime=Path(runtime)
spec=importlib.util.spec_from_file_location('client',root/'tools/quake2-native-launch-client.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
original=root/'scratch/runs/20261109-quake2-observed-guard-route-0105/control.py'
task=m.compose_task(original,hashlib.sha256(original.read_bytes()).hexdigest())
task['ROOT']=root;task['REMOTE']=str(root);task['RUN']=str(runtime.relative_to(root));task['R']=directory
def transport(code,timeout):
 if '--remote-parent' in code:return [sys.executable,'-c','import time;time.sleep(60)']
 tree=ast.parse(code);call=tree.body[1].value
 assert ast.unparse(call.func)=='subprocess.run'
 argv=ast.literal_eval(call.args[0]);assert argv[:2]==['node','-e']
 assert 'tools/quake2-native-transport.cjs' in argv[2]
 return argv
c=m.Caller(task,directory/'caller',transport);errors=[]
def launch():
 try:c.launch()
 except BaseException as e:errors.append(str(e))
thread=threading.Thread(target=launch);thread.start();assert c.session.started.wait(3)
try:
 try:
  result=c.request(dict(command=dict(id='joined_quit',action='quit')))
  outcome=dict(ok=True,result=result)
 except m.TerminalFailure as e:outcome=dict(ok=False,error=str(e))
finally:
 receipts=c.session.close();thread.join(5);assert not thread.is_alive()
 assert all(v['actualWait'] and v['stdoutEOF'] and v['stderrEOF'] for v in receipts)
 (directory/'caller-result.json').write_text(json.dumps(dict(outcome=outcome,receipts=receipts,launchErrors=errors)))
`;

async function capture(child,prefix){
  const output=[[],[]];child.stdout.on('data',b=>output[0].push(b));child.stderr.on('data',b=>output[1].push(b));
  const [code,signal]=await once(child,'close');
  for(const [i,name] of ['stdout','stderr'].entries())fs.writeFileSync(prefix+'.'+name+'.gz',zlib.gzipSync(Buffer.concat(output[i])));
  const result={pid:child.pid,code,signal,actualWait:true,stdoutEOF:child.stdout.readableEnded,stderrEOF:child.stderr.readableEnded};
  fs.writeFileSync(prefix+'.wait.json',JSON.stringify(result));return result;
}
async function until(fn,child){const due=Date.now()+60000;while(!fn()){assert(child.exitCode===null,'supervisor exited before ready');assert(Date.now()<due,'ready deadline');await pause(20);}}
async function scenario(run,name,delay){
  const disk=fs.statfsSync('/home');assert(disk.bavail*disk.bsize>1500000000,'free /home launch floor');
  const directory=path.join(run,name),runtime=path.join(directory,'runtime'),out=runtime+'/original';
  fs.mkdirSync(runtime,{recursive:true});
  const env={...process.env,Q2_JOINED_PRELOAD:'1',Q2_FIXTURE_DIR:directory,QUAKE2_NATIVE_RUN:runtime,
    BROWSER_DEADLINE:String(Date.now()+180000),NODE_BINARY:process.execPath,Q2_RETAINED:composition.consumerPath};
  const owner=cp.spawn('python3',['-c',supervisor,root,directory,String(delay)],{env,stdio:['ignore','pipe','pipe']});
  const joined=capture(owner,directory+'/supervisor');
  // Independent outer process deadline, armed before requests. Its target is
  // the existing supervisor; that owner retains the actual reap obligations.
  const watchdog=cp.spawn('python3',['-c',String.raw`
import os,sys,signal,time,json
from pathlib import Path
pid=int(sys.argv[1]);stop=Path(sys.argv[2]);due=time.monotonic()+110
while not stop.exists() and time.monotonic()<due:time.sleep(.05)
fired=not stop.exists()
if fired:
 try:os.kill(pid,signal.SIGTERM)
 except ProcessLookupError:pass
print(json.dumps(dict(fired=fired,pid=pid)))
`,String(owner.pid),directory+'/watchdog-stop'],{stdio:['ignore','pipe','pipe']});
  const watchdogJoined=capture(watchdog,directory+'/watchdog');
  try{
    await until(()=>fs.existsSync(out+'/ready.json'),owner);
    const client=cp.spawn('python3',['-c',caller,root,directory,runtime],{stdio:['ignore','pipe','pipe']});
    const clientWait=await capture(client,directory+'/client');assert.equal(clientWait.code,0);
    const ownerWait=await joined;assert.equal(ownerWait.code,delay===0?0:1);
    const read=n=>JSON.parse(fs.readFileSync(n));
    const result=read(directory+'/caller-result.json'),receipt=read(out+'/browser-terminal.json');
    const custody=read(directory+'/custody/kernel-drain.json');
    assert.equal(custody.complete,true);assert.equal(custody.commandLog.eof,true);
    assert.equal(result.outcome.ok,delay===0);
    assert.equal(receipt.normal,delay===0);assert.equal(receipt.drained,true);assert.equal(receipt.terminal.code,0);
    assert.equal(receipt.signals.length,delay===0?0:1);assert(receipt.capMs<20000);
    assert.equal(fs.existsSync(out+'/reply-0.json'),delay===0);
    assert.equal(fs.existsSync(out+'/cleanup.json'),delay===0);
    const protocol=fs.readFileSync(directory+'/protocol.jsonl','utf8').trim().split('\n').map(JSON.parse);
    const close=protocol.findIndex(v=>v.method==='Browser.close');assert(close>=0);
    assert.deepEqual(protocol.slice(close).map(v=>v.method),['Browser.close'],'no post-close guest CDP');
    const browserWait=read(directory+'/browser-wait.json');assert(browserWait.childClose&&browserWait.stdoutEOF&&browserWait.stderrEOF);
    const journal=zlib.gunzipSync(fs.readFileSync(directory+'/custody/custody.ndjson.gz')).toString().trim().split('\n').map(JSON.parse);
    const began=Number(fs.readFileSync(directory+'/close-at'))/1000;
    const pid=read(out+'/process.json').chromePid;
    const retirement=journal.filter(v=>v.at>=began&&v.kind==='reaped');
    const terminal=retirement.find(v=>v.pid===pid);assert(terminal&&terminal.status===0);
    assert(retirement.length>=110,'actual native thread terminal waits');
    const summary={name,delaySecondsPerJournalWrite:delay,receipt,caller:result.outcome,owned:custody.owned.length,reaped:custody.reaped.length,complete:custody.complete,retirementsAfterClose:retirement.length,mainTerminal:terminal,browserWait,ownerWait,clientWait};
    fs.writeFileSync(directory+'/result.json',JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
  }finally{
    if(owner.exitCode===null&&owner.signalCode===null)owner.kill('SIGTERM');
    await joined;fs.writeFileSync(directory+'/watchdog-stop','joined');
    assert.equal((await watchdogJoined).code,0);
    assert.equal(JSON.parse(zlib.gunzipSync(fs.readFileSync(directory+'/watchdog.stdout.gz'))).fired,false);
  }
}
async function main(){
  const run=path.resolve(process.argv[2]);fs.mkdirSync(run,{recursive:true});
  await scenario(run,'unpaced',0);await scenario(run,'paced-retirement',.05);
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
