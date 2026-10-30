import pathlib,json,hashlib,sys,importlib.util,resource
import owner_policy_gate as g
g.setup();r=g.ops.ROOT;e=g.ops.E
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
d=r/'repo/test/enigma-guest-poll-causal-runtime-oct30';hashes=json.loads((d/'artifact-hashes.json').read_text());assert len(hashes)==25
for name,row in hashes.items():assert sha(d/name)==row['sha256'],name
# Reuse exact filename-bearing parser and startup configuration; no broad acceptance rerun.
for name in ['canonical-parser','startup']:
 rec=json.loads((d/(name+'.json')).read_text());assert rec['exit']==0
fixture=r/'owner-policy/raw/disposable-large';fixture.write_bytes(b'x'*2097152);assert fixture.stat().st_blocks*512>=2097152
assert g.admission()['checks']['allocation'];fixture.unlink()
f=e/'disposable-overflow';f.write_bytes(b'x'*1048577)
try:g.ops.check_evidence()
except AssertionError:pass
else:raise AssertionError('compact overflow accepted')
f.unlink()
rc,_=g.ops.run('file-control',[sys.executable,'-B','-c',"from pathlib import Path;p=Path('owner-policy/raw/disposable-file');p.write_bytes(b'x'*2097152);assert p.stat().st_size==2097152;p.unlink()"],cwd=r);assert rc==0
try:g.ops.run('capture-control',[sys.executable,'-B','-c',"import os;os.write(1,b'x'*600000)"],cwd=r)
except (AssertionError,RuntimeError) as ex:assert str(ex)=='capture'
else:raise AssertionError('capture overflow accepted')
# Disposable negative-control captures removed; evidence records their bytes, not production denials.
control={x.name:x.stat().st_size for x in e.glob('capture-control.*')}
for x in e.glob('capture-control.*'):x.unlink()
a=g.admission()
spec=importlib.util.spec_from_file_location('i',r/'guest-poll-instrument.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
base=(r/'input-source/runner__test__run.js').read_text();instrumented=m.instrument(base)
packet=dict(PASS=True,admission=a,verifiedPublishedArtifacts=25,parserReused=dict(path=str(d/'canonical-parser.json'),sha256=sha(d/'canonical-parser.json')),startupReused=dict(path=str(d/'startup.json'),sha256=sha(d/'startup.json')),limits={k:resource.getrlimit(getattr(resource,k)) for k in ['RLIMIT_DATA','RLIMIT_AS','RLIMIT_CPU','RLIMIT_FSIZE']},captureCeiling=524288,fileCeiling=12582912,captureOverflowRejected=control,runnerBase=sha(r/'input-source/runner__test__run.js'),runnerInstrumented=hashlib.sha256(instrumented.encode()).hexdigest(),argvSHA256=sha(r/'guest-poll-args.json'),wrappers={n:sha(r/n) for n in ['owner_policy_ops.py','owner_policy_gate.py','owner-policy-runtime.py','owner-policy-guest.py']})
(e/'preflight.json').write_text(json.dumps(packet,indent=2));print(json.dumps(packet))
