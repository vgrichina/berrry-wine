#!/usr/bin/env python3
"""Full production entry point; only host constants and child workload are local fakes.

No Node, Chrome, WATX or guest is executed. The production integrity, ELF/version
checks, ledger, callbacks, writes, environment handoff and finalizer all execute.
"""
import ast
import contextlib
import datetime
import hashlib
import importlib.util
import io
import json
import os
import pathlib
import shutil
import sys
import tempfile
import unittest
from unittest import mock

P=pathlib.Path
ROOT=P(__file__).resolve().parent.parent
RUNNER=ROOT/'test/fixtures/gl-transient-accounting/remote-run.py'
HELPER=ROOT/'test/helpers/palette-browser-supervisor.py'
OLD=RUNNER.with_name('remote-run-before.py')
OLD_SHA='3ccde695a00edd757c05d7f1ec3d5d646d4b26baf4e60ea0abdcd3e5da901f4c'
M=1048576

def allocated(root):
    return sum(p.lstat().st_blocks*512 for p in [root,*root.rglob('*')])

def anonymous_allocated(root):
    # Independent physical oracle, not the production staging registry.
    seen = {}
    for entry in P('/proc/self/fd').iterdir():
        try:
            if os.readlink(entry).startswith(str(root) + '/'):
                st = os.stat(entry)
                if st.st_nlink == 0:
                    seen[(st.st_dev, st.st_ino)] = st.st_blocks * 512
        except FileNotFoundError:
            pass
    return sum(seen.values())

def exercise(source, fault=None, boundary='admission', child_failure=None):
    """Transform ONLY task root, executable constants and lifecycle constants.

    The installed harmless ELF handles real --version. At supervise() the actual
    supervisor owns a deterministic Python child in place of Node's workload.
    """
    with tempfile.TemporaryDirectory(prefix='gl-entry-') as tmp:
        h=P(tmp);ops=h/'ops';repo=h/'repo';src=h/'source'
        for d in (ops,repo/'test/helpers',src,h/'tmp'):d.mkdir(parents=True,exist_ok=True)
        shutil.copyfile(HELPER,repo/'test/helpers/palette-browser-supervisor.py')
        (src/'input.wat').write_bytes(b'immutable source\n')
        fixture=repo/'test/fixture.js';fixture.write_bytes(b'immutable fixture\n')
        digest=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
        pins=dict(source=dict(files=[dict(path='input.wat',sha256=digest(src/'input.wat'))]),fixture=dict(head='local-fixture',tree='local-tree',files={'test/fixture.js':digest(fixture),'test/test-d3dim-palette-gpu-web.js':'oracle-pin'}),moduleSHA256='module-pin')
        # Both fixture entries must really exist and pass production integrity.
        oracle=repo/'test/test-d3dim-palette-gpu-web.js';oracle.write_bytes(b'local oracle stand-in\n')
        pins['fixture']['files']['test/test-d3dim-palette-gpu-web.js']=digest(oracle)
        (ops/'pins.json').write_text(json.dumps(pins));(ops/'inputs-manifest.json').write_text(json.dumps({'fixture':'local'}));(ops/'remote-run.py').write_text(source)
        tree=ast.parse(source)
        constants={}
        for n in tree.body:
            if isinstance(n,ast.Assign):
                for t in n.targets:
                    if isinstance(t,ast.Name) and t.id=='H':constants[n.value.args[0].value]=str(h)
                    if isinstance(t,ast.Name) and t.id in ('NODE','CHROME'):constants[n.value.value]='/usr/bin/true'
        class Host(ast.NodeTransformer):
            def visit_Constant(self,n):
                if isinstance(n.value,str) and n.value in constants:return ast.copy_location(ast.Constant(constants[n.value]),n)
                return n
        tree=Host().visit(tree);ast.fix_missing_locations(tree)
        events=[];children=[];ledgers=[];samples=[];writes=[];ns={'__name__':'__main__'}
        original_spec=importlib.util.spec_from_file_location;original_replace=os.replace
        original_read=P.read_text;cwd=P.cwd();env=dict(os.environ)
        def mutate():
            if fault is None:return
            target,action=fault;p={'pins':ops/'pins.json','manifest':ops/'inputs-manifest.json','source':src/'input.wat','fixture':fixture}[target]
            if action=='delete':p.unlink()
            elif action=='truncate':p.write_bytes(b'')
            elif action=='replace':
                b=p.read_bytes();p.unlink();p.write_bytes(b)
            elif action=='mtime':os.utime(p,ns=(p.stat().st_atime_ns,p.stat().st_mtime_ns+1000000000))
            else:
                b=p.read_bytes();p.write_bytes(bytes([b[0]^1])+b[1:])
            events.append('fault:'+target+':'+action)
        def replace(a,b):
            # Production publishes through verified directory descriptors. Map
            # procfs parents for observation only; do not resolve mutable leaves.
            def observed(p):
                p=P(p)
                return P(os.readlink(p.parent))/p.name if str(p.parent).startswith('/proc/self/fd/') else p
            observed_a,observed_b=observed(a),observed(b)
            writes.append(dict(temp=str(observed_a.relative_to(h)),output=str(observed_b.relative_to(h)),bytes=allocated(h)))
            if fault is None and 'E' in ns and ledgers and ledgers[-1].receipt['samples']>0:
                self_bytes=ledgers[-1].allocated()
                assert self_bytes==allocated(h),'atomic temp or other output bytes excluded'
            original_replace(a,b)
            if P(b).name=='remote-admission.json':
                events.append('admission-saved')
                if boundary=='admission':mutate()
            if P(b).name=='node-startup-receipt.json' and boundary=='startup-receipt':mutate()
        def spec(name,path,*a,**kw):
            result=original_spec(name,path,*a,**kw)
            if P(path)==repo/'test/helpers/palette-browser-supervisor.py':
                load=result.loader.exec_module
                def loading(mod):
                    load(mod);real=mod.supervise;ledger=mod.AllocatedDisk
                    class Observed(ledger):
                        def __init__(self,*a,**kw):super().__init__(*a,**kw);ledgers.append(self)
                        def allocated(self):
                            value=super().allocated()
                            staged=ns['outputs'].allocated_staging() if 'outputs' in ns else 0
                            samples.append(dict(bytes=value,actual=allocated(h),staging=staged,
                                                complete=value+staged,
                                                actualComplete=allocated(h)+anonymous_allocated(h)))
                            assert samples[-1]['complete']==samples[-1]['actualComplete']
                            return value
                    mod.AllocatedDisk=Observed
                    def child(argv,**kw):
                        name='startup' if '-e' in argv else 'test';children.append(name)
                        if name=='startup':code='import json;print(json.dumps({"localFake":True}))'
                        else:
                            code='import os,json,pathlib; p=pathlib.Path(os.environ["PALETTE_GPU_EVIDENCE"]); p.write_text(json.dumps('+repr(dict(wasmSha256='module-pin',stage='passed',results=[dict(version=v,observations=[{}]*42,stats=dict(fallbacks=0)) for v in (1,2)]))+')); print("local fake child")'
                        if child_failure==name:code+=';raise SystemExit(7)'
                        return real([sys.executable,'-c',code],**kw)
                    mod.supervise=child
                result.loader.exec_module=loading
            return result
        def read(p,*a,**kw):
            if p==P('/proc/meminfo'):return 'MemAvailable: 8388608 kB\n'
            return original_read(p,*a,**kw)
        error=None
        class Clock(datetime.datetime):
            @classmethod
            def now(cls,tz=None):return cls(2026,10,26,0,0,tzinfo=datetime.timezone.utc)
        try:
            with mock.patch.object(datetime,'datetime',Clock),mock.patch.object(importlib.util,'spec_from_file_location',spec),mock.patch.object(os,'replace',replace),mock.patch.object(P,'read_text',read),mock.patch.object(sys,'argv',['remote-run.py',str(repo/'test/helpers/palette-browser-supervisor.py')]),mock.patch.object(shutil,'disk_usage',return_value=shutil._ntuple_diskusage(16*1024*M,0,16*1024*M)),contextlib.redirect_stdout(io.StringIO()):
                try:exec(compile(tree,str(RUNNER),'exec'),ns)
                except BaseException as exc:error=repr(exc)
        finally:
            os.chdir(cwd);os.environ.clear();os.environ.update(env)
        # Collect from the production evidence contract (legacy O, repaired E).
        output=ns.get('E',ops)
        artifacts={p.name:json.loads(p.read_text()) for p in output.glob('*.json')}
        collected=None;collector_error=None
        if 'E' in ns:
            cs=original_spec('collector',RUNNER.with_name('collect-evidence.py'));cm=importlib.util.module_from_spec(cs);cs.loader.exec_module(cm)
            try:collected=cm.collect(h)
            except Exception as exc:collector_error=repr(exc)
        return dict(error=error,collectorError=collector_error,events=events,children=children,samples=samples,writes=writes,artifacts=artifacts,collected=collected,outputRelative=str(output.relative_to(h)),actualBytes=allocated(h),files=[str(p.relative_to(h)) for p in h.rglob('*') if p.is_file()],lastLedger=ledgers[-1].receipt if ledgers else None)

class Entry(unittest.TestCase):
    def test_unchanged_published_failure(self):
        source=OLD.read_text();self.assertEqual(hashlib.sha256(source.encode()).hexdigest(),OLD_SHA)
        r=exercise(source)
        self.assertIn('required directory namespace changed',r['error'])
        self.assertEqual(r['children'],[]);self.assertEqual(r['events'],['admission-saved'])
        self.assertIn('remote-admission.json',r['artifacts'])
        self.assertNotIn('remote-final-accounting.json',r['artifacts'])
        print('BASELINE retained exact runner FAIL before Node, own admission output changes ops namespace')

    def test_full_repaired_entry(self):
        r=exercise(RUNNER.read_text());self.assertIsNone(r['error'],r)
        self.assertEqual(r['children'],['startup','test']);self.assertEqual(r['outputRelative'],'ops/output')
        a=r['artifacts'];self.assertTrue(a['checkpoint.json']['success']);self.assertTrue(a['integrity-after.json']['source149'])
        for n in ['integrity-before.json','executables.json','remote-admission.json','node-startup.json','node-startup-receipt.json','invocation-start.json','test-receipt.json','test-result.json','remote-final-accounting.json']:self.assertIn(n,a)
        for n in ['node-startup-receipt.json','test-receipt.json']:self.assertTrue(a[n]['cleanupComplete']);self.assertIsNone(a[n]['stopReason'])
        self.assertTrue(all(s['bytes']==s['actual'] for s in r['samples']))
        self.assertGreater(len(r['samples']),6)
        self.assertEqual(r['samples'][-1]['bytes'],r['actualBytes'])
        self.assertTrue(all(w['temp'].startswith('ops/output/') and w['output'].startswith('ops/output/') for w in r['writes']))
        self.assertFalse(any(p.endswith('.new') for p in r['files']))
        self.assertGreater(r['samples'][-1]['bytes'],r['samples'][0]['bytes'])
        self.assertTrue(a['remote-final-accounting.json']['accountingComplete'])
        self.assertEqual(a['remote-final-accounting.json']['completeBytes'],r['actualBytes'])
        c=r['collected'];self.assertEqual(c['receiptCount'],2);self.assertTrue(c['cleanupComplete']);self.assertTrue(c['testInvoked'])
        self.assertNotIn('pins.json',c['files']);self.assertIn('test.log',c['files']);self.assertIn('test-result.json',c['files'])
        print('PASS complete production entry; real supervised fake children, counted atomic temps/logs/results/final outputs')

    def test_required_faults_refuse_next_child(self):
        for boundary in ['admission','startup-receipt']:
            for target in ['pins','manifest','source','fixture']:
                for action in ['mutate','delete','truncate','replace','mtime']:
                    with self.subTest(boundary=boundary,target=target,action=action):
                        r=exercise(RUNNER.read_text(),(target,action),boundary)
                        self.assertIsNotNone(r['error'],r);self.assertEqual(r['children'],[] if boundary=='admission' else ['startup'])
                        a=r['artifacts'];self.assertIn('failure.json',a)
                        self.assertFalse(a['remote-final-accounting.json']['accountingComplete'])
                        self.assertIsNone(a['remote-final-accounting.json']['completeBytes'])
                        self.assertIn('error',a['remote-final-accounting.json'])
                        self.assertNotIn('test-result.json',a)
                        if boundary=='startup-receipt':self.assertTrue(a['node-startup-receipt.json']['cleanupComplete'])
        print('Completed 40 required ops/source/fixture fault subcases; see unittest verdict')

    def test_child_failure_cleanup_and_known_final_bytes(self):
        for name in ['startup','test']:
            with self.subTest(child=name):
                r=exercise(RUNNER.read_text(),child_failure=name);a=r['artifacts']
                self.assertEqual(r['children'],['startup'] if name=='startup' else ['startup','test'])
                self.assertTrue(a['remote-final-accounting.json']['accountingComplete'])
                self.assertEqual(a['remote-final-accounting.json']['completeBytes'],r['actualBytes'])
                rec=a[('node-startup' if name=='startup' else 'test')+'-receipt.json']
                self.assertEqual(rec['exit'],7);self.assertTrue(rec['cleanupComplete']);self.assertIsNone(rec['stopReason'])
                if name=='startup':
                    self.assertIsNotNone(r['error']);self.assertIn('failure.json',a);self.assertNotIn('checkpoint.json',a)
                else:
                    self.assertIsNone(r['error']);self.assertFalse(a['checkpoint.json']['success'])

if __name__=='__main__':unittest.main()
