"""Local exact-input integration; actual owner/Node/Chrome waits, files API EOF.

Usage: python3 -B tools/mw3-retention-repair-test.py OWNED_RUN
No provider allocation, original, guest edit or repeated evidence volume.
"""
from pathlib import Path
import hashlib
import importlib.util
import json
import os
import shutil
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT/'tools'))
R = Path(sys.argv[1]).resolve()
expected_status = 1 if os.environ.get('MW3_EXPECT_FAILURE')=='1' else 0
prior = ROOT/'scratch/runs/20261111-mw3-inflight-observed-throttle-0210'
F = R/('parent-fixture-'+str(time.time_ns()))
F.mkdir()
shutil.copyfile(R/'owner-start.py', F/'owner-start.py')
shutil.copyfile(prior/'owner.py', F/'owner.py')
(F/'browser.cjs').write_text("require("+json.dumps(str(ROOT/'tools/mw3-preclick-readiness.test.cjs'))+");\n")
env = dict(os.environ, MW3_TEST_FIXTURE='1', MW3_REPAIR_RUN=str(R),
           MW3_PARENT_RUNTIME=str(F/'runtime'), MW3_DEADLINE=str(time.time()+500))

# Arm an independently scheduled, observable immutable local deadline first.
deadline = time.time()+100
watch_code = """import os,signal,sys,time,json
from pathlib import Path
r=Path(sys.argv[1]);due=float(sys.argv[2])
(r/'watchdog-armed.json').write_text(json.dumps(dict(pid=os.getpid(),deadline=due,independent=True)))
while time.time()<due and not (r/'fixture-done.json').exists():time.sleep(.05)
expired=not (r/'fixture-done.json').exists()
if expired and (r/'parent-pid.json').exists():
 p=json.loads((r/'parent-pid.json').read_text())['pid']
 try:os.killpg(p,signal.SIGTERM)
 except ProcessLookupError:pass
(r/'watchdog-terminal.json').write_text(json.dumps(dict(expired=expired,deadline=due)))
"""
watch = subprocess.Popen([sys.executable, '-B', '-c', watch_code, str(F), str(deadline)], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
while not (F/'watchdog-armed.json').exists():
    assert watch.poll() is None
    time.sleep(.01)
parent = subprocess.Popen([sys.executable, '-B', str(F/'owner-start.py')], env=env,
                          stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True)
(F/'parent-pid.json').write_text(json.dumps(dict(pid=parent.pid)))
so, se = parent.communicate(timeout=90)
(F/'launcher-stdout.raw').write_bytes(so)
(F/'launcher-stderr.raw').write_bytes(se)
(F/'launcher-actual-wait.json').write_text(json.dumps(dict(status=parent.returncode,
    actualParentWait=True, separateEOF=dict(stdout=True, stderr=True))))
assert parent.returncode == expected_status, se.decode()
runtime = F/'runtime'
outer = json.loads((runtime/'owner-terminal-manifest.json').read_text())
assert outer['actualOuterFinalization']
for name in ['node-actual-wait.json', 'case-webgl/chrome-parent-wait.json', 'owner-actual-wait.json']:
    v = json.loads((runtime/name).read_text())
    assert v['status'] == (0 if name.startswith('case-webgl/') else expected_status) and v['actualParentWait'] and v['separateEOF'] == dict(stdout=True, stderr=True), (name, v)

# Exercise the real Collector and recover-watch through the HTTP files contract.
events = []
class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass
    def reply(self, v):
        b=json.dumps(v).encode();self.send_response(200);self.end_headers();self.wfile.write(b)
    def do_POST(self):
        assert self.path.endswith('/files/download-url'), self.path
        v=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        assert Path(v['path']).is_relative_to(F)
        self.reply(dict(method='GET',path=v['path'],url=base+'/raw?path='+__import__('urllib.parse',fromlist=['quote']).quote(v['path'])))
    def do_GET(self):
        u=urlparse(self.path);p=Path(parse_qs(u.query)['path'][0]);assert p.is_relative_to(F)
        events.append(dict(method='GET',path=str(p),at=time.time()))
        if u.path=='/raw':
            self.send_response(200);self.end_headers();self.wfile.write(p.read_bytes());return
        assert u.path.endswith('/files/list'),self.path
        self.reply(dict(path=str(p),truncated=False,files=[dict(name=x.name,path=str(x),isDir=x.is_dir(),isSymlink=x.is_symlink()) for x in p.iterdir()]))

server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
base='http://127.0.0.1:'+str(server.server_port)
thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
spec=importlib.util.spec_from_file_location('repaired_collect',R/'collect.py')
collect=importlib.util.module_from_spec(spec);spec.loader.exec_module(collect)
try:
    # The inner manifest exists but is insufficient until the actual outer
    # parent's complete wait and both streams have been published.
    (runtime/'owner-terminal-manifest.json').rename(runtime/'withheld-outer-manifest.tmp')
    withheld=collect.Collector(base,'local-fixture','local',str(runtime),F/'withheld')
    result=withheld.run(time.time()+.3)
    assert not result['passed'] and 'deadline' in result['error']
    (runtime/'withheld-outer-manifest.tmp').rename(runtime/'owner-terminal-manifest.json')
    shutil.copyfile(R/'collect.py',F/'collect.py')
    shutil.copyfile(R/'recover-watch.py',F/'recover-watch.py')
    (F/'native-start-result.json').write_text('{}')
    (F/'immutable-deadline.json').write_text(json.dumps(dict(deadline=time.time()+15)))
    (F/'control.py').write_text('''from pathlib import Path
import json,time,sys
sys.path.insert(0,'''+repr(str(ROOT/'tools'))+''')
from api_command_custody import Transport
R=Path(__file__).resolve().parent
def box():return 'local'
def read(n):return json.loads((R/n).read_text())
def save(n,v):
 with (R/n).open('x') as f:json.dump(v,f)
def connection(_):return Transport('''+repr(base)+''','local-fixture','local',lambda v:None)
def stop(reason):save('unexpected-stop.json',dict(reason=reason))
''')
    recovery=subprocess.Popen([sys.executable,'-B',str(F/'recover-watch.py')],env=dict(os.environ,PYTHONPATH=str(ROOT/'tools')),stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    so,se=recovery.communicate(timeout=25)
    (F/'recovery-stdout.raw').write_bytes(so);(F/'recovery-stderr.raw').write_bytes(se)
    (F/'recovery-actual-wait.json').write_text(json.dumps(dict(status=recovery.returncode,actualParentWait=True,separateEOF=dict(stdout=True,stderr=True))))
    assert recovery.returncode==0,se.decode()
    verified=json.loads((F/'retrieval-verified.json').read_text())
    assert verified['passed'] and (F/'finish-request.json').exists() and not (F/'unexpected-stop.json').exists()
    for row in verified['rows']:
        b=(F/'recovered'/row['local']).read_bytes()
        assert len(b)==row['size'] and hashlib.sha256(b).hexdigest()==row['sha256']==row['secondRemoteSHA256']
    assert {'owner-actual-wait.json','owner-stdout.raw','owner-stderr.raw','owner-terminal-manifest.json'} <= {r['path'] for r in verified['rows']}
    refusal_rows=[r for r in verified['rows'] if r['path'].endswith('-preclick-refusal.json')]
    assert len(refusal_rows)==3, 'all controller refusal snapshots must survive recovery'
    for row in refusal_rows:
        receipt=json.loads((F/'recovered'/row['local']).read_bytes())
        assert receipt['noInput'] and receipt['noReplay']
    empty=next(r for r in refusal_rows if '/controller-empty-' in '/'+r['path'])
    raw=json.loads((F/'recovered'/empty['local']).read_bytes())['snapshot']
    assert raw['records']==[] and raw['errors']==[] and raw['pending']==raw['drops']==0
    # Normal-stop hook receives only the final verified recovery result.
    (F/'normal-stop-hook.json').write_text(json.dumps(dict(at=time.time(),localFixtureOnly=True,verifiedPaths=verified['paths'])))
    (F/'files-api-events.json').write_text(json.dumps(events,indent=2))
    # Every stream receipt is mandatory and EOF is checked independently.
    checker=collect.Collector(base,'local-fixture','local',str(runtime),F/'negative-checks')
    checker.dest=F/'recovered';checker.verified={r['path']:r for r in verified['rows']}
    for name in ['owner-stdout.raw','owner-stderr.raw','owner-actual-wait.json']:
        row=checker.verified.pop(name)
        try:
            checker.validate_waits();raise AssertionError('missing outer evidence accepted')
        except AssertionError as e:
            assert 'missing' in str(e)
        finally:checker.verified[name]=row
    row=checker.verified['owner-actual-wait.json'];p=checker.dest/row['local'];raw=p.read_bytes()
    try:
        bad=json.loads(raw);bad['separateEOF']['stderr']=False;p.write_text(json.dumps(bad))
        try:
            checker.validate_waits();raise AssertionError('incomplete EOF accepted')
        except AssertionError as e:
            assert 'EOF required' in str(e)
    finally:p.write_bytes(raw)
    result_name='failure-retention-results.json' if expected_status else 'retention-results.json'
    (R/result_name).write_text(json.dumps(dict(passed=True,fixture=str(F),expectedNodeOwnerStatus=expected_status,
        actualOwnerNodeChromeWaits=True,separateEOF=True,withheldOuterRefused=True,
        missingOuterRefused=3,incompleteEOFRefused=True,verifiedPaths=verified['paths'],
        rawRefusalsRecovered=len(refusal_rows),
        verifiedBeforeNormalStop=True,noBox=True,noOriginal=True),indent=2))
finally:
    server.shutdown();server.server_close();thread.join()
    (F/'fixture-done.json').write_text('{}')
    so,se=watch.communicate(timeout=5)
    (F/'watchdog-actual-wait.json').write_text(json.dumps(dict(status=watch.returncode,actualParentWait=True,separateEOF=dict(stdout=True,stderr=True),stdout=so.decode(),stderr=se.decode())))
print('PASS actual controller/full-module fixture, parent waits, outer recovery barrier and EOF negatives')
