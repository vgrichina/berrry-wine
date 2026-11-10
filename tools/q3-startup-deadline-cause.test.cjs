'use strict';
// Retained native attribution plus real generated consumer under deliberately
// slow durable service. The peer is a Node process, never local Chrome.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const zlib=require('node:zlib'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),current=require('./q3-current-module.cjs');
const route=require('./q3-current-foreign-closure-v1.cjs');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const out=path.resolve(process.argv[2]||'');
assert(process.argv[2]&&out.startsWith(root+'/scratch/runs/')&&!fs.existsSync(out));
fs.mkdirSync(out,{recursive:true});
const save=(name,value)=>fs.writeFileSync(out+'/'+name,JSON.stringify(value,null,2),{flag:'wx'});

function retained(){
 const base=root+'/scratch/runs/20261110-q3-stable-owner-native-progress-0043';
 const inventory=JSON.parse(zlib.gunzipSync(fs.readFileSync(base+'/prepared/retrieval-before-stop.json.gz')));
 const evidence=[];
 const get=name=>{
  const r=inventory.records.find(r=>r.path.endsWith('/'+name));assert(r,name);
  const stored=fs.readFileSync(base+'/'+r.local),raw=r.outerGzip?zlib.gunzipSync(stored):stored;
  assert.equal(raw.length,r.size);assert.equal(hash(raw),r.sha256);
  evidence.push({name,retained:r.local,sha256:r.sha256,size:r.size});
  return name.endsWith('.gz')?zlib.gunzipSync(raw):raw;
 };
 const service=JSON.parse(get('q3-custody-service.json'));
 const journal=get('custody.ndjson.gz').toString().trim().split('\n').map(JSON.parse);
 const launch=get('checkpoint-launch.ndjson').toString().trim().split('\n').map(JSON.parse);
 const endpoint=JSON.parse(get('endpoint.json'));
 const cancel=JSON.parse(get('caller-cancelled.json'));
 const trace=get('await-trace.jsonl.gz').toString().trim().split('\n').map(JSON.parse);
 const wire=get('execution-boundary-transport.jsonl.gz').toString().trim().split('\n').map(JSON.parse);
 const drain=JSON.parse(get('kernel-drain.json'));
 assert.equal(service.writes,service.samples.length,'complete timing sample, no truncation');
 assert.equal(service.totalNs,service.samples.reduce((n,r)=>n+r.elapsedNs,0));
 assert(service.samples.every((r,i)=>!i||r.startNs>=service.samples[i-1].startNs+service.samples[i-1].elapsedNs));
 // Epoch/monotonic pairs are recorded on the same native host. Do not align
 // Python time with this test process, a page clock, or a different machine.
 const offset=launch[0].at-launch[0].monotonic;
 assert(launch.every(r=>Math.abs(r.at-r.monotonic-offset)<.001));
 const send=wire.filter(r=>r.phase==='pre-send');
 assert.deepEqual(send.map(r=>r.requestId),[1,2,3,4,5,6,7,8,9,10]);
 const req6=trace.find(r=>r.event==='entry'&&r.requestId===6);
 const ack6=trace.find(r=>r.event==='exit'&&r.id===req6.id);
 const nav=trace.find(r=>r.event==='entry'&&r.requestId===10);
 const preCDP=trace.find(r=>r.event==='entry'&&r.requestId===1);
 const overlap=(a,b)=>service.samples.reduce((n,r)=>n+Math.max(0,Math.min(b,(r.startNs+r.elapsedNs)/1e9)-Math.max(a,r.startNs/1e9)),0);
 const window=(name,a,b)=>({name,elapsedSeconds:b-a,journalServiceSeconds:overlap(a,b),
  journalWrites:service.samples.filter(r=>r.startNs/1e9>=a&&r.startNs/1e9<b).length});
 const before=window('first CDP through navigation',Number(send[0].monotonicNs)/1e9,Number(send.at(-1).monotonicNs)/1e9);
 const attach=window('await page-session Target.setAutoAttach',req6.epochMs/1000-offset,ack6.epochMs/1000-offset);
 const navigating=window('navigate send through owning cancellation',Number(send.at(-1).monotonicNs)/1e9,cancel.at-offset);
 // The remote observer's exact monotonic start was not retained. Its command
 // publication is a lower bound, not its actual deadline origin.
 const command=JSON.parse(zlib.gunzipSync(fs.readFileSync(base+'/prepared/original-image-startup-command.json.gz')));
 const observation=window('image command publication through cancellation (bounded)',command.at-offset,cancel.at-offset);
 assert.equal(ack6.elapsedMs,10198);assert.equal(endpoint.elapsedMs,23849);
 assert(attach.journalServiceSeconds/attach.elapsedSeconds>.98);
 assert(observation.journalServiceSeconds/observation.elapsedSeconds>.97);
 assert(navigating.elapsedSeconds<10.1&&navigating.elapsedSeconds>9.9);
 assert(!send.some(r=>r.method.startsWith('Input.')||r.method==='Page.captureScreenshot'));
 assert(drain.deadline-cancel.at>400&&drain.complete&&!drain.unreaped.length);
 // Bind measured service to source: writes synchronously flush and fsync;
 // the Q3 adapter flushes the full prefix at actual executable CONT barriers.
 const provider=fs.readFileSync(root+'/tools/native_kernel_custody.py','utf8');
 const adapter=fs.readFileSync(root+'/tools/q3-startup-custody.py','utf8');
 assert(provider.includes('self.raw.flush(); os.fsync(self.raw.fileno())'));
 assert(adapter.includes('if request == CONT: journal.flush_pending()'));
 assert(journal.some(r=>r.kind==='ptrace-cont-returned'&&r.at>req6.epochMs/1000&&r.at<ack6.epochMs/1000));
 save('retained-attribution.json',{passed:true,evidence,clockOffsetSeconds:offset,
  totalJournalServiceSeconds:service.totalNs/1e9,maxJournalWriteSeconds:service.maxNs/1e9,
  devtoolsReadyMs:endpoint.elapsedMs,firstCDPAt:preCDP.at,navigateAt:nav.at,
  cancellationAt:cancel.at,runtimeSecondsRemaining:drain.deadline-cancel.at,
  windows:[before,attach,navigating,observation],nativeInputs:0,images:0,
  exactImageObserverStart:'not retained; command publication is a bound',
  attribution:'Synchronous durable custody service overlaps startup; fsync-only time and Chromium internal dependency are not separately measured.',
  source:{provider:hash(Buffer.from(provider)),adapter:hash(Buffer.from(adapter))}});
}
retained();

const script=String.raw`
import sys,os,time,runpy,json,gzip
from pathlib import Path
from unittest.mock import patch
root=Path(sys.argv[1]);out=Path(sys.argv[2]);delay=float(sys.argv[3])
sys.path.insert(0,str(root/'tools'))
adapter=runpy.run_path(str(root/'tools/q3-startup-custody.py'))
sync=os.fsync;calls=[]
def slow(fd):
 calls.append(time.monotonic_ns());time.sleep(delay);return sync(fd)
begin=time.monotonic()
try:
 with patch.object(os,'fsync',side_effect=slow):
  adapter['supervise'](out/'custody',['node','--require',str(root/'tools/q3-page-session-startup.test.cjs'),str(out/'prepared/q3-runtime-caller.cjs')],deadline=time.time()+45,cleanup_deadline=time.time()+55,journal_compression='gzip')
except AssertionError as error:
 assert error.args==(1,),error
else:raise AssertionError('peer terminal refusal lost')
drain=json.loads((out/'custody/kernel-drain.json').read_bytes())
assert drain['complete'] and not drain['unreaped'] and not drain['remaining']
peer=json.loads(gzip.decompress((out/'peer.json.gz').read_bytes()))
methods=[q['method'] for q in peer['protocol']]
assert not any(m.startswith('Input.') or m in ['Page.captureScreenshot','Browser.close','Page.navigate'] for m in methods),methods
assert methods.count('Target.setAutoAttach')==2
wait=json.loads(gzip.decompress((out/'browser-wait.json.gz').read_bytes()))
assert wait['stdoutEOF'] and wait['stderrEOF'],wait
# The existing peer's independent 35s cap precedes the 20s timeout plus
# unchanged 20s close grace in the withheld case. That real exit is expected;
# it must not replace the already recorded request-6 timeout as first cause.
if os.environ['Q3_PAGE_PEER_MODE']=='withheld-page-reply':
 assert wait['code']==9 and wait['signal'] is None,wait
else:assert wait['signal']=='SIGTERM',wait
timing=json.loads((out/'custody/q3-custody-service.json').read_bytes())
assert timing['totalNs']/1e9>=delay*(timing['writes']-1)*.95
(out/'controlled-service.json').write_text(json.dumps(dict(passed=True,delaySeconds=delay,fsyncCalls=len(calls),elapsedSeconds=time.monotonic()-begin,journalServiceSeconds=timing['totalNs']/1e9,methods=methods,actualWait=True,stdoutEOF=True,stderrEOF=True)))
`;
for(const [mode,delay] of [['single',0],['delayed-inbound',.02],['page-protocol-error',.02],['page-socket-close',.02],['send-throw',.02],['withheld-page-reply',.02]]){
 const dir=out+'/'+mode;fs.mkdirSync(dir);
 cp.execFileSync('python3',['-B',root+'/tools/q3-native-phase-inputs.py',dir]);
 const names=['control.py','physical_gate.py','cancellation_gate.py','phase-input.py'];
 const seal=current.prepare(dir+'/prepared',{foreignClosureVersion:route.version,
  checkpointObserverVersion:current.checkpointObserverVersion,nativeLifecycleVersion:'q3-native-lifecycle-foreign-v1',
  inputs:names.map(n=>path.relative(root,dir+'/'+n)),caller:path.relative(root,dir+'/phase-input.py')});
 fs.mkdirSync(dir+'/cancellation/prepared',{recursive:true});
 const source=route.composition(route.version,dir+'/prepared').compose().source;
 assert(source.includes('},20000);'),'unchanged production CDP deadline');
 const env={...process.env,Q3_PAGE_PEER_CHILD:'1',Q3_PAGE_PEER_DIR:dir,Q3_PAGE_PEER_MODE:mode,
  Q3_NATIVE_PHASE:'cancellation',Q3_NATIVE_INPUT_CAUSE:'1',Q3_INPUT_WIRE:'1',
  Q3_EXECUTION_BOUNDARY_OUT:dir+'/boundary.jsonl.gz',BROWSER_DEADLINE:String(Date.now()+90000)};
 const r=cp.spawnSync('python3',['-B','-c',script,root,dir,String(delay)],{cwd:root,env,encoding:'utf8',timeout:65000,maxBuffer:1024*1024});
 save(mode+'-wait.json',{status:r.status,signal:r.signal,stdout:r.stdout,stderr:r.stderr,
  actualWait:true,stdoutEOF:true,stderrEOF:true,manifestSHA256:seal.manifestSHA256,
  generatedConsumerSHA256:hash(Buffer.from(source)),generatedConsumerBytes:Buffer.byteLength(source),sourceCopied:false});
 assert.equal(r.status,0,r.stderr+'\n'+r.stdout);
 const peer=JSON.parse(zlib.gunzipSync(fs.readFileSync(dir+'/peer.json.gz')));
 if(mode==='withheld-page-reply')assert.match(peer.firstFailure.error,/CDP UNKNOWN Target.setAutoAttach/);
 else if(mode==='page-protocol-error')assert.match(peer.firstFailure.error,/OFFLINE_PAGE_REFUSAL/);
 else if(mode==='page-socket-close')assert.match(peer.firstFailure.error,/CDP close/);
 else if(mode==='send-throw')assert.match(peer.firstFailure.error,/OFFLINE_SEND_THROW/);
 else assert.match(peer.firstFailure.error,/OFFLINE_STOP_BEFORE_NAVIGATION/);
 console.log('PASS actual generated '+mode);
}
save('result.json',{passed:true,retainedAttribution:true,generatedConsumerCases:6,
 noLocalChrome:true,noBoxAllocated:true,deadlinesUnchanged:true,nativeReadiness:'UNKNOWN'});
