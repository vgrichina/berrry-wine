#!/usr/bin/env python3
"""Offline tests of the actual Ricochet readfile adapter, never Boat/guest exec."""
import base64
import contextlib
import hashlib
import importlib.util
import io
import json
import math
import os
import pathlib
import re
import shlex
import struct
import sys
import tempfile
import time
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
FIXTURE = ROOT / 'test/fixtures/ricochet-serial-controller'
sys.path.insert(0, str(FIXTURE))
import read as adapter
import work
capture = work.capture
PNG = FIXTURE / 'later.png'
SHA = '9e6b81e080cfa6476fdd76ef4093217b43567e37f9d9f7fcd69cc021d1541d88'
RESULTS = {}


def envelope(stdout):
    # Exact parent boat --json exec response fields/encoding, bounded in full.
    return dict(commandId='offline-fixture', cwd='.', exitCode=0,
                finishedAt='offline', launcherFailed=False, noticedMs=0,
                oomKilled=False, signal=None, startMs=0, startedAt='offline',
                stderr='', stderrTruncated=False, stdout=stdout,
                stdoutTruncated=False, success=True, timedOut=False)


def evaluate(code):
    output = io.StringIO(); scope = {}
    try:
        with contextlib.redirect_stdout(output):
            exec(compile(code, '<stateless read-only request>', 'exec'), scope)
        return envelope(output.getvalue())
    except Exception as e:
        j=envelope(''); j.update(exitCode=1,success=False,stderr=repr(e))
        return j
    finally:
        if 'f' in scope:
            scope['f'].close()


class FakeJob:
    def __init__(self, executor, code, span, delay):
        self.owner=executor; self.code=code; self.span=span
        self.ready=time.monotonic()+delay; self.closed=False
        self.wave=executor.completed_wave+1

    def poll(self):
        if time.monotonic()<self.ready:
            return None
        j=evaluate(self.code)
        if self.owner.mutate:
            self.owner.mutate(j, self.span, self.owner)
        raw=json.dumps(j).encode()
        self.owner.max_response=max(self.owner.max_response,len(raw))
        if self.span:
            self.owner.completed.append(self.span[0])
            self.owner.completed_wave=max(self.owner.completed_wave,self.wave)
        return raw

    def cancel(self):
        if not self.closed:
            self.closed=True; self.owner.active.remove(self)


class FakeExecutor:
    def __init__(self, mutate=None, delay=.004, reorder=False):
        self.mutate=mutate; self.delay=delay; self.reorder=reorder
        self.active=set(); self.peak=0; self.spans=[]; self.completed=[]
        self.codes=[]; self.metadata_calls=0; self.max_response=0; self.completed_wave=0

    def start(self, code, remaining):
        self.codes.append(code)
        m=re.search(r'f.seek\((\d+)\);b=f.read\((\d+)\)',code)
        span=tuple(map(int,m.groups())) if m else None
        if span:
            self.spans.append(span)
        else:
            self.metadata_calls+=1
        delay=self.delay*(3 if self.reorder and span and span[0]==0 else 1)
        job=FakeJob(self,code,span,delay)
        self.active.add(job); self.peak=max(self.peak,len(self.active))
        return job


class ReadbackTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.dest=pathlib.Path(self.tmp.name)/'result.png'
        self.oldroot=adapter.R; adapter.R=str(FIXTURE)

    def tearDown(self):
        adapter.R=self.oldroot; self.tmp.cleanup()

    def read(self, ex, concurrency=4, deadline=None, target='later.png'):
        return adapter.readfile(target,self.dest,executor=ex,concurrency=concurrency,
                                deadline=time.monotonic()+5 if deadline is None else deadline)

    def test_01_exact_adapter_parallel_and_serial(self):
        original=PNG.read_bytes()
        self.assertEqual(len(original),401056)
        self.assertEqual(hashlib.sha256(original).hexdigest(),SHA)
        self.assertEqual(struct.unpack('>II',original[16:24]),(640,480))
        for c in (1,4):
            ex=FakeExecutor(reorder=c==4); start=time.monotonic(); meta=self.read(ex,c)
            elapsed=time.monotonic()-start
            self.assertEqual(self.dest.read_bytes(),original)
            self.assertEqual(meta['sha256'],SHA); self.assertEqual(meta['chunks'],90)
            self.assertEqual(ex.peak,c); self.assertEqual(meta['maxActive'],c)
            self.assertFalse(ex.active); self.assertEqual(ex.metadata_calls,2)
            self.assertEqual(ex.spans,[(n,min(4500,401056-n)) for n in range(0,401056,4500)])
            self.assertLessEqual(ex.max_response,8192)
            if c==4:
                self.assertNotEqual(ex.completed,sorted(ex.completed))
            RESULTS[str(c)]=dict(elapsedSeconds=elapsed,chunkRequests=len(ex.spans),metadataRequests=2,
                                 maxActive=ex.peak,maxPending=ex.peak,causalRoundtripWaves=ex.completed_wave,
                                 idealChunkWaves=math.ceil(90/c),maxResponseBytes=ex.max_response,
                                 completionOffsets=ex.completed,offlineSimulation=True)
        self.assertEqual(RESULTS['1']['causalRoundtripWaves'],90)
        self.assertLess(RESULTS['4']['causalRoundtripWaves'],90)
        # Reader cannot issue guest operations; retained serial.py is untouched.
        parent=pathlib.Path('/tmp/ricochet-serial-progress-gameplay-api-oct26/ops/serial.py')
        if parent.exists():
            self.assertEqual((FIXTURE/'serial.py').read_bytes(),parent.read_bytes())

    def test_02_rejections_preserve_destination(self):
        cases=['transport','denial','truncation','stderr-truncation','base64','noncanonical-base64',
               'short','long','wrong-offset','hash','metadata','identity','oversize','bad-metadata',
               'response-ceiling','invalid-json','timed-out','launcher-failed','missing-flags']
        for case in cases:
            for existing in (False,True):
                with self.subTest(case=case,existing=existing):
                    self.dest.unlink(missing_ok=True)
                    if existing: self.dest.write_bytes(b'existing destination')
                    def mutate(j,span,ex):
                        # First chunk, or initial/final metadata as appropriate.
                        if case=='oversize' and span is None:
                            m=json.loads(j['stdout']); m['bytes']=2097153; m['identity'][2]=2097153; j['stdout']=json.dumps(m)
                        if case=='bad-metadata' and span is None: j['stdout']='[]'
                        if case in ('metadata','identity') and span is None and ex.metadata_calls==2:
                            m=json.loads(j['stdout']); m['identity'][3 if case=='metadata' else 1]+=1; j['stdout']=json.dumps(m)
                        if not span or span[0]!=0: return
                        if case in ('transport','denial'): j['exitCode']=1; j['stderr']='403 denied'; j['success']=False
                        if case=='truncation': j['stdoutTruncated']=True
                        if case=='stderr-truncation': j['stderrTruncated']=True
                        if case=='base64': j['stdout']='!bad!\n'
                        if case=='noncanonical-base64': j['stdout']='YR==\n'
                        if case in ('short','long'):
                            b=base64.b64decode(j['stdout']); j['stdout']=base64.b64encode(b[:-1] if case=='short' else b+b'x').decode()+'\n'
                        if case=='wrong-offset': j['stdout']=base64.b64encode(PNG.read_bytes()[4500:9000]).decode()+'\n'
                        if case=='hash':
                            b=bytearray(base64.b64decode(j['stdout'])); b[0]^=1; j['stdout']=base64.b64encode(b).decode()+'\n'
                        if case=='response-ceiling': j['stdout']='x'*8193
                        if case=='timed-out': j['timedOut']=True
                        if case=='launcher-failed': j['launcherFailed']=True
                        if case=='missing-flags': del j['stdoutTruncated']
                    class InvalidJob(FakeJob):
                        def poll(self): return b'not JSON'
                    ex=FakeExecutor(mutate=mutate,delay=0)
                    if case=='invalid-json':
                        def invalid_start(code,remaining):
                            job=InvalidJob(ex,code,None,0); ex.active.add(job); return job
                        ex.start=invalid_start
                    with self.assertRaises(capture.ReadbackError): self.read(ex)
                    self.assertFalse(ex.active)
                    self.assertLessEqual(ex.peak,4)
                    if existing: self.assertEqual(self.dest.read_bytes(),b'existing destination')
                    else: self.assertFalse(self.dest.exists())
                    self.assertEqual(list(self.dest.parent.glob('.*.readback-*')),[])
        RESULTS['rejections']=dict(cases=cases,existingAndAbsentDestination=True,noGuestInput=True)

    def test_03_deadline_and_cancel(self):
        ex=FakeExecutor(delay=.2)
        self.dest.write_bytes(b'old')
        with self.assertRaisesRegex(capture.ReadbackError,'deadline'):
            self.read(ex,deadline=time.monotonic()+.02)
        self.assertFalse(ex.active); self.assertEqual(self.dest.read_bytes(),b'old')
        self.assertEqual(len(ex.codes),1)
        # After metadata, four hanging jobs are canceled; no queued90-future tail.
        class Hanging(FakeExecutor):
            def start(self,code,remaining):
                job=super().start(code,remaining)
                if job.span: job.ready=time.monotonic()+30
                return job
        ex=Hanging(delay=0)
        with self.assertRaisesRegex(capture.ReadbackError,'deadline'):
            self.read(ex,deadline=time.monotonic()+.02)
        self.assertEqual(len(ex.spans),4); self.assertFalse(ex.active)

    def test_04_owned_blocking_subprocess_is_killed(self):
        pidfile=pathlib.Path(self.tmp.name)/'pids.json'
        program=('import os,pathlib,json,time,signal\n'
                 'signal.signal(signal.SIGTERM,signal.SIG_IGN)\n'
                 'child=os.fork()\n'
                 'if child==0: time.sleep(30);os._exit(0)\n'
                 f'pathlib.Path({str(pidfile)!r}).write_text(json.dumps([os.getpid(),child]))\n'
                 'time.sleep(30)\n')
        jobs=[]
        class Hybrid(FakeExecutor):
            def start(self,code,remaining):
                if 'f.seek(0)' in code:
                    job=capture.SubprocessExecutor(lambda c,r:[sys.executable,'-c',program]).start(code,remaining)
                    jobs.append(job); return job
                return super().start(code,remaining)
        ex=Hybrid(delay=0); start=time.monotonic(); self.dest.write_bytes(b'old')
        with self.assertRaisesRegex(capture.ReadbackError,'deadline'):
            self.read(ex,deadline=start+.3)
        elapsed=time.monotonic()-start
        self.assertLess(elapsed,1.5); self.assertEqual(len(jobs),1)
        self.assertIsNotNone(jobs[0].process.poll()); self.assertTrue(jobs[0].closed)
        self.assertTrue(pidfile.exists()); pids=json.loads(pidfile.read_text())
        for pid in pids:
            p=pathlib.Path('/proc')/str(pid)/'stat'
            if p.exists(): self.assertEqual(p.read_text().split(') ')[1][0],'Z')
        self.assertFalse(ex.active); self.assertEqual(self.dest.read_bytes(),b'old')
        self.assertFalse(list(self.dest.parent.glob('.*.readback-*')))
        RESULTS['blockingChild']=dict(elapsedSeconds=elapsed,pids=pids,remainingOwnedLive=[],
                                      directChildReaped=True,descendantGroupKilled=True)

    def test_05_transport_subprocess_and_quoting(self):
        def argv(code,remaining):
            # Exercise same complete response encoding through actual local
            # subprocess pipes, never a real Boat invocation.
            wrapped='import json\n'+code+'\n'
            program=('import contextlib,io,json\n'
                     's=io.StringIO()\n'
                     f'with contextlib.redirect_stdout(s): exec({wrapped!r}, {{}})\n'
                     f'j={envelope("")!r}\nj["stdout"]=s.getvalue()\nprint(json.dumps(j))\n')
            return [sys.executable,'-c',program]
        ex=capture.SubprocessExecutor(argv)
        meta=self.read(ex)
        self.assertEqual(meta['chunks'],90); self.assertEqual(self.dest.read_bytes(),PNG.read_bytes())
        # Recover both quoting layers as data, without executing any shell.
        code="print(\"a'; $(touch /NEVER); comma,name\")"
        a=work.python_argv(code,1.5)
        self.assertEqual(a[:5],['boat','--no-update','--json','exec','--timeout'])
        outer=shlex.split(a[-1]); inner=shlex.split(outer[-1])
        self.assertEqual(inner,['python3','-c',code])
        self.assertEqual(outer[:7],['timeout','120','prlimit','--cpu=90','--fsize=25165824','--','sh'])
        # File names containing shell syntax are Python literals, not commands.
        weird="frame,';$(touch NEVER).png"
        (FIXTURE/weird).write_bytes(PNG.read_bytes())
        try:
            meta=self.read(FakeExecutor(delay=0),target=weird)
            self.assertEqual(meta['sha256'],SHA)
        finally: (FIXTURE/weird).unlink()
        self.assertFalse((ROOT/'NEVER').exists())

    def test_06_limits_empty_and_path(self):
        for c in (0,5,True):
            with self.assertRaises(capture.ReadbackError): self.read(FakeExecutor(),c)
        for target in ('../later.png','/later.png'):
            with self.assertRaises(capture.ReadbackError): self.read(FakeExecutor(),target=target)
        for deadline in (float('inf'),float('nan'),time.monotonic()-1):
            ex=FakeExecutor()
            with self.assertRaises(capture.ReadbackError): self.read(ex,deadline=deadline)
            self.assertEqual(ex.codes,[])
        empty=pathlib.Path(self.tmp.name)/'empty'; empty.write_bytes(b'')
        adapter.R=str(empty.parent)
        ex=FakeExecutor(delay=0); meta=self.read(ex,target='empty')
        self.assertEqual(meta['chunks'],0); self.assertEqual(self.dest.read_bytes(),b'')

    def test_07_real_immutable_identity_guards(self):
        source=pathlib.Path(self.tmp.name)/'frozen.png'
        adapter.R=str(source.parent)
        for mode in ('mutate','replace','oversize'):
            with self.subTest(mode=mode):
                source.write_bytes(PNG.read_bytes())
                if mode=='oversize':
                    with source.open('ab') as f: f.truncate(2097153)
                self.dest.write_bytes(b'old')
                class Changing(FakeExecutor):
                    def start(self,code,remaining):
                        if 'f.seek(0)' in code:
                            if mode=='mutate':
                                with source.open('r+b') as f: f.write(b'changed')
                            elif mode=='replace':
                                replacement=source.with_suffix('.new'); replacement.write_bytes(source.read_bytes()); replacement.replace(source)
                        return super().start(code,remaining)
                ex=Changing(delay=0)
                with self.assertRaises(capture.ReadbackError): self.read(ex,target='frozen.png')
                self.assertEqual(self.dest.read_bytes(),b'old'); self.assertFalse(ex.active)
                if mode=='oversize': self.assertEqual(ex.spans,[])
                else: self.assertEqual(len(ex.spans),4)
                self.assertFalse(list(self.dest.parent.glob('.*.readback-*')))

    def test_08_real_transport_failures_no_retry(self):
        for program in ('import sys;sys.exit(1)',
                        'import sys;sys.stderr.write("403 denied")',
                        'print("x"*8193)',
                        'print("invalid json")'):
            with self.subTest(program=program):
                jobs=[]
                class Tracked(capture.SubprocessExecutor):
                    def start(self,code,remaining):
                        job=super().start(code,remaining); jobs.append(job); return job
                ex=Tracked(lambda c,r:[sys.executable,'-c',program])
                self.dest.write_bytes(b'old')
                with self.assertRaises(capture.ReadbackError): self.read(ex)
                self.assertEqual(len(jobs),1)
                self.assertTrue(jobs[0].closed); self.assertIsNotNone(jobs[0].process.poll())
                self.assertEqual(self.dest.read_bytes(),b'old')
                self.assertFalse(list(self.dest.parent.glob('.*.readback-*')))


if __name__=='__main__':
    result=unittest.main(exit=False)
    destination=os.environ.get('READBACK_TEST_RESULT')
    if destination:
        path=pathlib.Path(destination); temporary=path.with_suffix('.new')
        temporary.write_text(json.dumps(dict(success=result.result.wasSuccessful(),testsRun=result.result.testsRun,
                                             sourceSHA256={str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest()
                                                           for p in [ROOT/'tools/boat-capture-readback.py',FIXTURE/'read.py',FIXTURE/'work.py',FIXTURE/'serial.py',PNG]},
                                             results=RESULTS),indent=2)+'\n')
        temporary.replace(path)
    sys.exit(0 if result.result.wasSuccessful() else 1)
