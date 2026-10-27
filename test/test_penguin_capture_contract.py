"""Bounded offline tests; never invokes Node, a guest, network, or Boat."""
import base64
import copy
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
    def test_open_diagnostic_spends_only_remaining_combined_budget(self):
        from unittest import mock
        for remaining in (0, 1, 8192):
            with self.subTest(remaining=remaining), tempfile.TemporaryDirectory(dir=MODULE.parent.parent/'test') as d:
                root=Path(d);path,p=self.stream_fixture(root, (b'abc', b'defg'))
                p['resources']['text']=7+remaining;path.write_bytes(c.wire(p))
                error=PermissionError(13,'CAUSAL_GUEST_OPEN',str(root/'out/guest.stdout'))
                original_open=Path.open
                def opened(target,*args,**kwargs):
                    if target.name=='guest.stdout' and args and args[0]=='wb':raise error
                    return original_open(target,*args,**kwargs)
                with mock.patch.object(Path,'open',opened):
                    with self.assertRaises(PermissionError):c.supervise(path,c.sha(path.read_bytes()),root/'out')
                receipt=json.loads((root/'out/receipt.json').read_bytes())
                expected=(type(error).__name__+': '+str(error)+'\n').encode()[:min(8192,remaining)]
                self.assertEqual((root/'out/guest.stderr').read_bytes(),expected)
                self.assertEqual(receipt['text_bytes'],7+len(expected))
                self.assertEqual(receipt['guest_starts'],0)
                self.assertTrue(receipt['phases'][0]['owned_group_absent'])
                self.assertNotIn('pid',receipt['phases'][1])
                retain(f'diagnostic-remaining-{remaining}.json',receipt)

    def test_stream_open_failures_preserve_every_writable_channel(self):
        from unittest import mock
        cases = [(stage, failed, cap, append_failure)
                 for stage in ('startup', 'guest')
                 for failed in (('stdout',), ('stderr',), ('stdout', 'stderr'))
                 for cap in (1, 4096) for append_failure in (False,)]
        cases += [('startup', (), 4096, True)]
        for stage, failed, cap, append_failure in cases:
            with self.subTest(stage=stage, failed=failed, cap=cap, append=append_failure), tempfile.TemporaryDirectory(dir=MODULE.parent.parent/'test') as d:
                root=Path(d);path,p=self.stream_fixture(root, (b'', b''), (b'', b''))
                p['resources']['text']=cap;path.write_bytes(c.wire(p))
                original_open=Path.open
                def opened(target, *args, **kwargs):
                    if args and args[0]=='wb' and target.name in [stage+'.'+n for n in failed]:
                        raise PermissionError(13, 'CAUSAL_OPEN_EACCES', str(target))
                    if append_failure and target.name==stage+'.stderr' and args and args[0]=='ab':
                        raise PermissionError('CAUSAL_APPEND_EACCES')
                    return original_open(target,*args,**kwargs)
                popen=c.subprocess.Popen
                with mock.patch.object(Path,'open',opened), mock.patch.object(c.subprocess,'Popen',wraps=popen) as spawn:
                    if append_failure:
                        with mock.patch.object(c.os,'pipe',side_effect=OSError('CAUSAL_PIPE_FAILURE')):
                            with self.assertRaises(OSError):c.supervise(path,c.sha(path.read_bytes()),root/'out')
                    else:
                        with self.assertRaises(PermissionError):c.supervise(path,c.sha(path.read_bytes()),root/'out')
                    self.assertEqual(spawn.call_count, int(stage=='guest'))
                receipt=json.loads((root/'out/receipt.json').read_bytes());phase=receipt['phases'][-1]
                self.assertEqual(receipt['guest_starts'],0);self.assertNotIn('pid',phase)
                self.assertEqual(phase['stage'],stage);self.assertEqual(phase['reason'],'setup')
                self.assertEqual(phase['status'],'failed');self.assertEqual(receipt['status'],'REJECT')
                total=0
                for name,record in phase['streams'].items():
                    target=root/'out'/f'{stage}.{name}'
                    self.assertEqual(record['path'],str(target))
                    if name in failed:
                        self.assertFalse(target.exists());self.assertEqual(record['status'],'unavailable')
                        self.assertEqual(record['bytes'],0);self.assertIsNone(record['sha256'])
                        self.assertIn('CAUSAL_OPEN_EACCES',record['error'])
                    else:
                        data=target.read_bytes();total+=len(data)
                        self.assertEqual(record['bytes'],len(data));self.assertEqual(record['sha256'],c.sha(data))
                self.assertEqual(receipt['text_bytes'],total);self.assertLessEqual(total,cap)
                if len(failed)<2:
                    channel='stdout' if 'stderr' in failed or append_failure else 'stderr'
                    self.assertEqual(phase['diagnostic_stream'],channel)
                    data=(root/'out'/f'{stage}.{channel}').read_bytes()
                    self.assertEqual(len(data),cap if cap==1 else len(data))
                    self.assertIn(b'P' if cap==1 else b'CAUSAL_',data)
                if append_failure:self.assertIn('stderr',phase['diagnostic_errors'])
                self.assertTrue(all(x['owned_group_absent'] for x in receipt['phases'][:-1]))
                retain(f'open-{stage}-{"-".join(failed)}-{cap}-{append_failure}.json',receipt)

    def stream_fixture(self, root, startup=(b'startup-OUT\n', b'startup-ERR\n'),
                       guest=(b'guest-OUT\n', b'guest-ERR\n'), fail=0, remove_cwd=False):
        path, p = self.fixture(root)
        script = root/'tiny.py'
        script.write_text('import os,sys\n'
                          f'out,err={dict(startup=startup, guest=guest)!r}[sys.argv[1]]\n'
                          'os.write(1,out);os.write(2,err)\n'
                          f'if sys.argv[1]=="startup":\n'
                          f' if {remove_cwd!r}:os.rmdir(os.getcwd())\n'
                          f' sys.exit({fail!r})\n')
        p['artifacts'][str(script)] = c.sha(script.read_bytes())
        if remove_cwd:
            cwd = root/'empty-cwd';cwd.mkdir();p['cwd'] = str(cwd)
        path.write_bytes(c.wire(p))
        return path, p

    def assert_stream_receipt(self, root, receipt):
        total = 0
        for phase in receipt['phases']:
            self.assertEqual(set(phase['streams']), {'stdout', 'stderr'})
            for name, record in phase['streams'].items():
                path = root/'out'/f'{phase["stage"]}.{name}'
                data = path.read_bytes();total += len(data)
                self.assertEqual(record, dict(path=str(path), bytes=len(data), sha256=c.sha(data)))
        self.assertEqual(receipt['text_bytes'], total)
        self.assertFalse(list((root/'out').glob('*.log')))

    def test_distinct_streams_from_production_cli_and_startup_failure(self):
        for fail in (0, 7):
            with self.subTest(fail=fail), tempfile.TemporaryDirectory(dir=MODULE.parent.parent/'test') as d:
                root=Path(d);path,p=self.stream_fixture(root, fail=fail)
                result=self.invoke(root,path)
                self.assertEqual(result.returncode, 2 if fail else 0, result.stdout+result.stderr)
                receipt=json.loads((root/'out/receipt.json').read_bytes())
                self.assertEqual(receipt['guest_starts'], 0 if fail else 1)
                self.assertEqual(len(receipt['phases']), 1 if fail else 2)
                for phase in receipt['phases']:
                    stage=phase['stage']
                    self.assertEqual((root/'out'/f'{stage}.stdout').read_bytes(), f'{stage}-OUT\n'.encode())
                    self.assertEqual((root/'out'/f'{stage}.stderr').read_bytes(), f'{stage}-ERR\n'.encode())
                    self.assertTrue(phase['owned_group_absent'])
                    self.assertEqual(phase['status'], 'failed' if fail else 'passed')
                self.assert_stream_receipt(root,receipt)

    def test_spawn_failures_have_diagnostics_without_invented_pid(self):
        for case in ('executable', 'cwd', 'guest_cwd', 'bounded_diagnostic'):
            with self.subTest(case=case), tempfile.TemporaryDirectory(dir=MODULE.parent.parent/'test') as d:
                root=Path(d);path,p=self.stream_fixture(root, remove_cwd=case=='guest_cwd')
                if case in ('executable', 'bounded_diagnostic'):
                    exe=root/'not-executable';exe.write_bytes(b'pinned non-executable\n');exe.chmod(0o600)
                    p['executable']=str(exe);p['executable_sha256']=c.sha(exe.read_bytes())
                if case=='cwd':p['cwd']=str(root/'missing-cwd')
                if case=='bounded_diagnostic':p['resources']['text']=1
                path.write_bytes(c.wire(p))
                result=self.invoke(root,path)
                self.assertEqual(result.returncode,2,result.stdout+result.stderr)
                receipt=json.loads((root/'out/receipt.json').read_bytes())
                self.assertEqual(receipt['guest_starts'],0)
                failed=receipt['phases'][-1]
                self.assertEqual(failed['stage'],'guest' if case=='guest_cwd' else 'startup')
                self.assertEqual(failed['status'],'failed')
                self.assertEqual(failed['reason'],'spawn')
                self.assertIn('error',failed);self.assertNotIn('pid',failed)
                self.assertNotIn('returncode',failed)
                self.assertEqual((root/'out'/f'{failed["stage"]}.stdout').read_bytes(),b'')
                diagnostic=(root/'out'/f'{failed["stage"]}.stderr').read_bytes()
                self.assertTrue(diagnostic)
                if case=='bounded_diagnostic':self.assertEqual(len(diagnostic),1)
                else:self.assertIn(b'Error',diagnostic)
                self.assert_stream_receipt(root,receipt)

    def test_combined_stream_budget_exact_boundary_and_failure_paths(self):
        # All four contributions matter; no per-stream or per-phase reset.
        for limit, fail, expected_starts in ((18,0,1),(17,0,1),(6,0,0),(7,7,0),(6,7,0)):
            with self.subTest(limit=limit,fail=fail), tempfile.TemporaryDirectory(dir=MODULE.parent.parent/'test') as d:
                root=Path(d);path,p=self.stream_fixture(root,(b'abc',b'defg'),(b'hijkl',b'mnopqr'),fail)
                p['resources']['text']=limit;path.write_bytes(c.wire(p))
                result=self.invoke(root,path)
                self.assertEqual(result.returncode,0 if limit==18 and not fail else 2)
                receipt=json.loads((root/'out/receipt.json').read_bytes())
                self.assertEqual(receipt['guest_starts'],expected_starts)
                self.assert_stream_receipt(root,receipt)
                if receipt['text_bytes']>limit:
                    self.assertEqual(receipt['phases'][-1]['reason'],'text')
                    self.assertIn('text guard',receipt['error'])
                self.assertTrue(all(x['owned_group_absent'] for x in receipt['phases']))

    def test_initial_pipe_setup_failure_has_owned_streams_and_receipt(self):
        # Independent fault injection at the initial setup boundary, without
        # weakening profile validation or changing the production implementation.
        from unittest import mock
        with tempfile.TemporaryDirectory(dir=MODULE.parent.parent/'test') as d:
            root=Path(d);path,p=self.stream_fixture(root)
            with mock.patch.object(c.os,'pipe',side_effect=OSError('injected pipe setup failure')):
                with self.assertRaisesRegex(OSError,'injected pipe setup failure'):
                    c.supervise(path,c.sha(path.read_bytes()),root/'out')
            receipt=json.loads((root/'out/receipt.json').read_bytes())
            self.assertEqual(receipt['guest_starts'],0)
            self.assertEqual(receipt['status'],'REJECT')
            phase=receipt['phases'][0]
            self.assertEqual(phase['status'],'failed');self.assertEqual(phase['reason'],'setup')
            self.assertNotIn('pid',phase)
            self.assertIn(b'injected pipe setup failure',(root/'out/startup.stderr').read_bytes())
            self.assert_stream_receipt(root,receipt)

    def test_preexec_setup_failure_retains_child_cause_without_pid(self):
        from unittest import mock
        with tempfile.TemporaryDirectory(dir=MODULE.parent.parent/'test') as d:
            root=Path(d);path,p=self.stream_fixture(root)
            with mock.patch.object(c.resource,'setrlimit',side_effect=OSError('injected child limit failure')):
                with self.assertRaises(subprocess.SubprocessError):
                    c.supervise(path,c.sha(path.read_bytes()),root/'out')
            receipt=json.loads((root/'out/receipt.json').read_bytes())
            self.assertEqual(receipt['guest_starts'],0)
            self.assertEqual(receipt['phases'][0]['status'],'failed')
            self.assertNotIn('pid',receipt['phases'][0])
            self.assertIn(b'child setup: injected child limit failure',(root/'out/startup.stderr').read_bytes())
            self.assert_stream_receipt(root,receipt)

    def test_final_cleanup_writes_are_charged_before_guest(self):
        from unittest import mock
        with tempfile.TemporaryDirectory(dir=MODULE.parent.parent/'test') as d:
            root=Path(d);path,p=self.stream_fixture(root,(b'abc',b'defg'))
            p['resources']['text']=7;path.write_bytes(c.wire(p))
            reap=c.reap_group
            def late_write(proc):
                cleaned=reap(proc)
                # Deterministic control for a descendant's last write after
                # the polling sample, before cleanup has fully returned.
                with (root/'out/startup.stderr').open('ab') as stream:stream.write(b'!')
                return cleaned
            with mock.patch.object(c,'reap_group',side_effect=late_write):
                with self.assertRaisesRegex(c.ContractError,'startup text guard'):
                    c.supervise(path,c.sha(path.read_bytes()),root/'out')
            receipt=json.loads((root/'out/receipt.json').read_bytes())
            self.assertEqual(receipt['guest_starts'],0)
            self.assertEqual(receipt['text_bytes'],8)
            self.assertEqual(receipt['phases'][0]['reason'],'text')
            self.assertTrue(receipt['phases'][0]['owned_group_absent'])
            self.assert_stream_receipt(root,receipt)

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


class ProviderTransportTests(unittest.TestCase):
    """Genuine envelope shape; all PNG traffic below is deterministic offline data."""
    FIXTURE = MODULE.parent.parent / 'test/fixtures/penguin-wire-envelope.json'

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(dir=MODULE.parent.parent/'test')
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.png = self.root/'fixture.png'
        self.original = b'\x89PNG\r\n\x1a\n' + bytes(range(256))*4
        self.png.write_bytes(self.original)
        self.raw = self.FIXTURE.read_bytes()
        self.assertEqual(c.sha(self.raw), '30df71f26400cd565268c22c9a42ea159233c50ed5ee2069375a53f84a5b4066')
        self.envelope = json.loads(self.raw)
        self.assertEqual(self.envelope['stdout'], 'delivered\n')

    def frames(self, plan, *, reverse=False):
        frames = []
        for i, record in enumerate(plan['records']):
            env = dict(self.envelope, stdout=c.wire(record).decode()+'\n',
                       commandId='cmd_offline_'+str(i), startMs=i, noticedMs=i+1)
            if reverse:
                env = dict(reversed(list(env.items())))
            frames.append(json.dumps(env, indent=1 if reverse else None).encode())
        return frames

    def test_original_defect_and_dynamic_full_envelope_repair(self):
        legacy = c.plan_images([self.png], used=len(self.raw))
        p = c.plan_provider_images([self.png], used=len(self.raw), tail_reserve=333)
        frames = self.frames(p, reverse=True)
        with self.assertRaisesRegex(c.ContractError, 'framing'):
            c.restore_images(legacy, frames)
        capture = c.ProviderCapture(p)
        # Actual historical acknowledgment is charged; it is not an image record.
        capture.account(self.raw)
        for raw in frames:
            capture.accept(raw)
        restored, charged = capture.finish()
        self.assertEqual(restored, [self.original])
        self.assertEqual(charged, 2*len(self.raw)+sum(map(len, frames)))
        self.assertNotEqual(charged, legacy['serialized_bytes'])
        self.assertEqual(capture.tail, 0)
        with self.assertRaises(c.ContractError):
            capture.accept(frames[-1])

    def test_worst_case_serialization_exact_remaining_and_tail_budget(self):
        p = c.plan_provider_images([self.png], used=0, tail_reserve=17)
        used = c.API_BYTES-p['total']
        p = c.plan_provider_images([self.png], used=used, tail_reserve=17)
        self.assertEqual(p['total'], c.API_BYTES)
        frames = [raw+b' '*(bound-len(raw))
                  for raw, bound in zip(self.frames(p), p['frame_limits'])]
        capture = c.ProviderCapture(p)
        # Failed/poll bodies can be arbitrary bytes; account without parsing them.
        capture.account(b'failed poll body')
        capture.account(b'?')
        for raw in frames:
            capture.accept(raw)
        restored, charged = capture.finish()
        self.assertEqual(restored, [self.original])
        self.assertEqual(charged, c.API_BYTES)
        for kwargs in (dict(used=used+1, tail_reserve=17),
                       dict(used=used, tail_reserve=18)):
            with self.assertRaisesRegex(c.ContractError, 'UNSUPPORTED_PLAN'):
                c.plan_provider_images([self.png], **kwargs)
        capture = c.ProviderCapture(p)
        with self.assertRaisesRegex(c.ContractError, 'reserve'):
            capture.account(b'x'*18)
        self.assertEqual(capture.charged, used+18)
        with self.assertRaises(c.ContractError):
            capture.finish()

    def test_maximum_metadata_and_utf8_serialization(self):
        p = c.plan_provider_images([self.png], used=0, envelope_overhead=8192)
        self.envelope.update(cwd='é'*1024, commandId='x'*128,
                             startMs=(1 << 53)-1, noticedMs=(1 << 53)-1)
        for ascii_escapes in (True, False):
            capture = c.ProviderCapture(p)
            raw_frames = []
            for record in p['records']:
                env = dict(self.envelope, stdout=c.wire(record).decode()+'\n')
                raw = json.dumps(dict(reversed(list(env.items()))),
                                 ensure_ascii=ascii_escapes).encode('utf-8')
                capture.accept(raw); raw_frames.append(raw)
            restored, charged = capture.finish()
            self.assertEqual(restored, [self.original])
            self.assertEqual(charged, sum(map(len, raw_frames)))

    def test_retained_large_pngs_need_more_than_full_envelope_budget(self):
        # Legacy canonical-only independent roundtrips are not provider plans.
        # No reset, dropped framing or cap increase can qualify these captures.
        for path, pin in zip(IMAGES, PINS):
            self.assertEqual(c.sha(path.read_bytes()), pin)
            with self.subTest(image=path.name), self.assertRaisesRegex(c.ContractError, 'UNSUPPORTED_PLAN'):
                c.plan_provider_images([path], used=len(self.raw), tail_reserve=256)

    def test_reject_metadata_status_schema_and_charge_original_once(self):
        p = c.plan_provider_images([self.png], used=7)
        frames = self.frames(p)
        mutations = [dict(extra='unsupported'), dict(commandId='x'*129),
            dict(cwd='x'*1025), dict(commandId='bad\n'), dict(cwd=None),
            dict(exitCode=True), dict(exitCode=1), dict(signal='SIGTERM'),
            dict(success=False), dict(success=1), dict(launcherFailed=True),
            dict(oomKilled=True), dict(timedOut=True), dict(stdoutTruncated=True),
            dict(stderrTruncated=True), dict(stderr='warning'), dict(stdout=4),
            dict(startMs=True), dict(noticedMs=-1), dict(startMs=1 << 53),
            dict(finishedAt=None), dict(startedAt='2026-99-99T00:00:00.000Z'),
            dict(finishedAt='2000-01-01T00:00:00.000Z')]
        invalid = [json.dumps(dict(json.loads(frames[0]), **m)).encode() for m in mutations]
        missing = json.loads(frames[0]); del missing['cwd']
        invalid += [c.wire(missing), b'{', b'[]', b'\xff',
                    frames[0][:-1]+b',"success":true}',
                    frames[0]+b' '*8192, self.raw]
        for raw in invalid:
            with self.subTest(raw=raw[:64]):
                capture = c.ProviderCapture(p)
                with self.assertRaises(c.ContractError):
                    capture.accept(raw)
                self.assertEqual(capture.charged, 7+len(raw))
                self.assertTrue(capture.failed)
                with self.assertRaises(c.ContractError):
                    capture.finish()

    def test_reject_missing_duplicate_reordered_corrupt_and_extra_records(self):
        p = c.plan_provider_images([self.png], used=0, chunk_bytes=32)
        frames = self.frames(p)
        altered = []
        for key, value in (('data', '!!!'), ('data', 'AAAA'), ('image', 1),
                           ('index', True), ('index', 100), ('kind', 'end')):
            e = json.loads(frames[1]); r = json.loads(e['stdout']); r[key] = value
            e['stdout'] = json.dumps(r); altered.append([frames[0], c.wire(e), *frames[2:]])
        for index in (0, len(frames)-1):
            e = json.loads(frames[index]); r = json.loads(e['stdout']); r['extra'] = 1
            e['stdout'] = json.dumps(r)
            case = list(frames); case[index] = c.wire(e); altered.append(case)
        altered += [frames[:-1], [frames[0], frames[2], frames[1], *frames[3:]],
                    [frames[0], frames[1], frames[1], *frames[2:]], frames+[frames[-1]]]
        for case in altered:
            with self.subTest(length=len(case)):
                capture = c.ProviderCapture(p)
                with self.assertRaises(c.ContractError):
                    for raw in case:
                        capture.accept(raw)
                    capture.finish()

    def test_zlib_eof_trailing_bounds_size_and_hash_still_enforced(self):
        p = c.plan_provider_images([self.png], used=0)
        for mode in ('eof', 'trailing', 'bomb', 'size', 'hash'):
            bad = copy.deepcopy(p)
            image = bad['canonical']['images'][0]
            packed = zlib.compress(self.original)
            if mode == 'eof': packed = packed[:-1]
            if mode == 'trailing': packed += b'x'
            if mode == 'bomb': packed = zlib.compress(b'x'*(c.PNG_BYTES+1))
            if mode == 'size': image['size'] += 1
            if mode == 'hash': image['sha256'] = '0'*64
            # Trusted-plan corruption control reaches legacy decompression checks.
            image['compressed'] = len(packed)
            bad['records'][1]['data'] = base64.b64encode(packed).decode()
            bad['canonical']['frames'] = tuple(c.response(r, c.DEFAULT_ENVELOPE)
                                                for r in bad['records'])
            bad['frame_limits'] = [len(f)+8192 for f in bad['canonical']['frames']]
            bad['envelope_overhead'] = 8192
            capture = c.ProviderCapture(bad)
            for raw in self.frames(bad):
                capture.accept(raw)
            with self.subTest(mode=mode), self.assertRaisesRegex(c.ContractError, 'lossless'):
                capture.finish()

    def test_real_cli_transcript_full_envelope_and_no_partial_publication(self):
        p = c.plan_provider_images([self.png], used=0, tail_reserve=len(self.raw))
        frames = self.frames(p, reverse=True)
        entries = [dict(kind='account', path=str(self.FIXTURE))]
        for i, raw in enumerate(frames):
            (self.root/f'{i}.json').write_bytes(raw)
            entries.append(dict(kind='capture', path=f'{i}.json'))
        transcript = self.root/'transcript.json'; transcript.write_bytes(c.wire(entries))
        out = self.root/'restored'
        argv = [sys.executable, '-B', str(MODULE), 'restore-provider', str(self.png),
                '--transcript', str(transcript), '--output', str(out), '--used', '0',
                '--tail-reserve', str(len(self.raw))]
        r = subprocess.run(argv, capture_output=True, timeout=10)
        self.assertEqual(r.returncode, 0, r.stdout+r.stderr)
        receipt = json.loads(r.stdout)
        self.assertEqual(receipt['charged'], len(self.raw)+sum(map(len, frames)))
        self.assertEqual((out/self.png.name).read_bytes(), self.original)
        if EVIDENCE:
            retained = Path(EVIDENCE)/'cli-fixture'
            retained.mkdir(parents=True, exist_ok=True)
            (retained/self.png.name).write_bytes(self.original)
            (retained/'ack.json').write_bytes(self.raw)
            reproduction = [dict(kind='account', path='ack.json')]
            for i, raw in enumerate(frames):
                (retained/f'{i}.json').write_bytes(raw)
                reproduction.append(dict(kind='capture', path=f'{i}.json'))
            (retained/'transcript.json').write_bytes(c.wire(reproduction))
        for mode in ('corrupt', 'missing', 'overflow', 'framing'):
            transcript.write_bytes(c.wire(entries))
            for i, raw in enumerate(frames):
                (self.root/f'{i}.json').write_bytes(raw)
            argv[argv.index('--used')+1] = '0'
            if mode == 'corrupt': (self.root/'1.json').write_bytes(b'{}')
            if mode == 'missing': transcript.write_bytes(c.wire(entries[:-1]))
            if mode == 'overflow': argv[argv.index('--used')+1] = str(c.API_BYTES)
            if mode == 'framing':
                (self.root/'1.json').write_bytes(frames[1]+b' '*8192)
            rejected = self.root/('rejected-'+mode)
            argv[argv.index('--output')+1] = str(rejected)
            r = subprocess.run(argv, capture_output=True, timeout=10)
            self.assertEqual(r.returncode, 2, r.stdout+r.stderr)
            self.assertFalse(rejected.exists())
            self.assertFalse(list(self.root.glob('.rejected-*')))
        retain('provider-transport.json', dict(offlineOnly=True,
            genuineEnvelopeSHA256=c.sha(self.raw), genuineStdout='delivered',
            syntheticPNGHash=c.sha(self.original), result=receipt,
            rawResponseBytes=len(self.raw)+sum(map(len, frames))))


if __name__=='__main__':
    unittest.main(verbosity=2)
