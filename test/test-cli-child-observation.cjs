'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const {ChildObservation,identity,hash}=require('../lib/cli-child-observation');
function unit(out){
 fs.mkdirSync(out,{recursive:true});const exe=path.join(out,'input.exe');fs.writeFileSync(exe,'authored input');
 const params={moduleBytes:Buffer.from('authored module'),runner:__filename,executable:exe,guestExe:'c:\\parent.exe',port:43101};
 const binding={owner:'owner',epoch:1,identity:'binding'},actor={processId:1,threadId:2};let serial=0;
 const observer=()=>{const o=new ChildObservation(params);o.bind(binding);return o;};
 const command=()=>({...binding,nonce:'one-input',deadline:Date.now()+2900,releaseDeadline:Date.now()+1650,
  guestExe:'c:\\child.exe',executableSHA256:hash(fs.readFileSync(exe)),port:43102,directory:path.join(out,'arm-'+serial++)});
 const arm=(o,c=command())=>o.arm(c,{}, {physicalUp:true,capture:'0x0',focusWindow:actor});
 for(const [field,value]of [['owner','foreign'],['epoch',9],['identity','other'],['deadline',Date.now()-1],['releaseDeadline',Date.now()+2000],['guestExe','relative.exe'],['executableSHA256','bad'],['port',43101]]){
  const o=observer(),c=command();c[field]=value;assert.throws(()=>arm(o,c),/child observation:/,field);
  assert(!fs.existsSync(c.directory));
 }
 for(const [name,change]of [['foreign-exe',()=>['c:\\unrelated.exe',actor]],['wrong-actor',()=>['c:\\child.exe',{...actor,threadId:3}]],
  ['source-mismatch',()=>{fs.writeFileSync(exe,'different');return ['c:\\child.exe',actor];}],
  ['late',o=>{o.armRecord.deadline=Date.now()-1;return ['c:\\child.exe',actor];}]]){
  fs.writeFileSync(exe,'authored input');const o=observer(),a=arm(o);o.begin({...binding,nonce:a.nonce});
  const [guest,who]=change(o);assert.equal(o.prepare(guest,exe,who),null,name);assert(o.failed);
  assert(fs.existsSync(path.join(a.directory,'failure.json')));
  assert.equal(o.prepare('c:\\child.exe',exe,actor),null,'failure cannot reopen');
 }
 fs.writeFileSync(exe,'authored input');const o=observer(),a=arm(o);
 assert.throws(()=>o.begin({...binding,nonce:'other'}),/wrong transition nonce/);
 o.begin({...binding,nonce:a.nonce});assert.throws(()=>o.begin({...binding,nonce:a.nonce}),/repeated/);
 assert.throws(()=>arm(o),/one-shot/);
 const e=o.prepare('c:\\child.exe',exe,actor);assert(e);
 // A real OS child independently validates the parent/start token and its
 // actual loaded module/source bytes, rather than trusting a parent receipt.
 const childCode=`const {ChildObservation}=require('./lib/cli-child-observation');const p=JSON.parse(process.argv[1]);new ChildObservation({...p,moduleBytes:Buffer.from('authored module'),envelope:process.argv[2]});console.log('VALIDATED');`;
 const childParams={...params,guestExe:'c:\\child.exe',port:43102};delete childParams.moduleBytes;
 for(const [name,mutate,success]of [['valid',()=>{},true],['foreign-parent',x=>x.parent.pid++,false],['reused-parent',x=>x.parent.startToken='0',false],
  ['module',x=>x.inputs.moduleSHA256='0'.repeat(64),false],['source',x=>x.inputs.sourceSHA256='0'.repeat(64),false],
  ['exe',x=>x.executableSHA256='0'.repeat(64),false],['expired',x=>x.deadline=Date.now()-1,false]]){
  const envelope=structuredClone(e);envelope.deadline=Date.now()+2900;mutate(envelope);
  const p=cp.spawnSync(process.execPath,['-e',childCode,JSON.stringify(childParams),JSON.stringify(envelope)],{encoding:'utf8',timeout:4000});
  assert.equal(p.status===0,success,name+': '+p.stderr);assert(!p.signal);
 }
 // Concurrent terminal failure publication must preserve the first record and clean temporary files.
 const before=JSON.parse(fs.readFileSync(path.join(a.directory,'armed.json')));
 for(let i=0;i<2;i++)o.fail('concurrent shutdown '+i);
 assert.equal(JSON.parse(fs.readFileSync(path.join(a.directory,'failure.json'))).reason,'concurrent shutdown 0');
 assert(!fs.readdirSync(a.directory).some(n=>n.endsWith('.pending')));
 assert.equal(before.token,a.token);
 const concurrent=path.join(out,'concurrent');fs.mkdirSync(concurrent);
 const racers=String.raw`const cp=require('node:child_process');const code="const {ChildObservation,identity}=require('./lib/cli-child-observation');ChildObservation.prototype.fail.call({armRecord:JSON.parse(process.argv[1]),self:identity()},'parallel terminal failure')";Promise.all(Array.from({length:8},()=>new Promise((resolve,reject)=>{const c=cp.spawn(process.execPath,['-e',code,process.argv[1]],{stdio:'pipe'});let err='';c.stderr.on('data',b=>err+=b);c.on('close',n=>n?reject(Error(err)):resolve());}))).catch(e=>{console.error(e);process.exitCode=1;});`;
 const raced=cp.spawnSync(process.execPath,['-e',racers,JSON.stringify({...a,directory:concurrent})],{encoding:'utf8',timeout:10000});
 assert.equal(raced.status,0,raced.stderr);assert.equal(fs.readdirSync(concurrent).join(','),'failure.json');
 const transport=String.raw`import pathlib,json,sys,os,types,time,threading,http.server,socket
m=types.ModuleType('ctl');m.__file__=str(pathlib.Path('tools/neverhood-original-current-control.py').resolve());os.environ.update(NEVERHOOD_CURRENT_RUN=sys.argv[1],NEVERHOOD_CURRENT_PORT='1');exec(compile(sys.argv[2],m.__file__,'exec'),m.__dict__)
root=pathlib.Path(sys.argv[1]);root.mkdir()
for name,delay,budget in [('delayed-disconnect',.30,.70),('absolute-deadline',.70,.25)]:
 class Handler(http.server.BaseHTTPRequestHandler):
  def log_message(self,*args):pass
  def do_POST(self):
   self.rfile.read(int(self.headers['Content-Length']));time.sleep(delay);self.connection.shutdown(socket.SHUT_RDWR)
 server=http.server.HTTPServer(('127.0.0.1',0),Handler);thread=threading.Thread(target=server.serve_forever);thread.start()
 try:
  m.R=root/name;m.R.mkdir();m.PORT=server.server_port
  m.save('launch.json',dict(rootPort=m.PORT));stat=pathlib.Path('/proc/self/stat').read_text();m.save('native-pid.json',dict(pid=os.getpid(),startToken=stat[stat.rindex(')')+2:].split()[19]))
  start=time.time()
  try:m.release('release','owner',start,start+budget)
  except Exception:pass
  else:raise AssertionError('closed transport cannot acknowledge UP')
  elapsed=time.time()-start;record=m.read('release-up.json');assert not record['physicalUpACK']
  if name=='delayed-disconnect':assert .28<=elapsed<.70 and 'timed out' not in record['error'],(elapsed,record)
  else:assert .23<=elapsed<.45 and 'timed out' in record['error'],(elapsed,record)
  assert len((m.R/'requests.jsonl').read_text().splitlines())==1
  m.save('transport-proof.json',dict(elapsed=elapsed,budget=budget,physicalUpACK=False,noRetry=True))
 finally:server.shutdown();thread.join();server.server_close()
print('PASS actual TCP delayed disconnect exceeds old 200ms timeout; absolute UP deadline still closes; no synthetic ACK or retry')`;
 const tcp=cp.spawnSync('python3',['-B','-c',transport,path.join(out,'release-transport'),fs.readFileSync('tools/neverhood-original-current-control.py','utf8')],{encoding:'utf8',timeout:10000});
 assert.equal(tcp.status,0,tcp.stderr);console.log(tcp.stdout.trim());
 console.log('PASS one-shot provenance, actor/nonce/owner/source/foreign-child/late refusal; actual child validates module/source/executable/parent and reused PID');
}
function negative(run,out){
 const code=String.raw`import pathlib,json,sys,os,types,copy,time
os.environ.update(NEVERHOOD_CURRENT_RUN=sys.argv[1],NEVERHOOD_CURRENT_PORT='1')
m=types.ModuleType('ctl');m.__file__=str(pathlib.Path('tools/neverhood-original-current-control.py').resolve());exec(compile(sys.argv[3],m.__file__,'exec'),m.__dict__)
run=pathlib.Path(sys.argv[1]);out=pathlib.Path(sys.argv[2]);out.mkdir()
original=json.loads((run/'play-child-arm.json').read_text());source=pathlib.Path(original['directory'])
names=('armed','spawned','ready','parent-exit')
for mode in ('valid','foreign-token','unrelated-exe','source-mismatch','dead-pid','reused-pid','wrong-parent','parent-failure','child-failure','late-record','unknown'):
 d=out/mode;d.mkdir();arm=copy.deepcopy(original);arm['directory']=str(d);arm['deadline']=time.time()*1000+2900
 rows={n:json.loads((source/(n+'.json')).read_text()) for n in names};rows['armed']=arm
 if mode=='foreign-token':rows['ready']['token']='other'
 if mode=='unrelated-exe':rows['ready']['guestExe']='c:\\foreign.exe'
 if mode=='source-mismatch':rows['ready']['inputs']['sourceSHA256']='0'*64
 if mode in ('dead-pid','reused-pid'):
  for n in ('ready','spawned'):rows[n]['child']['pid' if mode=='dead-pid' else 'startToken']=2147483647 if mode=='dead-pid' else '0'
 if mode=='wrong-parent':rows['ready']['parent']['startToken']='0'
 if mode=='parent-failure':rows['parent-exit']['exitCode']=7
 if mode=='late-record':rows['ready']['at']=arm['deadline']+1
 for n,v in rows.items():(d/(n+'.json')).write_text(json.dumps(v))
 m.R=d
 if mode=='unknown':m.save('PERMANENT-UNKNOWN.json',{})
 if mode=='child-failure':(d/'child-wait.json').write_text('{}')
 attempts=[]
 old=m.call;m.call=lambda *a,**k:attempts.append(a) or (_ for _ in ()).throw(AssertionError('unexpected transport'))
 try:
  record=m.child_records(arm)
  assert mode=='valid',mode
 except (AssertionError,FileNotFoundError,ProcessLookupError):
  assert mode!='valid',mode
  m.fail(mode,'expected pretransport refusal')
  # Use the real guarded transport after UNKNOWN, including cleanup and a
  # would-be child request. None may even inspect process identity.
  m.call=old
  for cleanup in (False,True):
   try:m.call({'action':'snapshot'},cleanup=cleanup,target=rows['ready']['child'],port=arm['port'])
   except AssertionError as e:assert 'permanent UNKNOWN' in str(e)
   else:raise AssertionError('UNKNOWN allowed transport')
 finally:m.call=old
 assert not attempts and not (d/'requests.jsonl').exists()
print('PASS live child provenance; foreign/unrelated/source/dead/reused/parent-failure/child-failure/late/UNKNOWN all refuse before transport')`;
 const p=cp.spawnSync('python3',['-B','-c',code,run,out,fs.readFileSync('tools/neverhood-original-current-control.py','utf8')],{encoding:'utf8',timeout:15000});
 fs.writeFileSync(out+'-wait.json',JSON.stringify({exit:p.status,signal:p.signal,actualWait:true,stdoutEOF:true,stderrEOF:true,stdout:p.stdout,stderr:p.stderr})+'\n');
 assert.equal(p.status,0,p.stderr);console.log(p.stdout.trim());
}
module.exports={unit,negative};
if(require.main===module)unit(path.resolve(process.argv[2]||fs.mkdtempSync(path.join(os.tmpdir(),'wa-child-observe-'))));
