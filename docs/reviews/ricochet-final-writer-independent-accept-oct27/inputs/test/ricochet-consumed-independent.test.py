"""Independent acceptance: pinned donor imports; no guest, network or repairs.

Run with python3 -S PATH [Independent.test_NAME]. Set RICOCHET_ACCEPT_OPS
to an owned evidence directory when retaining per-case diagnostics.
"""
import hashlib,importlib.util,json,os,pathlib,runpy,shlex,sys,tempfile,time,types,unittest
from unittest import mock

D=pathlib.Path('/tmp/ricochet-consumed-control-accounting-repair-oct27/repo')
O=pathlib.Path(os.environ.get('RICOCHET_ACCEPT_OPS','/tmp/ricochet-consumed-accounting-independent-accept-oct27/ops'))
SOURCE=D/'docs/reviews/ricochet-measured-cpu-round-gameplay-oct27/remote-tools/remote-supervisor.py'
HELPER=D/'tools/ricochet/runtime-accounting.py'
TRUSTED=SOURCE.parent/'trusted-supervisor.py'
RECIPE=D/'docs/reviews/ricochet-consumed-control-accounting-repair-oct27/integrate.py'
PINS={SOURCE:'eebc983956aa092b71a527f41f5516c51376c1acf19872cb808025833953ba63',HELPER:'857e30508c1e4db1c943b765a0e7551842973032cc5431eb08235dabda903364',TRUSTED:'9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85',RECIPE:'9e41b139b423154a663e96a3f8e5617b65812c89a0d2e38f97ec7d025d76251b'}
for p,h in PINS.items():assert hashlib.sha256(p.read_bytes()).hexdigest()==h,(p,h)
def load(n,p):
 s=importlib.util.spec_from_file_location(n,p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
A=load('independent_accounting',HELPER);I=load('independent_recipe',RECIPE);S=load('independent_supervisor',TRUSTED)
MIB=1048576

class Independent(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory(dir=O,prefix='fixture-');self.addCleanup(self.tmp.cleanup)
  self.h=pathlib.Path(self.tmp.name);self.serial=self.h/'serial';self.serial.mkdir();self.c=self.serial/'continue.json';self.r=self.h/'retained';self.r.write_bytes(b'retained')
 def ledger(self,**kw):return A.RuntimeAccounting([self.h],ephemeral_files={self.c:24*MIB},ceiling=kw.pop('ceiling',256*MIB),**kw)
 def save(self,name,j):(O/(name+'.json')).write_text(json.dumps(j,indent=2,default=str))
 def rejects(self,ledger):
  with self.assertRaises((A.AccountingError,OSError)):ledger.sample()
  self.assertIsNone(ledger.receipt['lastBytes'])
 def test_01_complete_production_remaining_consumption_windows(self):
  for phase in ('after-open','final-path-stat'):
   with self.subTest(phase=phase):
    h=self.h/phase;h.mkdir();(h/'serial').mkdir();c=h/'serial/continue.json';c.write_text('{}');other=self.h/(phase+'-other');other.mkdir()
    for p in (HELPER,TRUSTED):(h/p.name).write_bytes(p.read_bytes())
    (h/'remote-child.py').write_text('import sys;assert sys.argv[1]=="guest"\n')
    pins={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in h.iterdir() if p.is_file()}
    runner=h/'remote-supervisor.py';b=I.transform(SOURCE.read_bytes(),pins,str(other));runner.write_bytes(b)
    realopen=os.open;realstat=os.stat;hits=[];consumed=[]
    def opening(name,*a,**kw):
     fd=realopen(name,*a,**kw)
     if phase=='after-open' and name=='continue.json' and kw.get('dir_fd') is not None and not consumed:c.unlink();consumed.append(str(c))
     return fd
    def stating(name,*a,**kw):
     if phase=='final-path-stat' and name=='continue.json' and kw.get('dir_fd') is not None and not consumed:
      hits.append(1)
      if len(hits)==2:c.unlink();consumed.append(str(c))
     return realstat(name,*a,**kw)
    with mock.patch.object(os,'open',opening),mock.patch.object(os,'stat',stating),mock.patch.object(sys,'argv',[str(runner),'guest']),mock.patch.dict(os.environ),mock.patch.object(time,'time',return_value=0):runpy.run_path(str(runner),run_name='__main__')
    receipt=json.loads((h/'guest/supervision.json').read_text());self.save('production-'+phase,dict(sourceSHA=PINS[SOURCE],transformSHA=hashlib.sha256(b).hexdigest(),manifest=pins,consumed=consumed,supervision=receipt))
    self.assertEqual(consumed,[str(c)]);self.assertEqual(receipt['exit'],0);self.assertIsNone(receipt['stopReason']);self.assertTrue(receipt['cleanupComplete']);self.assertGreaterEqual(receipt['accounting']['lastBytes'],24*MIB)
    for pid,start in receipt['owned']:
     row=S.snapshot().get(pid);self.assertTrue(row is None or row['start']!=start)
 def test_02_full_reserve_absent_and_open_unlinked(self):
  l=self.ledger();absent=l.sample()['bytes'];self.assertGreaterEqual(absent,24*MIB)
  self.c.write_text('{}');self.assertEqual(absent,l.sample()['bytes']);fd=os.open(self.c,os.O_RDONLY);self.addCleanup(os.close,fd);self.c.unlink();self.assertEqual(os.fstat(fd).st_nlink,0);self.assertEqual(absent,l.sample()['bytes'])
 def test_03_reserve_inside_existing_256_mib_ceiling(self):
  l=self.ledger();l.sample()
  for i in range(11):
   with (self.h/('sparse-%02d'%i)).open('wb') as f:f.truncate(23*MIB)
  self.rejects(l);self.assertGreater(l.receipt['peakBytes'],256*MIB)
 def test_04_unknown_disappearance_and_path_replacement(self):
  l=self.ledger();l.sample();p=self.h/'replacement';p.write_bytes(b'new');p.replace(self.r);self.rejects(l)
  l=self.ledger();l.sample();self.r.unlink();self.rejects(l)
 def test_05_late_links_before_descriptor_validation(self):
  for kind in ('symlink','hardlink'):
   with self.subTest(kind=kind):
    self.c.write_text('{}');l=self.ledger();real=os.stat;hits=[]
    def racing(name,*a,**kw):
     if name=='continue.json' and kw.get('dir_fd') is not None:
      hits.append(1)
      if len(hits)==2:
       self.c.unlink()
       if kind=='symlink':self.c.symlink_to(self.r)
       else:os.link(self.r,self.c)
     return real(name,*a,**kw)
    try:
     with mock.patch.object(os,'stat',racing):self.rejects(l)
    finally:self.c.unlink()
 def test_06_immutable_mutation_and_no_partial_live_growth(self):
  l=self.ledger(immutable_files={self.r:hashlib.sha256(self.r.read_bytes()).hexdigest()});l.sample();self.r.write_bytes(b'changed!');self.rejects(l)
  l=self.ledger(ceiling=24*MIB+65536);l.sample()
  with self.r.open('wb') as f:f.truncate(MIB)
  self.rejects(l);self.assertGreater(l.receipt['peakBytes'],l.ceiling)
 def test_07_mandatory_root_identity(self):
  l=self.ledger();m=self.h.parent/(self.h.name+'-moved');self.h.rename(m);self.h.mkdir()
  try:self.rejects(l)
  finally:self.h.rmdir();m.rename(self.h)
 def test_08_failure_cleans_owned_descendants_by_pid_start(self):
  l=self.ledger(ceiling=24*MIB+65536);l.sample();out=O/'cleanup.stdout';err=O/'cleanup.stderr'
  code='import pathlib,subprocess,sys,time;subprocess.Popen([sys.executable,"-S","-c","import time;time.sleep(5)"]);time.sleep(.1);pathlib.Path(sys.argv[1]).write_bytes(b"x"*131072);time.sleep(5)'
  cmd=['bash','-c','exec "$@" >"'+str(out)+'" 2>"'+str(err)+'"','capture',sys.executable,'-S','-c',code,str(self.r)]
  def check():
   if self.r.stat().st_size>65536:l.sample()
  receipt=S.supervise(cmd,rss_limit=96*MIB,wall_limit=3,cpu_limit=3,output_limit=2*MIB,check=check);self.save('cleanup-supervision',dict(argv=cmd,supervision=receipt,ledger=l.receipt))
  self.assertIn('runtime storage ceiling',receipt['stopReason']);self.assertTrue(receipt['cleanupComplete']);self.assertGreaterEqual(len(receipt['owned']),2)
  for pid,start in receipt['owned']:
   row=S.snapshot().get(pid);self.assertTrue(row is None or row['start']!=start)
 def test_09_rejecting_mutation_controls(self):
  # Disable each security property in an in-memory mutant. The independent
  # observable invariant must fail; no production source file is edited.
  source=HELPER.read_text()
  mutations=[('reservation',"self._charge(sum(self.ephemeral.values()))","self._charge(0)"),('ceiling',"if self.total > self.ceiling:","if False:"),('immutable',"if h.hexdigest() != self.immutable[p]:","if False:")]
  killed=[]
  for name,old,new in mutations:
   self.assertEqual(source.count(old),1);mod=types.ModuleType('mutant');exec(compile(source.replace(old,new),'<rejecting-mutant-'+name+'>','exec'),mod.__dict__)
   l=mod.RuntimeAccounting([self.h],ephemeral_files={self.c:24*MIB},ceiling=24*MIB+65536,immutable_files={self.r:hashlib.sha256(self.r.read_bytes()).hexdigest()} if name=='immutable' else {})
   if name=='reservation':self.assertLess(l.sample()['bytes'],24*MIB)
   elif name=='ceiling':
    with self.r.open('wb') as f:f.truncate(MIB)
    self.assertGreater(l.sample()['bytes'],l.ceiling)
   else:
    self.r.write_bytes(b'mutated');self.assertIsInstance(l.sample(),dict)
   self.r.write_bytes(b'retained');killed.append(name)
  self.save('mutation-controls',dict(killed=killed))
 def test_10_final_inventory_link_swap_must_reject(self):
  # A real replacement after descriptor validation, immediately before the
  # final directory enumeration. Keep the assertion strict: accepting a
  # symlink/hardlink at this boundary is a rejection of the candidate.
  for kind in ('symlink','hardlink'):
   with self.subTest(kind=kind):
    self.c.write_text('{}');l=self.ledger();real=os.scandir;hits=[];swaps=[]
    def racing(fd):
     if isinstance(fd,int) and os.readlink('/proc/self/fd/'+str(fd))==str(self.serial):
      hits.append(1)
      if len(hits)==2:
       self.c.unlink()
       if kind=='symlink':self.c.symlink_to(self.r)
       else:os.link(self.r,self.c)
       swaps.append(kind)
     return real(fd)
    try:
     accepted=None;error=None
     with mock.patch.object(os,'scandir',racing):
      try:accepted=l.sample()
      except (A.AccountingError,OSError) as e:error=repr(e)
     diagnostic=None if accepted is None else dict(bytes=accepted['bytes'],sizes={str(p):n for p,n in accepted['sizes'].items()})
     self.save('late-final-'+kind,dict(swaps=swaps,accepted=diagnostic,error=error,receipt=l.receipt,controlMode=self.c.lstat().st_mode,controlLinks=self.c.lstat().st_nlink))
     self.assertEqual(swaps,[kind]);self.assertIsNone(accepted,'unsafe late '+kind+' swap returned accepted inventory');self.assertIsNotNone(error)
    finally:self.c.unlink()
 def test_11_actual_api_publisher_must_preserve_single_regular_file(self):
  p=pathlib.Path('/tmp/ricochet-measured-cpu-round-gameplay-oct27/repo/docs/reviews/ricochet-measured-cpu-round-gameplay-oct27/evidence/api-1793092841347248549-command.json')
  raw=p.read_bytes();self.assertEqual(hashlib.sha256(raw).hexdigest(),'3bf575e52d3c835489387129056fe69f33c1019f90fa8f0bd380429cf56ff8ff')
  saved=json.loads(raw);argv=shlex.split(saved['argv'][-1]);self.assertEqual(argv[:2],['python3','-c'])
  # Execute only the unchanged publication prefix; omit API polling entirely.
  prefix=argv[2].split(';end=time.monotonic()+30')[0];self.assertIn('p.write_text(json.dumps(j))',prefix)
  realpath=pathlib.Path;realwrite=pathlib.Path.write_text;swaps=[]
  def path(value):return self.h if value=='/tmp/ricochet-measured-cpu-round-gameplay-oct27' else realpath(value)
  def write(target,*a,**kw):
   if target==self.c:
    self.c.symlink_to(self.r);swaps.append('symlink between exists and publication')
   return realwrite(target,*a,**kw)
  before=self.r.read_bytes()
  with mock.patch.object(pathlib,'Path',path),mock.patch.object(realpath,'write_text',write):exec(compile(prefix,'<exact-api-publication-prefix>','exec'),{})
  self.save('publisher-contract',dict(source=str(p),sourceSHA256=hashlib.sha256(raw).hexdigest(),prefix=prefix,prefixSHA256=hashlib.sha256(prefix.encode()).hexdigest(),swaps=swaps,symlinkAtReturn=self.c.is_symlink(),retainedChanged=self.r.read_bytes()!=before,recordedLimitsScope='local API client, not proof of remote writer inherited limits',missing=['single-outstanding atomic publication','regular single-link no-follow enforcement','logical AND allocated <=24MiB before publication','remote writer RLIMIT_FSIZE <=24MiB wiring']))
  self.assertEqual(len(swaps),1);self.assertEqual(self.r.read_bytes(),before,'exact API writer followed raced control symlink and overwrote retained file')

if __name__=='__main__':unittest.main(verbosity=2)
