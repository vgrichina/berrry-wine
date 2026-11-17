"""Reserve policy controls: no game state or input simulation."""
import importlib.util,pathlib,tempfile,time,json,unittest
from unittest.mock import patch
ROOT=pathlib.Path(__file__).resolve().parents[1]
s=importlib.util.spec_from_file_location('adapter',ROOT/'tools/lbreakout-controller.py')
a=importlib.util.module_from_spec(s);s.loader.exec_module(a)

class Reserve(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();a.c.R=pathlib.Path(self.tmp.name)
  a.c.save('launch.json',dict(at=100,deadline=1000))
 def tearDown(self):self.tmp.cleanup()
 def test_gameplay_cutoff_before_arm(self):
  with patch.object(a.time,'time',return_value=843):
   with self.assertRaisesRegex(AssertionError,'cutoff'):a.policy(['keydown:32'],'review',beforeArm=True)
 def test_irreversible_quit_and_exact_route(self):
  a.c.save('review-review.json',dict(quitRoute='leave-game'))
  with patch.object(a.time,'time',return_value=800):
   a.policy(['keydown:27'],'review','leave-game')
   with self.assertRaisesRegex(AssertionError,'Quit phase'):a.policy(['keydown:32'],'review')
   with self.assertRaisesRegex(AssertionError,'ordinary'):a.policy(['keydown:39'],'review','leave-game')
 def test_automatic_cutoff_is_irreversible(self):
  with patch.object(a.time,'time',return_value=850):
   with self.assertRaisesRegex(AssertionError,'Quit phase'):a.policy(['keydown:39'],'review')
  self.assertEqual(a.c.read('quit-phase.json')['cutoff'],850)
 def test_restart_is_not_an_allowed_gameplay_choice(self):
  with patch.object(a.time,'time',return_value=800):
   with self.assertRaisesRegex(AssertionError,'manual LBreakout'):a.policy(['keydown:78'],'review')
 def test_guard_deadline_and_crossing_rechecked(self):
  sent=[]
  def native(command,timeout=10):sent.append(command);return 'ok'
  def shared(*args,**kwargs):
   with patch.object(a.time,'time',return_value=849):
    a.c.call(dict(action='guarded-input',guard={'deadline':999999}))
   with patch.object(a.time,'time',return_value=851):
    a.c.call(dict(action='guarded-input',guard={'deadline':999999}))
  with patch.object(a.time,'time',return_value=800),patch.object(a.c,'call',native),patch.object(a.c,'pulse',shared):
   with self.assertRaisesRegex(AssertionError,'Quit phase'):a.pulse('once',['keydown:32'],120,'review','reviewed')
  self.assertEqual(len(sent),1);self.assertEqual(sent[0]['guard']['deadline'],850000)

if __name__=='__main__':unittest.main()
