import pathlib,subprocess,json,time,os,select,hashlib
R=pathlib.Path(__file__).resolve().parent.parent
NODE='/home/user/.nvm/versions/node/v24.18.1/bin/node'
OUT=R/'test-output';OUT.mkdir(exist_ok=True)
E=R/'docs/reviews/civ2-atomic-controller-ownership-repair-oct26/process-checkpoint.json'
results=[]
def wait_for(fn):
 end=time.monotonic()+3
 while not fn():
  if time.monotonic()>end:raise AssertionError('offline fixture handshake timeout')
  time.sleep(.002)
def config(d,session):
 return dict(outputDir=str(d),referenceDir=str(d),sessionId=session,plan=dict(allocationId='offline-process-race',totalCaptures=22,perImageBytes=128,retainedBytes=2816,totalCaptureBytes=2816,width=2,height=2,setupMs=2000,acceptanceMs=2000,cleanupMs=2000,totalMs=6000,cutoff=int(time.time()*1000)+7000,ackTimeoutMs=100))
def start(d,mode,n):
 f=d/('cfg'+n+'.json');f.write_text(json.dumps(config(d,'owner'+n)))
 return subprocess.Popen([NODE,'--max-old-space-size=64','test/fixtures/civ2-controller/owner-process.js',str(f),mode,str(d/('ready'+n)),str(d/'go'),str(d/'release')],cwd=R,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
def checkpoint(name,detail):
 results.append(dict(group=name,result=detail));v=dict(parent='a3fa32333bbcdc2c8717811432ef5cf6938be776',sources={p:hashlib.sha256((R/p).read_bytes()).hexdigest() for p in ['tools/civ2-serial-controller.js','tools/civ2-capture-plan.js','test/fixtures/civ2-controller/owner-process.js','test/test-civ2-controller-process-ownership.py']},completed=results,remaining='affected regressions/publication, fresh independent acceptance, UI/normal quit pending');t=E.with_suffix('.tmp');t.write_text(json.dumps(v,indent=2));t.replace(E);print('PASS '+name,flush=True)
import tempfile
for modes in [('launcher','launcher'),('launcher','standalone'),('standalone','launcher'),('standalone','standalone')]:
 d=pathlib.Path(tempfile.mkdtemp(prefix='process-',dir=OUT));ps=[]
 try:
  ps=[start(d,modes[0],'A'),start(d,modes[1],'B')];wait_for(lambda:all((d/('ready'+n)).exists() for n in ['A','B']));(d/'go').write_text('go')
  replies=[]
  for p in ps:
   wait_for(lambda:bool(select.select([p.stdout],[],[],0)[0]));replies.append(json.loads(p.stdout.readline()))
  assert sum(r['started'] for r in replies)==1,replies
  winner=next(i for i,r in enumerate(replies) if r['started']);assert sum(r['launches'] for r in replies)==int(modes[winner]=='launcher')
  before=(d/'controller-owner.json').read_bytes();ledger=(d/'capture-plan.json').read_bytes()
  # Kill the acknowledged winner without any controller cleanup. Retained claim
  # and ledger must still block both a new process and the actual standalone CLI.
  ps[winner].kill();ps[winner].wait(timeout=2)
  for p in ps:
   if p.poll() is None:p.wait(timeout=2)
  retry=start(d,'launcher','C');ps.append(retry);wait_for(lambda:bool(select.select([retry.stdout],[],[],0)[0]));r=json.loads(retry.stdout.readline());retry.wait(timeout=2);assert not r['started'] and r['launches']==0,r
  f=d/'cli.json';f.write_text(json.dumps(config(d,'new-cli')))
  cli=subprocess.run([NODE,'--max-old-space-size=64','tools/civ2-serial-controller.js',str(f)],cwd=R,capture_output=True,text=True,timeout=3)
  assert cli.returncode==1 and 'no allowance reset' in cli.stderr
  assert not (d/'control-in.jsonl').exists();assert (d/'controller-owner.json').read_bytes()==before;assert (d/'capture-plan.json').read_bytes()==ledger
  checkpoint('simultaneous '+'/'.join(modes)+' + killed winner/restart/actual CLI blocked',dict(replies=replies,retry=r,cliExit=cli.returncode,ownerUnchanged=True,ledgerUnchanged=True,noControl=True))
 finally:
  for p in ps:
   if p.poll() is None:p.kill()
   p.wait(timeout=2)
