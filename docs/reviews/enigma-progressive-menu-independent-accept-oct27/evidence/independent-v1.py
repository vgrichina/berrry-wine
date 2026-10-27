import hashlib, inspect, json, os, pathlib, struct, sys, tempfile, textwrap, unittest
from unittest.mock import patch
BASE=pathlib.Path('/tmp/enigma-progressive-menu-independent-accept-oct27')
REPO=BASE/'repo'; OPS=BASE/'ops'
sys.path.insert(0,str(REPO/'test/fixtures/enigma-controller'))
import test_controller as f
from test_supervised import SupervisedTests
os.environ['ENIGMA_SUPERVISED_EVIDENCE']=str(OPS/'independent-evidence')
OBS=[]

class ProductionAdversaries(unittest.TestCase):
    setUp=SupervisedTests.setUp
    cleanup=SupervisedTests.cleanup
    config=SupervisedTests.config
    launch=SupervisedTests.launch
    finish=SupervisedTests.finish
    wire=SupervisedTests.wire
    cleaned=SupervisedTests.cleaned
    def test_serial_approval_and_ack_rejections(self):
        source=(REPO/'test/fixtures/enigma-controller/child_server.py').read_text()
        cases={
          'partial-ack':("v = dict(ran=c['n'],steps=c['n'],batch=batch,frozen=True)","v = dict(ran=c['n'],steps=0,batch=batch,frozen=True)"),
          'duplicate-ack':("v = dict(ran=c['n'],steps=c['n'],batch=batch,frozen=True)","v = dict(ran=c['n'],steps=c['n'],batch=batch-c['n'],frozen=True)"),
          'wrong-batch':("v = dict(ran=c['n'],steps=c['n'],batch=batch,frozen=True)","v = dict(ran=c['n'],steps=c['n'],batch=batch+1,frozen=True)"),
          'wrong-frozen':("frozen=dict(frozen=True,credits=credits,recording=False)","frozen=dict(frozen=True,credits=1 if batch else 0,recording=False)"),
          'wrong-dimensions':("640,480,8,2,0,0,0", "641,480,8,2,0,0,0"),
          'stale-hash':("frameSHA256=hashlib.sha256(image).hexdigest()", "frameSHA256='0'*64"),
          'wrong-review-batch':("batch=batch,x=10,y=20", "batch=batch+1,x=10,y=20"),
          'missing-review':("safeStartGame=True,reviewed=True", "safeStartGame=True,reviewed=False"),
        }
        for name,(old,new) in cases.items():
            with self.subTest(name=name):
                d,c=self.config(name,fault='loading-review',max_captures=3)
                child=d/'controlled-child.py'
                assert source.count(old)==1,(name,source.count(old))
                child.write_text(source.replace(old,new))
                c['command'][1]=str(child)
                result=self.finish(self.launch(d,c),d)
                self.assertEqual(result['exit'],1,result)
                wire=self.wire(d)
                self.assertFalse(any('cmd' in r['command'] for r in wire),wire)
                self.assertNotEqual(wire[-1]['command'].get('action'),'quit',wire)
                self.assertLessEqual(sum(r['command'].get('action')=='step' for r in wire),2)
                self.cleaned(d)
                OBS.append(dict(case=name,exit=result['exit'],commands=[r['command'] for r in wire]))

    def test_repeated_full_size_loading_never_grants_input(self):
        d,c=self.config('repeat',fault='never-ready',max_captures=5)
        result=self.finish(self.launch(d,c),d)
        self.assertEqual(result['exit'],0,result)
        wire=self.wire(d)
        self.assertFalse(any('cmd' in r['command'] for r in wire))
        images=list((d/'launch/controller').glob('menu-candidate*.png'))
        self.assertEqual(len(images),4)
        self.assertEqual(len({hashlib.sha256(p.read_bytes()).hexdigest() for p in images}),1)
        self.assertEqual(wire[-1]['command'],{'action':'quit'})
        self.assertEqual(json.loads((d/'launch/controller/outcome.json').read_text())['status'],
                         'LOADING_REVIEWED_RESERVE_STOP_NO_INPUT')
        for p in images:self.assertEqual(struct.unpack('>II',p.read_bytes()[16:24]),(640,480))
        self.cleaned(d)
        OBS.append(dict(case='repeat-loading',captures=len(images),inputCount=0,cleanup='transport quit only'))

class IndependentBudgets(unittest.TestCase):
    def scenario(self,mode):
        with f.FakeProduction() as fake,tempfile.TemporaryDirectory(dir=OPS) as tmp:
            root=pathlib.Path(tmp);decision=root/'decision.json'; frames=[];used=[]
            config=fake.config(root,max_captures=5,decision_path=str(decision),review_seconds=.15,
                               checkpoint_batches=256)
            def capture(path,batch,raw):
                frames.append(batch)
                row=dict(reviewed=True,frameSHA256=hashlib.sha256(raw).hexdigest(),batch=batch,
                         continueLoading=True)
                if mode=='old-approval' and len(frames)>1:return
                if len(frames)==2:
                    if mode=='hash':row.update(frameSHA256='0'*64,safeStartGame=True,continueLoading=False,x=1,y=1)
                    if mode=='batch':row.update(batch=frames[0],safeStartGame=True,continueLoading=False,x=1,y=1)
                    if mode=='cpu':config['test_cpu_left']=.01
                    if mode=='api':driver.api_bytes=driver.progress['api_bytes']-100000
                    if mode=='bytes':driver.capture_bytes=driver.progress['capture_total_bytes']-config['capture_bytes']
                    if mode=='wall':fake.now=config['deadline_at']-.01
                    if mode=='review':
                        decision.unlink(missing_ok=True);return
                decision.write_text(json.dumps(row))
            fake.on_capture=capture
            driver=f.scheduler_unit_controller(config,clock=lambda:fake.now,
                sleep=lambda n:(used.append(n),setattr(fake,'now',fake.now+n)))
            start=config['started_at'];deadline=config['deadline_at']
            status=driver.run()
            self.assertFalse(any('cmd' in c for c in fake.commands),(mode,status,fake.commands))
            self.assertEqual(config['started_at'],start);self.assertEqual(config['deadline_at'],deadline)
            self.assertLessEqual(driver.review_used,.151)
            if mode in ('hash','batch','wall'):
                self.assertTrue(driver.failed,(mode,status))
                self.assertNotEqual(fake.commands[-1].get('action'),'quit')
            else:
                self.assertFalse(driver.failed,(mode,status))
                self.assertEqual(fake.commands[-1],{'action':'quit'})
            if mode in ('cpu','api','bytes','old-approval','review'):self.assertEqual(len(frames),2)
            self.assertLessEqual(driver.captures,config['max_captures']-1)
            self.assertLessEqual(driver.api_bytes,driver.progress['api_bytes'])
            self.assertGreater(driver.api_bytes,0)
            OBS.append(dict(case='budget-'+mode,status=status,frames=frames,reviewSeconds=driver.review_used,
                apiBytes=driver.api_bytes,captureBytes=driver.capture_bytes,commands=fake.commands))

    def test_cumulative_limits_and_new_frame_binding(self):
        for mode in ('hash','batch','cpu','api','bytes','wall','old-approval','review'):
            with self.subTest(mode=mode):self.scenario(mode)

class GuardMutations(unittest.TestCase):
    def test_new_approval_cpu_api_capture_guards_are_sensitive(self):
        # Mutations live only in this test process; candidate files stay pinned.
        cases=[('review','decision.get(\'frameSHA256\') == frame[\'sha256\']','True','hash'),
               ('review',"decision['batch'] == self.batch",'True','batch'),
               ('drive',"self.owner.budget()['cpu_left'] < self.progress['cpu_reserve'] + 2*rt",'False','cpu'),
               ('drive','not self.api_room(10)','False','api'),
               ('drive',"self.capture_bytes + 2*c['capture_bytes'] > self.progress['capture_total_bytes']",'False','bytes')]
        for method,old,new,mode in cases:
            with self.subTest(method=method,mode=mode):
                original=getattr(f.ctl.Controller,method)
                source=textwrap.dedent(inspect.getsource(original));self.assertEqual(source.count(old),1)
                env=dict(vars(f.ctl));exec(compile(source.replace(old,new),'<independent rejecting mutation>','exec'),env)
                with patch.object(f.ctl.Controller,method,env[method]):
                    with self.assertRaises(AssertionError):IndependentBudgets().scenario(mode)
                OBS.append(dict(case='mutation-'+mode,rejected=True,method=method,removed=old))

if __name__=='__main__':
    names=sys.argv[1:] or ['ProductionAdversaries','IndependentBudgets','GuardMutations']
    suite=unittest.TestSuite(unittest.defaultTestLoader.loadTestsFromName(n,sys.modules[__name__]) for n in names)
    r=unittest.TextTestRunner(verbosity=2).run(suite)
    (OPS/('independent-'+names[0]+'.json')).write_text(json.dumps(dict(success=r.wasSuccessful(),testsRun=r.testsRun,observations=OBS),indent=2))
    raise SystemExit(not r.wasSuccessful())
