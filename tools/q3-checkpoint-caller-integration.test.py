"""Offline executable production preparer/caller integration, no native runtime.

The retained phase function is executed with its real owning Session and real
generated prelaunch parent. Only the runtime and outer Boat transport are inert.
"""
import ast
import ctypes
import gzip
import hashlib
import json
import os
from pathlib import Path
import runpy
import signal
import subprocess
import sys
import threading
import time

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(sys.argv[1]).resolve()
OUT.mkdir(exist_ok=False)
assert OUT.is_relative_to(ROOT/'scratch/runs')
VERSION = 'q3-checkpoint-b993419a5-v1'
FOREIGN = 'q3-current-foreign-a16fc87d4-44fc9a134-v1' if '--foreign-closure' in sys.argv[2:] else None
PHASE = ROOT/'scratch/runs/20261109-q3-changed-control-native-progress-1475/phase.py'
H = lambda b: hashlib.sha256(b).hexdigest()
owner = runpy.run_path(str(ROOT/'tools/q3-native-launch-client.py'))
pre = runpy.run_path(str(ROOT/'tools/q3-native-prelaunch.py'))
assert ctypes.CDLL(None, use_errno=True).prctl(36, 1, 0, 0, 0) == 0


def save(p, v):
    p.write_bytes(gzip.compress(json.dumps(v).encode(), mtime=0))


def until(fn):
    due = time.monotonic()+8
    while not fn():
        assert time.monotonic() < due, 'finite offline test condition'
        time.sleep(.005)


# Sibling of every custody wait domain; observable before any tested child.
watch = OUT/'watch'; watch.mkdir(); (watch/'targets').write_text('[]')
w = subprocess.Popen([sys.executable, '-B', '-c', '''import json,os,signal,sys,time
from pathlib import Path
r=Path(sys.argv[1]);due=time.monotonic()+120
(r/'armed').write_text(json.dumps(dict(pid=os.getpid(),deadline=due)))
while time.monotonic()<due and not (r/'done').exists():time.sleep(.01)
fired=not (r/'done').exists()
if fired:
 for pid in json.loads((r/'targets').read_text()):
  try:os.killpg(pid,signal.SIGKILL)
  except ProcessLookupError:pass
(r/'terminal').write_text(json.dumps(dict(fired=fired)))
''', str(watch)], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
until(lambda: (watch/'armed').exists())
processes = []
sessions = []
tracking = threading.Event()


def targets():
    while not tracking.is_set():
        ids = [p.pid for p in processes if p.poll() is None]
        ids += [c.process.pid for s in sessions for c in s.children if c.process.poll() is None]
        temp = watch/'targets.tmp'
        temp.write_text(json.dumps(ids)); temp.replace(watch/'targets')
        time.sleep(.005)


tracker = threading.Thread(target=targets); tracker.start()


def child(argv, **kw):
    p = subprocess.Popen(argv, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                         start_new_session=True, **kw)
    processes.append(p)
    return p


def prepare(base, version=VERSION):
    # Small run-specific caller input, never a source tree snapshot.
    source = base/'phase-input.py'; source.write_bytes(PHASE.read_bytes())
    # Only small explicit run inputs; these are not source/module snapshots.
    (base/'control.py').write_text('''from pathlib import Path
import runpy,hashlib,types
ROOT=Path('''+repr(str(ROOT))+''');BASE=Path(__file__).resolve().parent;R=BASE/'prepared'
REMOTE=str(ROOT);H=lambda b:hashlib.sha256(b).hexdigest()
m=types.SimpleNamespace(**runpy.run_path(str(ROOT/'tools/q3-native-launch-client.py')))
c=types.SimpleNamespace()
def remote(*_):raise RuntimeError('OFFLINE transport requires test binding')
def save(*_):pass
def load(*_):raise RuntimeError('OFFLINE no historical proof')
def validate():return True
def box():raise RuntimeError('OFFLINE no box')
''')
    (base/'physical_gate.py').write_text("def physical_gate_code(*_):raise RuntimeError('OFFLINE native physical proof refused')\n")
    (base/'cancellation_gate.py').write_text("def require_separate_waits(waits):\n assert all(v['actualWait'] and v['stdoutEOF'] and v['stderrEOF'] for v in waits.values())\n")
    js = "const m=require('./tools/q3-current-module.cjs');console.log(JSON.stringify(m.prepare(process.argv[1],JSON.parse(process.argv[2]))));"
    opts = dict(inputs=[str(p.relative_to(ROOT)) for p in (source,base/'control.py',base/'physical_gate.py',base/'cancellation_gate.py')])
    if version is not None:
        opts.update(checkpointObserverVersion=version, caller=str(source.relative_to(ROOT)))
    if FOREIGN and version == VERSION:
        opts['foreignClosureVersion'] = FOREIGN
    if version==VERSION:
        argv=['node','tools/q3-current-module.cjs','--prepare',str(base/'pins'),
              '--checkpoint-observer-version',version,'--caller',opts['caller']]
        for name in opts['inputs']:argv+=['--input',name]
        if FOREIGN:argv+=['--foreign-closure-version',FOREIGN]
    else:argv=['node', '-e', js, str(base/'pins'), json.dumps(opts)]
    p = child(argv, cwd=ROOT)
    so, se = p.communicate(timeout=20)
    save(base/'prepare-wait.json.gz', dict(status=p.returncode, actualWait=True,
                                         stdoutEOF=True, stderrEOF=True, stderr=se.decode()))
    return p.returncode, so, se


try:
    for version, label in ((None, 'default'), ('unknown', 'unknown'), (VERSION, 'versioned')):
        b = OUT/label; b.mkdir()
        rc, so, se = prepare(b, version)
        if version != VERSION:
            assert rc != 0 and not (b/'pins').exists(), se.decode()
            continue
        assert rc == 0, se.decode()
        seal = json.loads(so)
        generated = ROOT/seal['caller']
        source = generated.read_text()
        assert "helper['bind_remote'](task,session)" in source
        assert "helper['observe_checkpoint'](task,session,session.remote)" in source
        assert 'q3-checkpoint-observer.py' in source
        assert 'due=time.time()+60' not in source.split("elif phase=='cancellation':", 1)[1].split('else:', 1)[0]
        assert "physical_gate_code(out),45" in source
        # Import the entire generated caller and all run-local dependencies as
        # an executable module before isolating its launch function below.
        import_code = '''import runpy,sys
from pathlib import Path
p=Path(sys.argv[1]);sys.path.insert(0,str(p.parent));sys.argv=[str(p),'import-only','cancellation']
def audit(event,args):
 if event in ('subprocess.Popen','socket.connect','os.fork','os.exec'):raise RuntimeError('OFFLINE import effect refused')
sys.addaudithook(audit)
m=runpy.run_path(str(p),run_name='q3_generated_import_test');assert callable(m['launch'])
print('PASS entire generated caller executable import; no process/network/native')
'''
        p=child([sys.executable,'-B','-c',import_code,str(generated)],cwd=ROOT)
        so,se=p.communicate(timeout=8)
        save(b/'caller-import.json.gz',dict(status=p.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=so.decode(),stderr=se.decode()))
        assert p.returncode==0,se.decode()
        pins = json.loads(gzip.decompress((b/'pins/runtime-pins.json.gz').read_bytes()))
        assert pins['checkpointObserverVersion'] == VERSION
        names = {p['path'] for p in pins['files']}
        for name in ('q3-checkpoint-observer.py', 'q3-cancellation-stream-eof.py', 'q3-native-launch-client.py'):
            assert 'tools/'+name in names
        for p in pins['files']:
            data = (ROOT/p['path']).read_bytes()
            assert H(data) == p['sha256'] and len(data) == p['size']
        # Exercise production preparation's authenticated provider checks via
        # read substitution, never by editing another owner's provider bytes.
        negative_js = r'''
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const m=require('./tools/q3-current-module.cjs'),base=process.argv[1],read=fs.readFileSync;
const selected=process.argv[2]?{foreignClosureVersion:process.argv[2]}:{};
const inputs=['phase-input.py','control.py','physical_gate.py','cancellation_gate.py'].map(n=>path.relative(process.cwd(),path.join(base,n)));
for(const target of ['q3-checkpoint-observer.py','q3-cancellation-stream-eof.py','q3-native-launch-client.py']){
 for(const mode of ['stale','missing']){
  const destination=path.join(base,'refuse-'+mode+'-'+target);
  fs.readFileSync=function(file,...args){
   if(path.resolve(String(file))===path.resolve('tools',target)){
    if(mode==='missing')throw Error('missing staged dependency: '+target);
    const data=Buffer.concat([read.call(this,file),Buffer.from('\n')]);return args[0]==='utf8'?data.toString():data;
   }return read.call(this,file,...args);
  };
  try{assert.throws(()=>m.prepare(destination,{...selected,inputs,caller:inputs[0],checkpointObserverVersion:m.checkpointObserverVersion}));assert(!fs.existsSync(destination));}
  finally{fs.readFileSync=read;}
 }
}
const destination=path.join(base,'missing-run-transitive');
assert.throws(()=>m.prepare(destination,{...selected,inputs:inputs.slice(0,-1),caller:inputs[0],checkpointObserverVersion:m.checkpointObserverVersion}),/missing caller transitive input/);
assert(!fs.existsSync(destination));
assert.throws(()=>m.composeCheckpointCaller('drift',m.checkpointObserverVersion),/authenticated retained1475/);
console.log('PASS six stale/missing provider refusals, missing caller dependency and caller drift');
'''
        p=child(['node','-e',negative_js,str(b),FOREIGN or ''],cwd=ROOT);so,se=p.communicate(timeout=20)
        save(b/'preparer-refusals.json.gz',dict(status=p.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=so.decode(),stderr=se.decode()))
        assert p.returncode==0,se.decode()
        # Execute prelaunch itself, including the deferred observer dependency
        # imports, against the production pinset. Refusals precede spawn.
        probe = b/'import-probe.py'; probe.write_text('import native_kernel_custody\n')
        for mode in ('check', 'missing-observer', 'stale-observer', 'missing-stream',
                     'missing-client', 'missing-caller', 'missing-caller-transitive', 'unknown-version', 'default-off'):
            q=b/('prelaunch-'+mode);q.mkdir()
            v=json.loads(json.dumps(pins));data=probe.read_bytes()
            v['files'].append(dict(path=str(probe.relative_to(ROOT)),size=len(data),sha256=H(data)))
            remove={'missing-observer':'tools/q3-checkpoint-observer.py',
                    'missing-stream':'tools/q3-cancellation-stream-eof.py',
                    'missing-client':'tools/q3-native-launch-client.py',
                    'missing-caller-transitive':str(generated.with_name('physical_gate.py').relative_to(ROOT)),
                    'missing-caller':pins['checkpointCaller']}.get(mode)
            if remove:v['files']=[p for p in v['files'] if p['path']!=remove]
            if mode=='stale-observer':next(p for p in v['files'] if p['path']=='tools/q3-checkpoint-observer.py')['sha256']='0'*64
            if mode=='unknown-version':v['checkpointObserverVersion']='unknown'
            if mode=='default-off':v.pop('checkpointObserverVersion');v.pop('checkpointCaller')
            save(q/'runtime-pins.json.gz',v)
            p=child([sys.executable,'-B',str(ROOT/'tools/q3-native-prelaunch.py'),str(ROOT),str(q),str(probe),'--check-only'],cwd=ROOT)
            so,se=p.communicate(timeout=10)
            save(q/'actual-wait.json.gz',dict(status=p.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=so.decode(),stderr=se.decode()))
            if mode in ('check','default-off'):
                assert p.returncode==0,se.decode()
                assert json.loads(so)==dict(checkOnly=True,importsBound=True,spawn=False)
            else:
                assert p.returncode!=0 and not (q/'one-original-claim.json.gz').exists(),mode
            print('actual prelaunch',mode,'PASS',flush=True)
        baseline = subprocess.check_output(['git', 'show', '6d966f9d1:tools/q3-current-module.cjs'], cwd=ROOT)
        # Existing default uses its original literal pins; no blanket repin.
        assert b"'tools/q3-native-prelaunch.py':'2591af4d" in baseline
        for mode in ('partial', 'damaged', 'prior-failure', 'cancel', 'diagnostic-cap', 'ready'):
            r = OUT/mode; r.mkdir(); prepared=r/'prepared'; prepared.mkdir()
            out=r/'output'; out.mkdir()
            good = dict(at='inert', nativeQualified=False, waitMs=10000)
            if mode=='partial': (out/'cancellation-ready.json').write_text('{')
            if mode=='damaged': (out/'cancellation-ready.json').write_text('[]')
            if mode=='cancel':
                (out/'cancellation-ready.json').write_text(json.dumps(good))
            if mode=='cancel': (prepared/'caller-cancelled.json').write_text('{"first":"sticky"}')
            # Run the generated phase's actual launch function; C's policy and
            # physical native proof are inert, but never turned into receipts.
            runtime = r/'runtime.py'
            runtime.write_text('''from pathlib import Path
import gzip,json,os,signal,sys,time
r=Path(__file__).parent;p=r/'prepared'
me=dict(pid=os.getpid(),start=Path('/proc',str(os.getpid()),'stat').read_text().rsplit(')',1)[1].split()[19])
(p/'runtime-identity.json.gz').write_bytes(gzip.compress(json.dumps(me).encode()))
(p/'kernel-armed.json').write_text(json.dumps(dict(supervisor=me['pid'],supervisorStart=me['start'])))
signal.signal(signal.SIGTERM,lambda *_:sys.exit(3))
mode='''+repr(mode)+''';n=0
if mode=='prior-failure':(r/'output/first-browser-failure.json').write_text('{"first":"sticky"}')
if mode in ('prior-failure','ready'):
 (r/'output/cancellation-ready.json').write_text(json.dumps(dict(at='inert',nativeQualified=False,waitMs=10000)))
(r/'ready').touch()
while True:
 if mode=='diagnostic-cap':
  n+=1;(r/'output/process.json').write_text(json.dumps(dict(inert=True,sequence=n)))
 time.sleep(.005)
''')
            selected = json.loads(json.dumps(pins))
            data=runtime.read_bytes()
            selected['files'].append(dict(path=str(runtime.relative_to(ROOT)),size=len(data),sha256=H(data)))
            save(prepared/'runtime-pins.json.gz',selected)
            transport_codes=[]
            current_sessions=[]
            # Keep the original 60-second code and 70-second transport bound;
            # partial/damaged tests cancel externally instead of waiting 60s.
            def transport(code, timeout):
                transport_codes.append((code,timeout))
                if 'checkpoint-observer.ndjson' in code:
                    assert 'deadline=time.monotonic()+60' in code and timeout==70
                wrapper = '''import contextlib,io,json,sys
output=io.StringIO()
with contextlib.redirect_stdout(output):exec(compile(sys.argv[1],'<offline-transport>','exec'))
print(json.dumps(dict(stdout=output.getvalue(),exitCode=0)),flush=True)
'''
                # Session owns the generated parent directly. Observation and
                # cancellation retain only Boat's output envelope, in-process.
                if 'PRELAUNCH_ACTUAL_WAIT' in code:
                    return ['setsid',sys.executable,'-B','-c',code]
                return ['setsid',sys.executable,'-B','-c',wrapper,code]
            import types
            real_session=owner['Session']
            def session_factory(*args,**kwargs):
                s=real_session(args[0],transport,**kwargs);sessions.append(s);current_sessions.append(s);return s
            m=types.SimpleNamespace(compose_task=owner['compose_task'], Session=session_factory)
            c=types.SimpleNamespace()
            C=dict(validate=lambda:True, box=lambda:'OFFLINE-NO-BOX')
            records={}
            def record(name,value):records[name]=value
            def read(name):return records[name]
            ns=dict(phase='cancellation',R=r,ROOT=ROOT,BASE=r,REMOTE=str(ROOT),phasebase=r,
                    phaseRun=str(prepared.relative_to(ROOT)),out=str(out),save=record,load=read,
                    m=m,H=H,C=C,Path=Path,sys=sys,runpy=runpy,json=json,gzip=gzip,time=time,
                    subprocess=subprocess,threading=threading,os=os,
                    remote=lambda *_: (_ for _ in ()).throw(RuntimeError('OFFLINE postlaunch proof refused')),
                    physical_gate_code=lambda _: (_ for _ in ()).throw(RuntimeError('OFFLINE physical proof refused')))
            # Only the retained phase's function body is executable here. This
            # avoids its allocation/control imports without replacing logic.
            tree=ast.parse(source)
            fn=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='launch')
            exec(compile(ast.Module(body=[fn],type_ignores=[]),str(generated),'exec'),ns)
            errors=[]
            def launch():
                try:ns['launch']()
                except BaseException as e:errors.append(str(e))
            t=threading.Thread(target=launch);t.start()
            until(lambda:bool(current_sessions))
            s=current_sessions[0]
            if mode in ('partial','damaged'):
                until(lambda:(prepared/'checkpoint-observer.ndjson').exists() and (r/'ready').exists())
                s.fail('OFFLINE external cancellation; original deadline unchanged')
            t.join(12);assert not t.is_alive(), mode
            assert s.terminal and not s.completed
            assert not records.get('cancellation-commanded-physical-gate')
            assert not any('command-' in p.label for p in s.children)
            assert all(p.process.poll() is not None for p in s.children)
            assert all(v['actualWait'] and v['stdoutEOF'] and v['stderrEOF'] for v in s.receipts)
            nested={}
            if (r/'ready').exists():
                nested['local-generated-parent']=next(v for v in s.receipts if v['pid']==s.launch.process.pid)
                for name in ('prelaunch-child-actual-wait.json.gz','runtime-parent-actual-wait.json.gz'):
                    if mode=='diagnostic-cap' and name=='prelaunch-child-actual-wait.json.gz' and not (prepared/name).exists():
                        name='checkpoint-diagnostic-wait.ndjson'
                        v=json.loads((prepared/name).read_text().splitlines()[-1])
                        assert v['kind']=='diagnostic-failed-after-actual-wait'
                    else:v=json.loads(gzip.decompress((prepared/name).read_bytes()))
                    nested[name]=v
                    assert v['actualWait'] and v['stdoutEOF'] and v['stderrEOF'],(mode,name)
                identity=json.loads(gzip.decompress((prepared/'runtime-identity.json.gz').read_bytes()))
                assert not Path('/proc',str(identity['pid'])).exists()
            assert mode=='cancel' or any('checkpoint-observer.ndjson' in code for code,_ in transport_codes)
            if mode=='ready':assert 'OFFLINE physical proof refused' in s.terminal['reason']
            if mode=='diagnostic-cap':
                journals=[prepared/'checkpoint-launch.ndjson',prepared/'checkpoint-observer.ndjson']
                assert any(p.exists() and any(json.loads(line)['kind']=='diagnostic-cap' for line in p.read_text().splitlines()) for p in journals)
            save(r/'result.json.gz',dict(passed=True,terminal=s.terminal,receipts=s.receipts,nested=nested,errors=errors,
                                       nativeQualified=False,browserEOF='UNKNOWN'))
            print('actual generated phase',mode,'PASS',flush=True)
finally:
    for s in sessions:
        s.close()
        for c in s.children:
            if c.process.poll() is None:os.killpg(c.process.pid,signal.SIGKILL)
            c.finish(time.monotonic()+3)
    tracking.set();tracker.join()
    for p in processes:
        if p.poll() is None:os.killpg(p.pid,signal.SIGKILL)
        p.communicate(timeout=5)
    (watch/'done').touch();so,se=w.communicate(timeout=5)
    save(watch/'actual-wait.json.gz',dict(status=w.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True))
    assert not json.loads((watch/'terminal').read_text())['fired']
    orphans=[]
    while True:
        try:pid,status=os.waitpid(-1,os.WNOHANG)
        except ChildProcessError:break
        assert pid>0,'unsettled owned descendant after all parent waits'
        orphans.append(dict(pid=pid,rawStatus=status,actualWait=True))
    save(OUT/'orphan-actual-waits.json.gz',dict(children=orphans))
print('PASS production preparation and generated owning caller; independent watchdog joined',flush=True)
