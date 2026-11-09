from pathlib import Path
import sys,runpy,json,gzip,time,subprocess,threading,hashlib,os
C=runpy.run_path(str(Path(__file__).with_name('control.py')))
BASE=C['BASE'];ROOT=C['ROOT'];R=C['R'];REMOTE=C['REMOTE'];remote=C['remote'];save=C['save'];load=C['load'];c=C['c'];m=C['m'];H=C['H']
from physical_gate import physical_gate_code
from cancellation_gate import require_separate_waits
phase=sys.argv[2] if len(sys.argv)>2 else 'native'
phasebase=BASE/phase;phaseRun=str((phasebase/'prepared').relative_to(ROOT));out=REMOTE+'/scratch/runs/20261108-q3-gl-readiness-gameplay/changed-control-1475-'+phase

def launch():
 assert phase in ['cancellation','original'],'one changed fixture/cancel then one original only'
 assert not (R/'actual-first-terminal.json.gz').exists(),'task first failure is sticky'
 assert C['validate']()
 if phase=='original':
  assert load('boat-cancellation-proof')['passed'] and load('cancellation-drain')['passed']
  assert load('cancellation-commanded-physical-gate')['passed']
 save(phase+'-launch-claim',dict(at=time.time(),noRetry=True))
 task=m.compose_task(ROOT/'scratch/runs/20261109-q3-concurrent-owner-gameplay-0052/task.py',H((ROOT/'scratch/runs/20261109-q3-concurrent-owner-gameplay-0052/task.py').read_bytes()))
 c=task['c'];c.R=phasebase/'prepared';c.ROOT=ROOT;c.REMOTE=REMOTE;c.RUN=phaseRun;c.access.ROOT=R;c.box=C['box']
 c.R.mkdir(exist_ok=True);task.update(BASE=phasebase,R=c.R,REMOTE=REMOTE,OUT=out,save=lambda n,v: save(phase+'-'+n,v))
 def transport(code,timeout):
  if 'PRELAUNCH_ACTUAL_WAIT' in code:
   save(phase+'-generated-parent',dict(code=code,sha256=H(code.encode())))
   code="""from pathlib import Path
import subprocess,gzip,json,os
r=Path("""+repr(REMOTE+'/'+phaseRun)+""")
p=subprocess.Popen(['python3','-B','-c',"""+repr(code)+"""],cwd="""+repr(REMOTE)+""",stdout=subprocess.PIPE,stderr=subprocess.PIPE)
target=dict(pid=p.pid,start=Path('/proc',str(p.pid),'stat').read_text().rsplit(')',1)[1].split()[19])
import selectors
eof=[False,False]
with gzip.open(r/'generated-parent.stdout.log.gz','xb') as so,gzip.open(r/'generated-parent.stderr.log.gz','xb') as se,selectors.DefaultSelector() as poll:
 for i,s in enumerate((p.stdout,p.stderr)):poll.register(s,selectors.EVENT_READ,i)
 while poll.get_map():
  for key,_ in poll.select(.2):
   b=os.read(key.fileobj.fileno(),65536)
   if b:(so,se)[key.data].write(b)
   else:eof[key.data]=True;poll.unregister(key.fileobj)
status=p.wait()
with gzip.open(r/'generated-parent-actual-wait.json.gz','xb') as f:f.write(json.dumps(dict(**target,status=status,actualWait=True,stdoutEOF=eof[0],stderrEOF=eof[1])).encode())
print(json.dumps(dict(status=status,parentActualWait=True,stdoutEOF=eof[0],stderrEOF=eof[1])),flush=True)
raise SystemExit(status)
"""
  return ['boat','--no-update','--json','exec',C['box'](),'--timeout',str(timeout),'--','python3','-B','-c',code]
 helper=runpy.run_path(str(ROOT/'tools/q3-cancellation-stream-eof.py'))
 session=m.Session(phasebase/'actual-caller-session',transport);helper['bind_remote'](task,session)
 # The retained client writes child diagnostics once, from memory, at finish.
 # Compress exactly those logs on their first filesystem write.
 write=Path.write_bytes
 def compressed(p,data):
  if p.parent==session.evidence and p.suffix in ('.stdout','.stderr'):
   return write(p.with_name(p.name+'.gz'),gzip.compress(data,mtime=0))
  return write(p,data)
 Path.write_bytes=compressed
 def owned_launch():
  try: task['owned_launch'](['task.py','launch'])
  except BaseException as e:
   save(phase+'-local-terminal',dict(error=str(e),firstTerminal=session.terminal))
 launcher=threading.Thread(target=owned_launch);launcher.start()
 try:
  if phase=='native':
   code="from pathlib import Path\nimport time,json\no=Path("+repr(out)+");due=time.time()+60\nwhile not (o/'fixture-complete-awaiting-quit.json').exists():\n assert time.time()<due,'fixture completion not reached'\n assert not (o/'first-browser-failure.json').exists(),'first fixture failure terminal'\n time.sleep(.05)\nv={n:json.loads((o/n).read_bytes()) for n in ['local-controls.json','positive-control.json','reply-0.json','fixture-complete-awaiting-quit.json']}\nassert v['local-controls.json']['passed'] and v['positive-control.json']['passed'] and v['reply-0.json']['ok'] and v['reply-0.json']['id']=='positive-webgl'\nassert v['fixture-complete-awaiting-quit.json']['nextNumber']==1\nprint(json.dumps(v))"
   ready=json.loads(remote('native-whole-fixture-complete',code,70));save('native-whole-fixture-complete',ready)
   physical=json.loads(remote('native-commanded-physical-gate',physical_gate_code(out),45))
   save('native-commanded-physical-gate',physical)

   session.check();session.request_number=1 # ACK0 belongs to the verified whole fixture.
   command=dict(id='ordinary_fixture_quit',action='quit')
   ack=session.request(dict(command=command),lambda:task['owned_command'](['task.py','command',json.dumps(command),None]))
   save('native-ordinary-quit',dict(ack=ack,completed=session.completed,terminal=session.terminal))
   assert session.completed and session.terminal is None
  elif phase=='cancellation':
   code="from pathlib import Path\nimport time,json\no=Path("+repr(out)+");due=time.time()+60\nwhile not (o/'cancellation-ready.json').exists():\n assert time.time()<due,'cancellation checkpoint not reached'\n assert not (o/'first-browser-failure.json').exists(),'first fixture failure terminal'\n time.sleep(.02)\nprint((o/'cancellation-ready.json').read_text())"
   ready=json.loads(remote('cancellation-native-checkpoint',code,70));save('cancellation-native-checkpoint',ready)
   save('cancellation-commanded-physical-gate',json.loads(remote('cancellation-commanded-physical-gate',physical_gate_code(out),45)))
   session.check();save('cancellation-planned',dict(at=time.time(),expected=True,reason='actual owning caller cancellation while native fixture remains alive'))
   session.fail('planned native cancellation prerequisite; no later input/capture in this session')
  else:
   # The controlling parent retains this pipe throughout original gameplay.
   # Each request uses the released caller's unchanged request/ACK contract.
   while not session.completed:
    session.check()
    import select
    if not select.select([sys.stdin],[],[],.05)[0]:continue
    line=sys.stdin.readline()
    if not line:raise session.fail('original controller stdin EOF')
    value=json.loads(line);command=value['command']
    answer=session.request(value,lambda:task['owned_command'](['task.py','command',json.dumps(command),value.get('review')]))
    print(json.dumps(dict(commandComplete=True,id=command['id'],answer=answer)),flush=True)
 except BaseException as e:
  if not (R/'actual-first-terminal.json.gz').exists():save('actual-first-terminal',dict(at=time.time(),phase=phase,error=str(e),noLaterGuestInputCaptureRetry=True))
  save(phase+'-controller-error',dict(error=str(e),firstTerminal=session.terminal));session.fail(str(e))
 finally:
  session.close();launcher.join(4);Path.write_bytes=write
  save(phase+'-local-joined',dict(receipts=session.receipts,terminal=session.terminal,completed=session.completed,launcherJoined=not launcher.is_alive()))
  assert not launcher.is_alive(),'owning launch did not join'

 # No guest work after the launch exits. Read-only join/receipt inspection is
 # separate from the sticky input session and never creates a successful ACK.
 code="""from pathlib import Path
import json,gzip,time
r=Path("""+repr(REMOTE+'/'+phaseRun)+""");o=Path("""+repr(out)+""");due=time.time()+45
while not (r/'generated-parent-actual-wait.json.gz').exists():
 assert time.time()<due,'generated parent wait missing'
 time.sleep(.05)
def read(p):return json.loads(gzip.decompress(p.read_bytes()) if p.suffix=='.gz' else p.read_bytes())
names=['generated-parent-actual-wait.json.gz','prelaunch-child-actual-wait.json.gz','runtime-parent-actual-wait.json.gz','kernel-drain.json']
v={n:read(r/n) for n in names if (r/n).exists()}
for n in ['startup-admission.json','startup-refusal.json','local-controls.json','positive-control.json','terminal-browser.json','close-error.json','first-transport-failure.json','command-complete.json']:
 if (o/n).exists():v[n]=read(o/n)
print(json.dumps(v))
"""
 proof=json.loads(remote(phase+'-independent-join',code,60));save(phase+'-proof',proof)
 print(json.dumps(proof),flush=True)

def drain():
 script=(ROOT/'scratch/runs/20261108-q3-corrected-prelaunch-gameplay-2337/drain.py').read_text()
 script=script.replace('/home/user/q3-corrected-prelaunch-gameplay-2337-runtime',REMOTE).replace('scratch/runs/20261108-q3-corrected-prelaunch-gameplay-2337/prepared',phaseRun).replace('corrected-prelaunch-2337','changed-control-1475-'+phase)
 # Missing endpoint is a separate unknown; actual process waits above remain
 # mandatory. Resolve a published profile endpoint read-only if available.
 script=script.replace("process=read(out/'process.json');ports=[process['port'],read(out/'endpoint.json')['debugPort']]","process=read(out/'process.json');ports=[process['port']]\nif (out/'endpoint.json').exists():ports.append(read(out/'endpoint.json')['debugPort'])\nelif (Path(process['profile'])/'DevToolsActivePort').exists():ports.append(int((Path(process['profile'])/'DevToolsActivePort').read_text().splitlines()[0]))")
 script=script.replace("else read(out/'close-error.json')","else (read(out/'close-error.json') if (out/'close-error.json').exists() else {'normalBrowserClose':'UNKNOWN; owning native process terminated; kernel actual reap is separate'})")
 save(phase+'-drain',json.loads(remote(phase+'-drain',script,60)))

def cancellation_proof():
 assert phase=='cancellation'
 local=load('cancellation-local-joined');planned=load('cancellation-planned')
 assert local['launcherJoined'] and local['terminal'] and local['terminal']['at']>=planned['at']
 require_separate_waits({str(i):v for i,v in enumerate(local['receipts'])})
 code="""from pathlib import Path
import json,gzip
r=Path("""+repr(REMOTE+'/'+phaseRun)+""");o=Path("""+repr(out)+""")
def read(p):return json.loads(gzip.decompress(p.read_bytes()) if p.suffix=='.gz' else p.read_bytes())
ready=read(o/'cancellation-ready.json');cancel=read(r/'caller-cancelled.json');sent=read(r/'caller-cancel-sent.json')
assert cancel['at']>=__import__('datetime').datetime.fromisoformat(ready['at'].replace('Z','+00:00')).timestamp()
k=read(r/'kernel-drain.json');assert k['complete'] and k['commandLog']['eof'] and not k['unreaped']
waits={n:read(r/n) for n in ['generated-parent-actual-wait.json.gz','prelaunch-child-actual-wait.json.gz','runtime-parent-actual-wait.json.gz']}
for v in waits.values():assert v['actualWait'] and v.get('stdoutEOF') and v.get('stderrEOF'), 'combined EOF does not satisfy cancellation prerequisite'
assert read(o/'local-controls.json')['passed']
assert read(o/'reply-0.json')['id']=='positive-webgl'
assert not (o/'commands/1.json').exists() and not (o/'reply-1.json').exists()
assert sorted(p.name for p in o.glob('*.png'))==['fixture-startup.png','positive.png'],'no later capture during cancellation'
print(json.dumps(dict(passed=True,ready=ready,cancel=cancel,sent=sent,waits=waits,owned=len(k['owned']),reaped=len(k['reaped']),commandEOF=k['commandLog']['eof'],noLaterInputCaptureACK=True,nativeLifetime='REVOKED',allwriters='UNKNOWN',edictABA='UNKNOWN')))
"""
 proof=json.loads(remote('boat-cancellation-proof',code,45));save('boat-cancellation-proof',dict(**proof,local=local,planned=planned));print(json.dumps(proof),flush=True)

def recover():
 code="""from pathlib import Path
import json,gzip,hashlib,os
root=Path("""+repr(REMOTE)+""");rows=[]
pins=json.loads(gzip.decompress((root/"""+repr(str(BASE.relative_to(ROOT))+'/runtime-pins.json.gz')+""").read_bytes()))
known={v['sha256'] for v in pins['files']}
for base in [root/"""+repr(phaseRun)+""",Path("""+repr(out)+""")]:
 for p in sorted(base.rglob('*')):
  if p.is_symlink() or not p.is_file():continue
  b=p.read_bytes();logical=str(p.relative_to(root));originalHash=hashlib.sha256(b).hexdigest()
  if 'retired-chrome-profile' in p.parts or 'chrome-profile' in p.parts:
   rows.append(dict(path=logical,storedSize=len(b),storedSha256=originalHash,originalSize=len(b),originalSha256=originalHash,gzip=False,nonEvidenceBrowserCache=True));continue
  if originalHash in known:
   rows.append(dict(path=logical,storedSize=len(b),storedSha256=originalHash,originalSize=len(b),originalSha256=originalHash,gzip=False,pinnedProvider=True));continue
  invalidGzip=p.suffix=='.gz' and not b.startswith(b'\\x1f\\x8b')
  try:raw=gzip.decompress(b) if b.startswith(b'\\x1f\\x8b') else b
  except (EOFError,gzip.BadGzipFile):invalidGzip=True;raw=b
  if invalidGzip:
   q=p.with_name(p.name+'.invalid-preserved.gz');assert not q.exists();q.write_bytes(gzip.compress(b,mtime=0));assert gzip.decompress(q.read_bytes())==b;p=q;b=q.read_bytes()
  if not b.startswith(b'\\x1f\\x8b'):
   q=p.with_name(p.name+'.retrieved.gz');assert not q.exists();q.write_bytes(gzip.compress(b,mtime=0))
   assert gzip.decompress(q.read_bytes())==b
   p.unlink();p=q;b=q.read_bytes()
  rows.append(dict(path=str(p.relative_to(root)),logicalPath=logical,storedSize=len(b),storedSha256=hashlib.sha256(b).hexdigest(),originalSize=len(raw),originalSha256=hashlib.sha256(raw).hexdigest(),gzip=True,compressedBeforeTransfer=True,sourceGzipInvalid=invalidGzip))
print(json.dumps(dict(files=rows)))
"""
 inventory=json.loads(remote(phase+'-inventory-final',code,60));save(phase+'-inventory-final',inventory)
 from concurrent.futures import ThreadPoolExecutor
 dest=phasebase/'recovered';dest.mkdir(exist_ok=True)
 pins=json.loads(gzip.decompress((BASE/'runtime-pins.json.gz').read_bytes()));known={p['sha256'] for p in pins['files']}
 unique={r['storedSha256']:r for r in inventory['files'] if r['storedSha256'] not in known and not r.get('nonEvidenceBrowserCache')}
 def get(r):
  b=c.download(REMOTE+'/'+r['path']);assert len(b)==r['storedSize'] and H(b)==r['storedSha256']
  raw=gzip.decompress(b) if r['gzip'] else b;assert len(raw)==r['originalSize'] and H(raw)==r['originalSha256']
  target=dest/(r['storedSha256']+'.gz');target.write_bytes(b if r['gzip'] else gzip.compress(b,mtime=0));return dict(**r,local=str(target.relative_to(BASE)))
 with ThreadPoolExecutor(max_workers=6) as pool:records=list(pool.map(get,unique.values()))
 for r in records:
  b=(BASE/r['local']).read_bytes();raw=gzip.decompress(b);assert len(raw)==r['originalSize'] and H(raw)==r['originalSha256']
  if r['gzip']:assert len(b)==r['storedSize'] and H(b)==r['storedSha256']
 save(phase+'-retrieval',dict(passed=True,independentReread=True,allRegular=len(inventory['files']),records=records,excludedBrowserCache=[r for r in inventory['files'] if r.get('nonEvidenceBrowserCache')],scope='unique logs/captures only; pinned providers referenced; discarded browser cache inventoried without copies'))
 print('VERIFIED',phase,len(records),'unique artifacts',flush=True)

def stop():
 # Unique evidence is verified before delegated normal shutdown. A failed
 # kernel-completeness/drain assertion stays a failure; it cannot turn owned
 # runtime shutdown into an unbounded billing hold.
 attempted=[x for x in ['cancellation','original'] if (R/(x+'-launch-claim.json.gz')).exists()]
 assert attempted
 for extra in attempted:assert load(extra+'-retrieval')['passed']
 save('normal-stop-result',c.access.api('POST','sandboxes/'+C['box']()+'/stop',{}))
 due=time.time()+60
 while time.time()<due:
  v=c.access.sanitized(c.access.api('GET','sandboxes/'+C['box']()));save('stop-observation-'+str(time.time_ns()),v)
  if v['state'].lower()=='archived':
   assert v['id']==C['box']() and load('identity')['uuid'] in v['name']
   assert v['stop']['status']=='completed' and not v['stop']['forced'] and v['stop']['error'] is None
   save('normal-stop-confirmed',dict(at=time.time(),box=v));print(json.dumps(v),flush=True);return
  time.sleep(1)
 raise RuntimeError('archive not confirmed')

if __name__=='__main__':
 {'launch':launch,'drain':drain,'cancellation-proof':cancellation_proof,'recover':recover,'stop':stop}[sys.argv[1]]()
