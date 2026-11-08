from pathlib import Path
import unittest, tempfile, hashlib, copy
from runtime_helper_closure import relocate, validate
class ClosureTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);self.root=Path(self.tmp.name)
  for folder in ['scratch/runs/old','scratch/runs/new','tools']:(self.root/folder).mkdir(parents=True,exist_ok=True)
  self.old='scratch/runs/old';self.new='scratch/runs/new'
  for folder in [self.old,self.new]:
   (self.root/folder/'launch.py').write_text('answer=42\n')
   (self.root/folder/'bound.cjs').write_text("require('../../../tools/keys.cjs');\n")
  (self.root/'tools/keys.cjs').write_text("module.exports={};\n")
  self.pins=dict(files=[self.pin(self.old+'/launch.py'),self.pin(self.old+'/bound.cjs'),self.pin('tools/keys.cjs')])
 def pin(self,n):
  b=(self.root/n).read_bytes();return dict(path=n,size=len(b),sha256=hashlib.sha256(b).hexdigest(),source=dict(kind='existing-path',path=n))
 def repair(self):return relocate(self.pins,self.root,self.root/self.old,self.root/self.new)
 def check(self,p):return validate(p,self.root,self.root/self.new,['launch.py','bound.cjs'],[self.old])
 def test_actual_baseline_absolute_prefix_misses_every_helper(self):
  old_absolute=str(self.root/self.old)
  self.assertFalse(any(p['path'].startswith(old_absolute+'/') for p in self.pins['files']))
  with self.assertRaisesRegex(AssertionError,'stale helper target'):self.check(self.pins)
 def test_absolute_and_relative_roots_produce_same_correct_plan(self):
  self.assertEqual(self.repair(),relocate(self.pins,self.root,self.old,self.new));self.assertTrue(self.check(self.repair())['passed'])
 def test_missing_conditional_requires_explicit_inactive_environment(self):
  b=self.root/self.new/'bound.cjs';b.write_text("const fixture=process.env.FIXTURE?require('./generated.cjs'):undefined;\n")
  p=self.repair()
  with self.assertRaisesRegex(AssertionError,'unprovisioned'):self.check(p)
  with self.assertRaisesRegex(AssertionError,'unprovisioned'):validate(p,self.root,self.new,['bound.cjs'],[self.old],runtime_environment={'FIXTURE':'1'})
  self.assertTrue(validate(p,self.root,self.new,['bound.cjs'],[self.old],runtime_environment={'FIXTURE':''})['passed'])
 def test_inactive_guard_cannot_cover_another_import(self):
  samples=[
   "require('./missing.cjs');\nconst fixture=process.env.FIXTURE?require('./missing.cjs'):undefined;\n",
   "const fixture=process.env.FIXTURE?require('./missing.cjs'):undefined;\nrequire('./missing.cjs');\n",
   "const fixture=process.env.FIXTURE?require('./missing.cjs'):require('./missing.cjs');\n",
   "const fixture=process.env.FIXTURE?require('./missing.cjs'):undefined;require('./missing.cjs');\n",
  ]
  for source in samples:
   with self.subTest(source=source):
    (self.root/self.new/'bound.cjs').write_text(source)
    with self.assertRaisesRegex(AssertionError,'unprovisioned'):
     validate(self.repair(),self.root,self.new,['bound.cjs'],[self.old],runtime_environment={'FIXTURE':''})
 def test_guard_must_control_the_exact_import_expression(self):
  samples=[
   "const fixture=true || process.env.FIXTURE?require('./missing.cjs'):undefined;\n",
   "const fixture=true ||\nprocess.env.FIXTURE?require('./missing.cjs'):undefined;\n",
   "// ;process.env.FIXTURE?\nrequire('./missing.cjs');\n",
   "const fixture=process.env.FIXTURE?'yes':require('./missing.cjs');\n",
   "const fixture=process.env.FIXTURE?require('./missing.cjs'):undefined;\n// process.env.FIXTURE?require('./missing.cjs')\nrequire('./missing.cjs');\n",
  ]
  for source in samples:
   with self.subTest(source=source):
    (self.root/self.new/'bound.cjs').write_text(source)
    with self.assertRaisesRegex(AssertionError,'unprovisioned'):
     validate(self.repair(),self.root,self.new,['bound.cjs'],[self.old],runtime_environment={'FIXTURE':''})
 def test_missing_launcher_refused_before_side_effects(self):
  p=self.repair();p['files']=[v for v in p['files'] if not v['path'].endswith('launch.py')]
  with self.assertRaisesRegex(AssertionError,'missing physical'):self.check(p)
 def test_shared_key_dependency_required(self):
  p=self.repair();p['files']=[v for v in p['files'] if not v['path'].startswith('tools/')]
  with self.assertRaisesRegex(AssertionError,'unprovisioned helper dependency'):self.check(p)
 def test_changed_physical_bytes_refused(self):
  p=self.repair();(self.root/self.new/'launch.py').write_text('answer=43\n')
  with self.assertRaisesRegex(AssertionError,'physical hash mismatch'):self.check(p)
 def test_read_upload_path_mismatch_refused(self):
  p=self.repair();p['files'][0]['source']['path']=self.old+'/launch.py'
  with self.assertRaisesRegex(AssertionError,'read/upload'):self.check(p)
 def test_duplicate_target_refused(self):
  p=self.repair();p['files'].append(copy.deepcopy(p['files'][0]))
  with self.assertRaisesRegex(AssertionError,'duplicate'):self.check(p)
 def test_repository_escape_refused(self):
  p=self.repair();p['files'][0]['path']='../escape.py'
  with self.assertRaises(ValueError):self.check(p)
 def test_no_matching_source_refused(self):
  with self.assertRaisesRegex(AssertionError,'no predecessor'):relocate(self.pins,self.root,'absent',self.new)
if __name__=='__main__':unittest.main(verbosity=2)
