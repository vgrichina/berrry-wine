from pathlib import Path
import hashlib,json,runpy,tempfile,unittest,threading,time,subprocess,sys
select=runpy.run_path(str(Path(__file__).with_name('native-runtime-generation.py')))['select']

def pin(name,data):
 return dict(path=name,size=len(data),sha256=hashlib.sha256(data).hexdigest())

class GenerationTests(unittest.TestCase):
 def exercise(self,mode):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);(root/'checker.py').write_bytes(b'new');(root/'helper.py').write_bytes(b'helper')
   original=pin('game',b'game');before=pin('checker.py',b'old');after=pin('checker.py',b'new')
   manifest=root/'history.json';manifest.write_text(json.dumps(dict(files=[original,before])))
   raw=manifest.read_bytes();kwargs=dict(historical_sha256=hashlib.sha256(raw).hexdigest(),protected_count=1,replacements=[dict(before=before,after=after)],additions=[pin('helper.py',b'helper')])
   if mode=='history':manifest.write_text('changed')
   if mode=='current':(root/'checker.py').write_bytes(b'changed')
   if mode=='protected':kwargs['replacements']=[dict(before=original,after=pin('game',b'new'))]
   if mode=='before':kwargs['replacements'][0]['before']=pin('checker.py',b'wrong')
   if mode=='duplicate':kwargs['additions']=[after]
   if mode=='provider':after['provider']=dict(git='stale',path='checker.py')
   if mode!='success':
    with self.assertRaises(ValueError):select(root,manifest,**kwargs)
    return
   result=select(root,manifest,**kwargs)
   self.assertEqual(manifest.read_bytes(),raw);self.assertEqual(result['files'],[original,after,pin('helper.py',b'helper')]);self.assertEqual(result['selectedGeneration']['historicalProviders'],2)
 def test_success(self):self.exercise('success')
 def test_history_changed(self):self.exercise('history')
 def test_current_changed(self):self.exercise('current')
 def test_protected(self):self.exercise('protected')
 def test_before_changed(self):self.exercise('before')
 def test_duplicate(self):self.exercise('duplicate')
 def test_old_provider_rejected(self):self.exercise('provider')
class ProvisionIntegration(unittest.TestCase):
 def test_normal_upload_content_queue_parent_and_failure_join(self):
  production=runpy.run_path(str(Path(__file__).with_name('native-runtime-provision.py')))['provision']
  barrier_source=Path(__file__).with_name('native-startup-barrier.py').read_bytes()
  for fail in (False,True):
   with self.subTest(fail=fail),tempfile.TemporaryDirectory() as d:
    base=Path(d);root=base/'inputs';remote_root=base/'uploaded';run=root/'scratch/runs/test'
    run.mkdir(parents=True);remote_run=remote_root/'scratch/runs/test';remote_run.mkdir(parents=True)
    (root/'tools').mkdir();(root/'tools/native-startup-barrier.py').write_bytes(barrier_source)
    (run/'driver.cjs').write_bytes(b"require('./dep.cjs');")
    (run/'dep.cjs').write_bytes(b'module.exports=1;')
    rows=[]
    for name in ['scratch/runs/test/driver.cjs','scratch/runs/test/dep.cjs','tools/native-startup-barrier.py']:
     row=pin(name,(root/name).read_bytes());row['source']=dict(kind='existing-path',path=name);rows.append(row)
    before=dict(rows[-1],sha256='0'*64)
    history=root/'historical.json';history.write_text(json.dumps(dict(files=[rows[0],rows[1],before])))
    selected=select(root,history,historical_sha256=hashlib.sha256(history.read_bytes()).hexdigest(),protected_count=2,replacements=[dict(before=before,after=rows[-1])])
    (run/'position-runtime-pins.json').write_text(json.dumps(selected))
    (run/'startup-contract.json').write_text(json.dumps(dict(required=[rows[0]['path']])))
    # Fresh real lock observation supplied by the already armed custodian.
    (remote_run/'custody-current.json').write_text(json.dumps(dict(lockHeld=True,subreaper=True,launched=False,at=time.time())))
    active=set();mutex=threading.Lock();finished=[];published=[]
    def upload(name,data):
     with mutex:active.add(name)
     try:
      time.sleep(.02 if name.endswith('dep.cjs') else .005)
      if fail and name.endswith('driver.cjs'):raise OSError('causal transfer failure')
      target=Path(name);target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
     finally:
      with mutex:active.remove(name);finished.append(name)
    def remote(label,code):
     with mutex:self.assertFalse(active)
     result=subprocess.run([sys.executable,'-c',code],capture_output=True,text=True)
     self.assertEqual(result.returncode,0,result.stderr)
     if label=='provision-verify-all-before-queue':published.append(label)
    if fail:
     with self.assertRaises(OSError):production(root,run,str(remote_root),upload,remote)
     self.assertFalse(active);self.assertEqual(len(finished),3);self.assertEqual(published,[])
     self.assertFalse((remote_run/'staging-verified.json').exists());continue
    production(root,run,str(remote_root),upload,remote)
    self.assertEqual(len(finished),4);self.assertEqual(len(published),1)
    barrier=runpy.run_path(str(remote_root/'tools/native-startup-barrier.py'))
    args=(remote_root,remote_run/'position-runtime-pins.json',remote_run/'staging-verified.json')
    barrier['require'](*args) # queue boundary
    request=remote_run/'launch-request.json';request.write_text('{}')
    barrier['require'](*args) # parent boundary
    # A same-size change after queue must refuse before parent consumption.
    (remote_run/'dep.cjs').write_bytes(b'x'*len(b'module.exports=1;'))
    with self.assertRaises(ValueError):
     barrier['require'](*args)
     request.rename(remote_run/'launch-consumed.json')
    self.assertTrue(request.exists());self.assertFalse((remote_run/'launch-consumed.json').exists())

if __name__=='__main__':unittest.main()
