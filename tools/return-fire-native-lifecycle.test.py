"""Real process/session death; fake API only. Evidence directory is explicit."""
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
TOOL = ROOT/'tools/return-fire-native-lifecycle.py'
OUT = Path(sys.argv[1]).resolve(); OUT.mkdir(parents=True, exist_ok=True)
assert OUT.is_relative_to(ROOT/'scratch/runs')


def read(p): return json.loads(p.read_text())


def wait(p, seconds=12):
    due = time.monotonic()+seconds
    while not p.exists():
        assert time.monotonic() < due, str(p)
        time.sleep(.02)
    return read(p)


def call(action, r, *args, ok=True):
    p = subprocess.run([sys.executable, '-B', str(TOOL), action, str(r), *map(str,args)],
                       capture_output=True, timeout=20)
    with (OUT/'cli.jsonl').open('a') as f:
        f.write(json.dumps(dict(action=action, run=r.name, rc=p.returncode,
            stdout=p.stdout.decode(), stderr=p.stderr.decode(), actualWait=True,
            stdoutEOF=True, stderrEOF=True))+'\n')
    assert (p.returncode == 0) == ok, p.stderr.decode()
    return json.loads(p.stdout) if ok else None


def fixture(name, seconds=4):
    r = OUT/name; r.mkdir()
    adapter = r/'fake-api.py'
    adapter.write_text('''import json,time
from pathlib import Path
R=Path(__file__).resolve().parent
class Access:
 def api(self,method,path,body=None):
  with (R/'api.jsonl').open('a') as f:f.write(json.dumps(dict(method=method,path=path,at=time.time()))+'\\n')
  if method=='POST':
   assert path=='sandboxes/bx_fake/stop' and body=={}
   if (R/'fail-api').exists():raise RuntimeError('uncertain API failure')
   return dict(id='stop_fake',forced=False)
  return dict(id='bx_fake',state='archived',archiveAfter=None)
 def sanitized(self,v):return v
class Transport:access=Access()
t=Transport()
''')
    # The launcher owns a real session. arm must escape it before allocation.
    script = '''import subprocess,sys,time,json
p=subprocess.run([sys.executable,'-B',sys.argv[1],'arm',sys.argv[2],sys.argv[3],sys.argv[4]],capture_output=True)
from pathlib import Path
Path(sys.argv[2]+'/launcher-result.json').write_text(json.dumps(dict(rc=p.returncode,stdout=p.stdout.decode(),stderr=p.stderr.decode())))
time.sleep(30)
'''
    p = subprocess.Popen([sys.executable,'-B','-c',script,str(TOOL),str(r),str(adapter),str(time.time()+seconds)],
                         start_new_session=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    result = wait(r/'launcher-result.json'); assert result['rc']==0, result
    c = json.loads(result['stdout']); token=c['uuid']
    s=wait(r/'supervisor-ready.json');w=wait(r/'watchdog-ready.json')
    assert len({p.pid,s['process']['sid'],w['process']['sid']})==3
    os.killpg(p.pid,signal.SIGTERM);so,se=p.communicate(timeout=3)
    (r/'launcher-death.json').write_text(json.dumps(dict(returnCode=p.returncode,
        actualWait=True,stdoutEOF=True,stderrEOF=True,supervisor=s,watchdog=w)))
    assert p.returncode==-signal.SIGTERM
    source=r/'boat-created.json'
    source.write_text(json.dumps(dict(idempotencyKey=token,shutdownDelegated=True,box=dict(id='bx_fake',archiveAfter=None))))
    call('bind',r,'wrong-uuid',source,ok=False)
    call('bind',r,token,source)
    call('bind',r,token,source,ok=False)
    assert call('status',r,token)['processMatches']
    return r,c,s,w


def stopped(r, join=True):
    terminal=wait(r/'watchdog-terminal.json')
    assert terminal['outcome']=='STOP_CONFIRMED',terminal
    if join:
        call('join',r,read(r/'deadline.json')['uuid'])
        reaped=read(r/'watchdog-reaped.json')
        assert reaped['actualWait'] and reaped['stdoutEOF'] and reaped['stderrEOF']
    rows=[json.loads(l) for l in (r/'api.jsonl').read_text().splitlines()]
    assert len([x for x in rows if x['method']=='POST'])==1,rows
    assert read(r/'stop-result.json')['forced'] is False
    return terminal


results=[]
r,c,s,w=fixture('launcher-session-death-expiry')
stopped(r);assert read(r/'stop-attempt.json')['reason']=='deadline'
results.append('launcher session SIGTERM: expiry still normal-stops, reaped and EOF')

r,c,s,w=fixture('normal-completion',6)
call('complete',r,'wrong-uuid',r/'absent',ok=False)
data=b'unique retrieved bytes';(r/'artifact').write_bytes(data)
manifest=r/'manifest.json';manifest.write_text(json.dumps(dict(allMatched=True,artifacts=[dict(local='artifact',size=len(data),sha256=hashlib.sha256(data).hexdigest())])))
(r/'artifact').write_bytes(b'corrupt');call('complete',r,c['uuid'],manifest,ok=False)
assert not (r/'normal-request.json').exists()
(r/'artifact').write_bytes(data)
os.killpg(s['process']['sid'],signal.SIGTERM)
call('complete',r,c['uuid'],manifest)
stopped(r);assert read(r/'stop-attempt.json')['reason']=='verified completion'
assert signal.SIGTERM in read(r/'supervisor-terminal.json')['signals']
results.append('verified completion and supervisor SIGTERM: exactly one stop, actual wait/EOF')

r,c,s,w=fixture('supervisor-sigkill',3)
os.killpg(s['process']['sid'],signal.SIGKILL)
assert Path('/proc/'+str(w['process']['pid'])).exists()
stopped(r,join=False)
assert not (r/'watchdog-reaped.json').exists() and not (r/'supervisor-terminal.json').exists()
results.append('supervisor SIGKILL: independent expiry stops; historical reap explicitly absent')

r,c,s,w=fixture('immutable-mutation',3)
bad=dict(c,uuid='wrong',deadlineEpoch=time.time()+900,monotonicDeadline=time.monotonic()+900)
(r/'deadline.json').write_text(json.dumps(bad))
call('status',r,c['uuid'],ok=False)
call('complete',r,bad['uuid'],r/'absent',ok=False)
t=stopped(r,join=False);assert t['mutationRefused']
wait(r/'supervisor-terminal.json')
assert read(r/'stop-attempt.json')['at'] < c['deadlineEpoch']+1
results.append('UUID/deadline mutation refused: original expiry unchanged')

r,c,s,w=fixture('binding-mutation',2)
(r/'allocation.json').write_text(json.dumps(dict(uuid=c['uuid'],boxId='bx_wrong')))
(r/'normal-request.json').write_text(json.dumps(dict(uuid='wrong',independentlyReadAllBytes=True)))
t=stopped(r);assert t['mutationRefused']
events=(r/'events.jsonl').read_text();assert 'normal-request-refused' in events
assert 'immutable-binding-mutation-refused' in events
results.append('bound ID mutation and wrong request UUID: refused, original box stopped once')

r,c,s,w=fixture('api-uncertain-no-retry',2)
(r/'fail-api').touch();t=wait(r/'watchdog-terminal.json');assert t['outcome']=='FAILED'
wait(r/'supervisor-terminal.json')
assert read(r/'watchdog-reaped.json')['returnCode']!=0
assert not (r/'normal-stop-confirmed.json').exists()
rows=[json.loads(l) for l in (r/'api.jsonl').read_text().splitlines()];assert len(rows)==1
results.append('uncertain API failure remains FAILED with one attempt, no stop retry')

(OUT/'tests.json').write_text(json.dumps(dict(passed=True,tests=results),indent=2))
print(json.dumps(dict(passed=True,tests=results)))
