"""New assignment policy; historical 180-second launches remain historical."""
import importlib.util,json,pathlib,tempfile,time,unittest,subprocess,sys,os
ROOT=pathlib.Path(__file__).resolve().parents[1]
s=importlib.util.spec_from_file_location('controller',ROOT/'tools/lmarbles-controller.py')
c=importlib.util.module_from_spec(s);s.loader.exec_module(c)
class Budget(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory(dir=ROOT/'scratch/runs');c.R=pathlib.Path(self.tmp.name)
 def tearDown(self):self.tmp.cleanup()
 def launch(self,deadline,cutoff,reserve):
  c.save('launch.json',dict(at=cutoff-1,deadline=deadline,gameplayCutoff=cutoff,reserveSeconds=reserve,inputPolicy=dict(gameFreshnessSeconds=5,menuFreshnessSeconds=30)))
 def test_300_capture_latches_and_never_reopens(self):
  now=time.time();self.launch(now+299,now-1,300)
  c.capture_phase();self.assertTrue(c.read('quit-phase.json')['irreversible'])
  with self.assertRaises(c.ReserveRejected):c.policy('gameplay',['keydown:39'])
  with self.assertRaises(c.ReserveRejected):c.policy('quit',['keydown:39'],route='leave-game')
  c.policy('quit',['keydown:27'],route='leave-game')
 def test_operation_cannot_borrow_reserve(self):
  now=time.time();self.launch(now+320,now+20,300)
  with self.assertRaises(c.ReserveRejected):c.policy('gameplay',['keydown:39'],operationEnd=now+21)
 def test_bad_reserve_refused(self):
  self.launch(time.time()+1000,time.time()+700,180)
  with self.assertRaises(AssertionError):c.reserve()
 def test_historical_policy_and_scene_freshness(self):
  now=time.time();self.launch(now+1000,now+820,180);c.reserve()
  for scene,seconds in [('game',5),('menu',30)]:
   c.save(scene+'-review.json',dict(scene=scene));self.assertEqual(c.freshness(scene),seconds)
  c.save('missing-review.json',{})
  with self.assertRaises(AssertionError):c.freshness('missing')
 def test_actual_3600_3620_prearm_and_waits(self):
  out=c.R
  recipe=dict(cwd=str(out),args=['node',str(ROOT/'test/fixtures/lmarbles-reserve-endpoint.js'),'--max-seconds=3600'],seconds=3600,watchdogGrace=20,reserveSeconds=300,completionSession=True,inputPolicy=dict(confirmationMs=500,physicalUpMs=1750,observationMs=3000,gameFreshnessSeconds=5,menuFreshnessSeconds=30))
  c.save('recipe.json',recipe)
  p=subprocess.Popen([sys.executable,'-B',str(ROOT/'tools/lmarbles-supervisor.py'),'durablewait',str(out)],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
  try:
   end=time.monotonic()+10
   endpoint=None
   while endpoint is None:
    self.assertLess(time.monotonic(),end)
    try:endpoint=c.read('fixture-endpoint.json')
    except (FileNotFoundError,json.JSONDecodeError):time.sleep(.01)
   launch=c.read('launch.json');armed=c.read('watchdog-armed.json');native=c.read('native-pid.json')
   self.assertEqual(armed['deadline']-launch['deadline'],20)
   self.assertEqual(launch['deadline']-launch['gameplayCutoff'],300)
   self.assertLess(armed['at'],native['at']);self.assertLess(launch['at'],native['at'])
   self.assertGreater(launch['deadline']-launch['at'],3590)
   self.assertLessEqual(launch['deadline']-launch['at'],3600)
   c.URL='http://127.0.0.1:'+str(endpoint['port'])+'/ctl'
  finally:
   if endpoint is not None:
    c.URL='http://127.0.0.1:'+str(endpoint['port'])+'/ctl'
    c.call(dict(action='quit'))
   else:c.save('cancel-request.json',dict(reason='synthetic test cleanup'))
   a,b=p.communicate(timeout=15)
   c.save('test-tool-wait.json',dict(exit=p.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=a.decode(),stderr=b.decode()))
  self.assertEqual(p.returncode,0)
  for name in ('native-wait.json','watchdog-wait.json','outer-child-wait.json','outer-wait.json'):
   w=c.read(name);self.assertEqual(w['exit'],0);self.assertTrue(w['actualWait'] and w['stdoutEOF'] and w['stderrEOF'])
  if os.environ.get('LMARBLES_BUDGET_TEST_OUT'):
   target=pathlib.Path(os.environ['LMARBLES_BUDGET_TEST_OUT']);target.mkdir()
   for f in out.glob('*.json'):(target/f.name).write_bytes(f.read_bytes())
if __name__=='__main__':unittest.main()
