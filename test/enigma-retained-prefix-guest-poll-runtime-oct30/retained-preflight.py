import pathlib,sys,json,hashlib,time,resource,base64,importlib.util
import retained_gate as g
g.setup();o=g.ops;r=o.ROOT;e=o.E
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def run(n,args,git=False):
 rc,s=o.run(n,(['git','-C',str(o.REPO)] if git else [])+args,cwd=o.REPO if git else r,git=git);assert rc==0,(n,rc);return s
prior=o.REPO/'test/enigma-guest-poll-causal-runtime-oct30'
run('startup',json.loads((prior/'startup.json').read_text())['argv'])
run('canonical-parser',json.loads((prior/'canonical-parser.json').read_text())['argv'])
a=json.loads((r/'archive.json').read_text());h=hashlib.sha256();prefix=hashlib.sha256();left=13156352;size=0
for part in a['parts']:
 with (r/part).open('rb') as f:
  while b:=f.read(65536):
   h.update(b);size+=len(b)
   if left:prefix.update(b[:left]);left=max(0,left-len(b))
assert h.hexdigest()=='43dcac837bfe6b2eaa1c3aa4c2a3a63ea42ffeed54f1128ef192c2cbd5e757c3' and size==17282066
assert prefix.hexdigest()=='1600f60cdbf1733d0f88ee0592fa31e642dc607ffa7bfc933a6d95e3a1b4696f'
manifest=json.loads((r/'transfer-manifest.json').read_text());mount=json.loads((r/'mount-enumeration.json').read_text());files=[x['target'] for x in manifest if x['target'].startswith('vfs/')];assert sorted(files)==sorted(mount['files'])
assert len(manifest)==2663
run('file-control',[sys.executable,'-B','-c',"from pathlib import Path;p=Path('retained-prefix/raw/disposable');p.write_bytes(b'x'*2097152);assert p.stat().st_size==2097152;p.unlink()"])
try:run('overflow-control',[sys.executable,'-B','-c',"import os;os.write(1,b'x'*600000)"])
except (AssertionError,RuntimeError) as ex:assert str(ex)=='capture'
else:raise AssertionError('overflow accepted')
# Control artifact retained as raw, excluded only from compact evidence allowance.
for p in e.glob('overflow-control.*'):p.rename(g.OUT/'raw'/p.name)
helptext=run('resume-supported',['/home/user/.ascii/boat','--no-update','resume','--help']);assert 'resume' in helptext.lower()
assert run('pinned-head',['rev-parse','HEAD'],True).strip()=='fab6e44b54221ea5eaf99d38a53c11e4ea192815'
# Bounded local measured operation cost includes all admission and accounting.
t=time.process_time()
for k in range(5):run('overhead-%d'%k,['/bin/true'])
cost=(time.process_time()-t)/5;assert cost*253+8<60
packet=dict(PASS=True,at=time.time(),base='fab6e44b54221ea5eaf99d38a53c11e4ea192815',archiveSHA256=h.hexdigest(),archiveBytes=size,prefixSHA256=prefix.hexdigest(),remainingChunks=253,remainingBytes=4125714,manifestFiles=len(manifest),manifestSHA256=sha(r/'transfer-manifest.json'),mountFiles=len(files),commaFiles=[x for x in files if ',' in x],mountEnumerationSHA256=sha(r/'mount-enumeration.json'),argvSHA256=sha(r/'guest-poll-args.json'),startup='same executable/flags/environment/limits verified',captureCeiling=524288,generatedFileCeiling=12582912,captureOverflowRejected=True,legitimate2MiBFilePassed=True,measuredLocalCPUPerOperation=cost,predicted253CPU=cost*253,limits=pathlib.Path('/proc/self/limits').read_text(),admission=g.admission())
(e/'preflight.json').write_text(json.dumps(packet,indent=2)+'\n')
run('branch',['switch','-c','test/enigma-retained-prefix-guest-poll-runtime-oct30',packet['base']],True)
print(json.dumps(packet))
