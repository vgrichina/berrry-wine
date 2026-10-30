import pathlib,json,hashlib,resource,subprocess,importlib.util
import guest_poll_gate as g
g.setup();r=g.ops.ROOT;e=g.ops.E
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
f=g.OUT/'raw/disposable-placeholder';f.write_bytes(b'x'*2097152);a=g.admission();assert f.stat().st_blocks*512>=2097152
p=e/'disposable-overflow';p.write_bytes(b'x'*1048577)
try:g.ops.check_evidence()
except AssertionError:overflow=True
else:raise AssertionError('compact overflow accepted')
p.unlink();f.unlink()
(e/'accounting-fixture.json').write_text(json.dumps(dict(rawPhysicallyCounted=True,compactOverflowRejected=overflow,placeholderRemoved=True)))
rc,s=g.ops.run('startup',['/usr/bin/node','--max-old-space-size=512','-e',"console.log(JSON.stringify({node:process.execPath,limits:require('fs').readFileSync('/proc/self/limits','utf8'),heap:require('v8').getHeapStatistics().heap_size_limit}))"],cwd=r);assert rc==0
rc,s=g.ops.run('canonical-parser',['/usr/bin/node','--max-old-space-size=512',str(r/'guest-poll-parser.cjs')],cwd=r);assert rc==0
old=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/enigma-compact-causal-runtime-owner133-oct30/e/preflight.json')
receipt=json.loads(old.read_text());assert receipt['PASS'] and receipt['rowsChecked']==2663
assert receipt['manifest']['sha256']==sha(r/'transfer-manifest.json')
assert receipt['mount']['sha256']==sha(r/'mount-enumeration.json')
assert [x for x in json.loads((r/'guest-poll-args.json').read_text()) if x!='--trace-input-poll']==receipt['argv']
# Streaming current owned HEAD comparison; never capture or copy whole runner source.
q=subprocess.Popen(['git','-C',str(g.ops.REPO),'show','HEAD:test/run.js'],cwd=g.ops.REPO,preexec_fn=lambda:g.ops.child_limits(True),stdout=subprocess.PIPE,stderr=subprocess.PIPE)
h=hashlib.sha256();n=0
while b:=q.stdout.read(65536):h.update(b);n+=len(b)
error=q.stderr.read(4096);assert q.wait()==0,error
current=dict(sha256=h.hexdigest(),bytes=n)
spec=importlib.util.spec_from_file_location('instrument',r/'guest-poll-instrument.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
base=(r/'input-source/runner__test__run.js').read_text();instrumented=m.instrument(base)
assert m.instrument.__name__=='instrument'
# Syntax-check via stdin; no second local whole-runner copy.
q=subprocess.run(['/usr/bin/node','--max-old-space-size=512','--check'],cwd=r,input=instrumented.encode(),capture_output=True,timeout=10);assert q.returncode==0,q.stderr[:1000]
a=g.admission();assert a['MemAvailable']>=4436865024,('predispatch full admission',a)
packet=dict(PASS=True,at=a['at'],admission=a,reusedVerifiedArchiveReceipt=dict(path=str(old),sha256=sha(old)),manifestSHA256=sha(r/'transfer-manifest.json'),mountSHA256=sha(r/'mount-enumeration.json'),currentOwnedHEADRunner=current,archiveRunnerSHA256=hashlib.sha256(base.encode()).hexdigest(),instrumentedRunnerSHA256=hashlib.sha256(instrumented.encode()).hexdigest(),argv=json.loads((r/'guest-poll-args.json').read_text()),instrumentationSHA256=sha(r/'guest-poll-instrument.py'))
(e/'preflight.json').write_text(json.dumps(packet,indent=2));print(json.dumps(packet))
