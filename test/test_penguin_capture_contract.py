"""Bounded offline tests; never invokes Node, a guest, network, or Boat."""
import base64
import importlib.util
import json
import os
from pathlib import Path
import resource
import subprocess
import sys
import tempfile
import unittest
import zlib

MODULE = Path(__file__).resolve().parents[1] / 'tools/penguin_capture_contract.py'
spec = importlib.util.spec_from_file_location('penguin_contract', MODULE)
c = importlib.util.module_from_spec(spec)
spec.loader.exec_module(c)
DONOR = Path(os.environ.get('PENGUIN_RETAINED_IMAGES',
    '/tmp/penguin-visible-projectile-gameplay-oct27/repo/docs/re-notes/'
    'penguin-visible-projectile-gameplay-20261027/decision'))
IMAGES = [DONOR / 'b39999.png', DONOR / 'b40060.png']
PINS = ['95112041c84196db00873e676117ac51d58562a21cabe06f5498d1f4b0504972',
        'de65fbced5b3e255433a7c80dfde87a956f427dbc3287aab05c8e66d1a6c5754']
EVIDENCE = os.environ.get('PENGUIN_CONTRACT_RECEIPTS')


def retain(name, value):
    if EVIDENCE:
        p=Path(EVIDENCE);p.mkdir(parents=True,exist_ok=True)
        (p/name).write_bytes(c.wire(value)+b'\n')


class LaunchTests(unittest.TestCase):
    def fixture(self, root, mutation=None, fail=False, guard=None):
        script = root / 'tiny.py'
        code = '''import sys,os,json,resource,pathlib
root=pathlib.Path(sys.argv[2]); stage=sys.argv[1]
names=('DATA','AS','RSS','CPU','FSIZE')
record=dict(env=dict(os.environ),limits={n:list(resource.getrlimit(getattr(resource,'RLIMIT_'+n))) for n in names},exe=sys.executable,flags=sys.flags.no_site)
(root/(stage+'.json')).write_text(json.dumps(record))
if stage=='startup':
 guard=GUARD
 if guard=='descendant':
  import subprocess
  child=subprocess.Popen([sys.executable,'-S','-c','import time;time.sleep(30)'])
  (root/'child.pid').write_text(str(child.pid))
 if guard=='text':print('x'*100,flush=True)
 if guard=='image':
  (root/'captures').mkdir();(root/'captures/too-big.png').write_bytes(b'x'*1025)
 if guard in ('wall','text','image','rss'):
  import time
  time.sleep(10)
 mutation=MUTATION
 if mutation:
  p=root/'profile.json';j=json.loads(p.read_text())
  if mutation=='flags':j['flags'].append('-B')
  elif mutation=='env':j['env']['TZ']='Europe/London'
  elif mutation=='limits':j['limits']['CPU']=[89,89]
  elif mutation=='executable':j['executable']='/bin/false'
  elif mutation=='inherit':j['inherit_environment']=True
  elif mutation=='artifact':pathlib.Path(__file__).write_text('# changed')
  if mutation!='artifact':p.write_text(json.dumps(j))
 if FAIL:sys.exit(7)
'''.replace('MUTATION', repr(mutation)).replace('FAIL', repr(fail)).replace('GUARD',repr(guard))
        script.write_text(code)
        p = dict(executable=str(Path(sys.executable).resolve()),
                 executable_sha256=c.sha(Path(sys.executable).resolve().read_bytes()),
                 flags=['-S'], startup=[str(script), 'startup', str(root)],
                 guest=[str(script), 'guest', str(root)], cwd=str(root),
                 env=dict(LC_ALL='C.UTF-8', LANG='C.UTF-8', TZ='UTC'),
                 limits=dict(c.limits_now(), CPU=[90,90], FSIZE=[c.PNG_BYTES,c.PNG_BYTES]),
                 resources=dict(rss=67108864, startup_wall=5, guest_wall=5,
                                total_wall=15, text=c.TEXT_BYTES, png=c.PNG_BYTES,
                                selected=c.SELECTED_BYTES, remote=c.REMOTE_BYTES, api=c.API_BYTES),
                 artifacts={str(script):c.sha(script.read_bytes())}, capture_dir=str(root/'captures'))
        if guard=='wall':p['resources']['startup_wall']=1
        if guard=='rss':p['resources']['rss']=1
        if guard=='text':p['resources']['text']=32
        if guard=='image':p['resources']['png']=1024
        path = root/'profile.json'; path.write_bytes(c.wire(p))
        return path, p

    def invoke(self, root, path, digest=None):
        # Sentinel verifies ambient credentials are neither inherited nor logged.
        env = dict(os.environ, AMBIENT_CREDENTIAL_SENTINEL='must-never-reach-child')
        result = subprocess.run([sys.executable, str(MODULE), 'supervise', str(path),
                                 '--sha256', digest or c.sha(path.read_bytes()),
                                 '--output', str(root/'out')], env=env,
                                capture_output=True, timeout=20)
        self.assertLess(len(result.stdout)+len(result.stderr), 8192)
        if EVIDENCE:
            receipt=root/'out/receipt.json'
            observation={stage:json.loads((root/(stage+'.json')).read_text())
                         for stage in ('startup','guest') if (root/(stage+'.json')).exists()}
            name=f'launch-{len(list(Path(EVIDENCE).glob("launch-*.json"))) if Path(EVIDENCE).exists() else 0:02d}.json'
            retain(name,dict(returncode=result.returncode,stdout=result.stdout.decode(),
                             receipt=json.loads(receipt.read_text()) if receipt.exists() else None,
                             observation=observation))
        return result

    def test_real_entrypoint_same_frozen_configuration(self):
        with tempfile.TemporaryDirectory(dir=MODULE.parent.parent/'test') as d:
            root=Path(d); path,p=self.fixture(root)
            r=self.invoke(root,path)
            self.assertEqual(r.returncode,0,r.stdout+r.stderr)
            startup=json.loads((root/'startup.json').read_text())
            guest=json.loads((root/'guest.json').read_text())
            self.assertEqual(startup,guest)
            self.assertEqual(guest['env'],p['env'])
            self.assertEqual(guest['limits'],p['limits'])
            self.assertEqual(guest['exe'],p['executable'])
            self.assertEqual(guest['flags'],1)
            receipt=json.loads((root/'out/receipt.json').read_text())
            self.assertEqual(receipt['guest_starts'],1)
            self.assertEqual(receipt['phases'][0]['actual_limits'],receipt['phases'][1]['actual_limits'])
            self.assertTrue(all(x['owned_group_absent'] for x in receipt['phases']))
            self.assertNotIn('AMBIENT_CREDENTIAL_SENTINEL',(root/'out/receipt.json').read_text())

    def test_pre_guest_changes_and_startup_failure_start_zero_guests(self):
        for mutation in ('flags','env','limits','executable','inherit','artifact','startup_failure'):
            with self.subTest(mutation=mutation),tempfile.TemporaryDirectory(dir=MODULE.parent.parent/'test') as d:
                root=Path(d);path,p=self.fixture(root,mutation if mutation!='startup_failure' else None,
                                              fail=mutation=='startup_failure')
                r=self.invoke(root,path)
                self.assertEqual(r.returncode,2,r.stdout+r.stderr)
                self.assertTrue((root/'startup.json').exists())
                self.assertFalse((root/'guest.json').exists())
                receipt=json.loads((root/'out/receipt.json').read_text())
                self.assertEqual(receipt['guest_starts'],0)

    def test_initial_identity_and_ambient_inheritance_rejected_before_startup(self):
        for field in ('hash','inherit','env','limits','DATA','AS','rss'):
            with self.subTest(field=field),tempfile.TemporaryDirectory(dir=MODULE.parent.parent/'test') as d:
                root=Path(d);path,p=self.fixture(root)
                if field=='inherit':p['inherit_environment']=True
                if field=='env':p['env']['AWS_SECRET_ACCESS_KEY']='forbidden'
                if field=='limits':p['limits']['CPU']=[91,91]
                if field in ('DATA','AS'):p['limits'][field]=[536870912,536870912]
                if field=='rss':p['resources']['rss']=2147483649
                path.write_bytes(c.wire(p))
                r=self.invoke(root,path,'0'*64 if field=='hash' else None)
                self.assertEqual(r.returncode,2,r.stdout+r.stderr)
                self.assertFalse((root/'startup.json').exists())
                self.assertFalse((root/'guest.json').exists())

    def test_resource_guards_and_owned_descendant_cleanup(self):
        for guard in ('wall','rss','text','image','descendant'):
            with self.subTest(guard=guard),tempfile.TemporaryDirectory(dir=MODULE.parent.parent/'test') as d:
                root=Path(d);path,p=self.fixture(root,guard=guard)
                r=self.invoke(root,path)
                self.assertEqual(r.returncode,0 if guard=='descendant' else 2,r.stdout+r.stderr)
                receipt=json.loads((root/'out/receipt.json').read_text())
                self.assertTrue(all(x['owned_group_absent'] for x in receipt['phases']))
                if guard!='descendant':
                    self.assertEqual(receipt['guest_starts'],0)
                    self.assertEqual(receipt['phases'][0]['reason'],guard)
                else:
                    child=int((root/'child.pid').read_text())
                    self.assertFalse(Path('/proc',str(child)).exists())


class TransportTests(unittest.TestCase):
    def test_exact_retained_images_roundtrip_individually_pair_is_unsupported(self):
        for path,pin in zip(IMAGES,PINS):
            with self.subTest(image=path.name):
                original=path.read_bytes();self.assertEqual(c.sha(original),pin)
                # Independent hypothetical wire fixture; no real API traffic and
                # no resetting an actual cumulative ledger between pair members.
                plan=c.plan_images([path],used=0,tail_reserve=256,chunk_bytes=8192)
                restored,charged=c.restore_images(plan,plan['frames'])
                self.assertEqual(restored,[original])
                self.assertEqual(c.sha(restored[0]),pin)
                self.assertEqual(charged,plan['serialized_bytes'])
                self.assertLessEqual(charged+256,c.API_BYTES)
                retain(path.name+'.transport.json',dict(independentOfflineFixture=True,
                       pairTransferQualified=False,images=plan['images'],
                       frames=len(plan['frames']),serialized_bytes=plan['serialized_bytes'],
                       actualChargedOnce=charged,tailReserve=256,used=0,
                       allFramesSha256=c.sha(b''.join(plan['frames'])),restoredSha256=c.sha(restored[0])))
        with self.assertRaisesRegex(c.ContractError,'UNSUPPORTED_PLAN'):
            c.plan_images(IMAGES,used=0,tail_reserve=0,chunk_bytes=8192)
        # CLI must refuse without emitting base64 or a partial image.
        r=subprocess.run([sys.executable,str(MODULE),'plan',*map(str,IMAGES),
                          '--used','0','--tail-reserve','0'],capture_output=True,timeout=10)
        self.assertEqual(r.returncode,2)
        self.assertIn(b'UNSUPPORTED_PLAN',r.stdout)
        self.assertLess(len(r.stdout),1024)

    def test_aggregate_budget_framing_and_truncation_boundaries(self):
        plan=c.plan_images([IMAGES[0]],used=0,tail_reserve=0,chunk_bytes=8192)
        spare=c.API_BYTES-plan['serialized_bytes']
        exact=c.plan_images([IMAGES[0]],used=spare-17,tail_reserve=17,chunk_bytes=8192)
        self.assertEqual(exact['total'],c.API_BYTES)
        restored,charged=c.restore_images(exact,exact['frames'])
        self.assertEqual(charged+17,c.API_BYTES)
        with self.assertRaisesRegex(c.ContractError,'UNSUPPORTED_PLAN'):
            c.plan_images([IMAGES[0]],used=spare-16,tail_reserve=17,chunk_bytes=8192)
        # Even one extra framing field on every response must be preflighted.
        extra=dict(c.DEFAULT_ENVELOPE,commandId='x')
        with self.assertRaisesRegex(c.ContractError,'UNSUPPORTED_PLAN'):
            c.plan_images([IMAGES[0]],used=spare,chunk_bytes=8192,envelope=extra)
        cases=[]
        cases.append(plan['frames'][:-1])
        cases.append((plan['frames'][0][:-1],*plan['frames'][1:]))
        frames=list(plan['frames']);j=json.loads(frames[1]);j['stdoutTruncated']=True
        frames[1]=c.wire(j);cases.append(frames)
        frames=list(plan['frames']);frames[1]=frames[1]+b' ';cases.append(frames)
        frames=list(plan['frames']);frames[1],frames[2]=frames[2],frames[1];cases.append(frames)
        for frames in cases:
            with self.subTest(case=len(frames)),self.assertRaises(c.ContractError):
                c.restore_images(plan,frames)
        for chunk in (0,8193):
            with self.assertRaises(c.ContractError):c.plan_images(IMAGES,used=0,chunk_bytes=chunk)
        with self.assertRaisesRegex(c.ContractError,'response count cap before encoding'):
            c.plan_images(IMAGES,used=0,chunk_bytes=1)


if __name__=='__main__':
    unittest.main(verbosity=2)
