import pathlib,json,hashlib,sys,resource
import owner133_ops as g
g.setup();r=g.ops.ROOT;o=g.OUT;e=g.ops.E
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
# Physical placeholder outside compact E, inside allocation. No denial receipt removed.
f=o/'disposable-raw-placeholder';f.write_bytes(b'x'*(2*1048576));a=g.admission();g.ops.check_evidence()
probe=e/'disposable-overflow';probe.write_bytes(b'x'*1048577)
try:g.ops.check_evidence()
except AssertionError:rejected=True
else:raise AssertionError('compact overflow accepted')
probe.unlink();before=a['allocated'];physical=f.stat().st_blocks*512;assert physical>=2*1048576;f.unlink();after=g.admission()['allocated'];assert before-after>=physical-16384
(e/'accounting-fixture.json').write_text(json.dumps(dict(rawOutsideCompactAccepted=True,rawPhysicallyCharged=physical,netAllocationReduction=before-after,compactOverflowRejected=rejected,placeholderRemoved=True)))
import shutil
node=shutil.which('node');assert node
rc,_=g.ops.run('node-startup',[node,'--max-old-space-size=512','-e',"console.log(JSON.stringify({node:process.execPath,limits:require('fs').readFileSync('/proc/self/limits','utf8'),heap:require('v8').getHeapStatistics().heap_size_limit}))"],cwd=r);assert rc==0
rc,_=g.ops.run('canonical-parser',[node,'--max-old-space-size=512',str(r/'check-config.cjs')],cwd=r);assert rc==0
manifest=json.loads((r/'transfer-manifest.json').read_text());mount=json.loads((r/'mount-enumeration.json').read_text());files=[x['target'] for x in manifest if x['target'].startswith('vfs/')];assert sorted(files)==sorted(mount['files']);comma=[x for x in files if ',' in x]
archive=json.loads((r/'archive.json').read_text());h=hashlib.sha256();n=0
for part in archive['parts']:
 with (r/part).open('rb') as f:
  while b:=f.read(65536):h.update(b);n+=len(b)
assert n==archive['bytes'] and h.hexdigest()==archive['sha256']
runner=r/'input-source/runner__test__run.js';assert sha(runner)=='55be42cbcaedee9d7f56f578cd7d36841bba86861b38bf5d61a7a0415a880c2e'
# Inspect exact archived pins streaming, without materializing the archive or source.
import tarfile,io
class Parts(io.RawIOBase):
 def __init__(self):self.parts=iter(archive['parts']);self.f=None
 def readable(self):return True
 def readinto(self,b):
  while True:
   if self.f is None:
    try:self.f=(r/next(self.parts)).open('rb')
    except StopIteration:return 0
   n=self.f.readinto(b)
   if n:return n
   self.f.close();self.f=None
expected={x['target']:x for x in manifest};checked=0
with tarfile.open(fileobj=io.BufferedReader(Parts()),mode='r|gz') as t:
 for m in t:
  if not m.isfile():continue
  name=m.name.removeprefix('./');p=expected[name];h=hashlib.sha256();f=t.extractfile(m)
  while b:=f.read(65536):h.update(b)
  assert h.hexdigest()==p['sha256'] and m.size==p['bytes'];checked+=1
  if name=='runner/lib/vfs-host-files.js':
   # Small canonical consumer needed for comma-bearing tree fixture, never printed.
   pass
assert checked==len(manifest)==2663
with tarfile.open(fileobj=io.BufferedReader(Parts()),mode='r|gz') as t:
 for m in t:
  if m.name.removeprefix('./')=='runner/lib/vfs-host-files.js':
   (r/'canonical-vfs-host-files.cjs').write_bytes(t.extractfile(m).read());break
fixture=r/'comma-tree-fixture';fixture.mkdir(exist_ok=True);(fixture/'comma,name.txt').write_text('fixture')
code="const assert=require('assert'),fs=require('fs');const m=require(process.argv[1]);const rows=m.expandIncludePatterns(process.argv[2],['**/*']);assert.equal(rows.length,1);assert(rows[0].hostPath.endsWith('/comma,name.txt'));assert(rows[0].guestPath.includes('comma,name.txt'));console.log(JSON.stringify({PASS:true,rows}));"
rc,_=g.ops.run('comma-tree-consumer',[node,'--max-old-space-size=512','-e',code,str(r/'canonical-vfs-host-files.cjs'),str(fixture)],cwd=r);assert rc==0
(fixture/'comma,name.txt').unlink();fixture.rmdir()

packet=dict(PASS=True,archive=archive,rowsChecked=checked,mount=dict(path=str(r/'mount-enumeration.json'),sha256=sha(r/'mount-enumeration.json'),files=len(files),commaCount=len(comma),commaSample=comma[:2]),manifest=dict(path=str(r/'transfer-manifest.json'),sha256=sha(r/'transfer-manifest.json')),runnerSHA256=sha(runner),argv=json.loads((r/'progression-args.json').read_text()),argvSHA256=sha(r/'progression-args.json'),module=expected['modules/wine-assembly.wasm'],traceDiagnosis=dict(path='/home/user/wine-assembly/scratch/usage-watch/enigma-start-game-causal-repair-owner133-oct30/trace-reproducer-fixed.stdout'),admission=g.admission(),standingArchiveCounted=True,remainingGrowthIncludes='raw launcher logs, transport ledger, PNG collection, Git publication; no duplicated archive')
(e/'preflight.json').write_text(json.dumps(packet,indent=2));g.admission();print(json.dumps(dict(PASS=True,rows=checked,commaFiles=len(comma),admission=packet['admission'])))
