"""Exercise physical rejection through the actual provisioning side-effect path."""
from pathlib import Path
import hashlib,json,runpy,tempfile,unittest,threading,time
provision=runpy.run_path(str(Path(__file__).with_name('native-runtime-provision.py')))['provision']

class ProvisionTests(unittest.TestCase):
 def stage(self,source,extra=None,corrupt=False,missing_required=False,fail_upload=False):
  with tempfile.TemporaryDirectory(prefix='native-provision-test-') as d:
   root=Path(d);run=root/'scratch/runs/test';run.mkdir(parents=True);events=[];files={'driver.cjs':source}
   if extra is not None:files['dep.cjs']=extra
   pins=[]
   for name,data in files.items():
    b=data.encode();path=run/name;path.write_bytes(b);rel=path.relative_to(root).as_posix();pins.append(dict(path=rel,size=len(b),sha256=hashlib.sha256(b).hexdigest(),source=dict(kind='existing-path',path=rel)))
   (run/'position-runtime-pins.json').write_text(json.dumps(dict(files=pins)))
   required=[pins[0]['path']]+(['scratch/runs/test/absent.py'] if missing_required else [])
   (run/'startup-contract.json').write_text(json.dumps(dict(required=required)))
   if corrupt:(run/'driver.cjs').write_text('changed')
   active=set();lock=threading.Lock()
   def upload(path,data):
    with lock:active.add(path);events.append(('upload',path))
    try:
     time.sleep(.005)
     if fail_upload and path.endswith('driver.cjs'):raise OSError('failed transfer')
    finally:
     with lock:active.remove(path)
   def remote(name,code):
    with lock:
     self.assertFalse(active)
     events.append(('remote',name))
    return dict(passed=True)
   try:provision(root,run,'/remote',upload,remote)
   except (AssertionError,OSError) as e:return events,str(e)
   return events,None
 def test_unconditional_missing(self):
  events,error=self.stage("require('./absent.cjs');")
  self.assertIn('unprovisioned helper dependency',error);self.assertEqual(events,[])
 def test_exact_call_exemption(self):
  events,error=self.stage("const x=process.env.SNAPSHOT_BASELINE ? require('./absent.cjs') : null;require('./absent.cjs');")
  self.assertIn('unprovisioned helper dependency',error);self.assertEqual(events,[])
 def test_supported_inactive(self):
  events,error=self.stage("const x=process.env.SNAPSHOT_BASELINE ? require('./absent.cjs') : null;")
  self.assertIsNone(error);self.assertEqual(events[-1],('remote','provision-verify-all-before-queue'))
 def test_unsupported_inactive(self):
  events,error=self.stage("const x=(process.env.SNAPSHOT_BASELINE || true) ? require('./absent.cjs') : null;")
  self.assertIsNotNone(error);self.assertEqual(events,[])
 def test_present_dependency_and_join(self):
  events,error=self.stage("require('./dep.cjs');",'module.exports=1;')
  self.assertIsNone(error);self.assertEqual(len([x for x in events if x[0]=='upload']),3);self.assertEqual(events[-1],('remote','provision-verify-all-before-queue'))
 def test_hash_mismatch(self):
  events,error=self.stage('module.exports=1;',corrupt=True)
  self.assertIn('physical hash mismatch',error);self.assertEqual(events,[])
 def test_contract_missing(self):
  events,error=self.stage('module.exports=1;',missing_required=True)
  self.assertIn('startup contract dependency',error);self.assertEqual(events,[])
 def test_failed_upload_never_publishes(self):
  events,error=self.stage("require('./dep.cjs');",'module.exports=1;',fail_upload=True)
  self.assertIn('failed transfer',error);self.assertNotIn(('remote','provision-verify-all-before-queue'),events)
if __name__=='__main__':unittest.main()
