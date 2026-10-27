#!/usr/bin/env python3
"""External assertion adapter plus substitution controls. No browser or guest.

The retained independent reproducer is byte-for-byte unchanged. Its sole runner
SHA constant is rebound in an external AST adapter to this explicitly recorded
repair, since its historical pin and success-shaped assertions describe the bug.
The admission injection and complete production-entry call are never rewritten.
"""
import ast
import hashlib
import importlib.util
import json
import os
import pathlib
import sys
import tempfile
from unittest import mock

P = pathlib.Path
ROOT = P(__file__).resolve().parent.parent
RUNNER = ROOT/'test/fixtures/gl-transient-accounting/remote-run.py'
COLLECTOR = RUNNER.with_name('collect-evidence.py')
REPRO = ROOT/'test/test-gl-output-namespace-independent.py'
REPRO_SHA = 'c2af1d21e96800230e2bd7b266936979feb3d011fec8797e13c21c4203a5b628'
REAL_SPEC = importlib.util.spec_from_file_location


def load_independent():
    data = REPRO.read_bytes()
    assert hashlib.sha256(data).hexdigest() == REPRO_SHA
    tree = ast.parse(data)
    changes = 0
    for node in tree.body:
        if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'RUNNER_SHA' for t in node.targets):
            assert node.value.value == 'a520830a87b04086cd1994b9513e43314df91942b18295c4d8227bde69eba6ab'
            node.value.value = hashlib.sha256(RUNNER.read_bytes()).hexdigest()
            changes += 1
    assert changes == 1
    spec = REAL_SPEC('independent', REPRO)
    mod = importlib.util.module_from_spec(spec)
    exec(compile(tree, str(REPRO), 'exec'), mod.__dict__)
    return mod


def independent():
    i = load_independent()
    exercise = i.t.exercise
    observations = []
    def observe(source, *a, **kw):
        result = exercise(source, *a, **kw)
        targets = list((ROOT.parent/'ops').glob('gl-independent-*/outside-runner-accounting.log'))
        assert len(targets) == 1
        p = targets[0]
        observations.append(dict(result=result, externalBytes=len(p.read_bytes()),
                                 externalAllocated=p.stat().st_blocks*512))
        return result
    with mock.patch.object(i.t, 'exercise', observe):
        try:
            i.main()
        except TypeError:
            # Historical assertions index a successful collection. A refusal
            # returns None; require the actual runner AND collector failures.
            pass
        else:
            raise AssertionError('historical success-shaped repro unexpectedly completed')
    assert len(observations) == 1
    j = observations[0]; r = j['result']
    assert j['externalBytes'] == j['externalAllocated'] == 0, j
    assert r['error'] and 'single-link regular' in r['error'], r
    assert r['collectorError'] and 'single-link regular' in r['collectorError'], r
    assert r['collected'] is None and r['children'] == [], r
    assert not r['artifacts'].get('remote-final-accounting.json', {}).get('accountingComplete'), r
    report = dict(reproducerSHA256=REPRO_SHA, runnerSHA256=i.RUNNER_SHA,
                  adapter='external RUNNER_SHA constant only; historical success-shape TypeError interpreted only after independent safety assertions',
                  originalInjectionUnchanged=True, externalBytes=0, externalAllocated=0,
                  runnerError=r['error'], collectorError=r['collectorError'], children=r['children'],
                  collected=False, accountingComplete=False, runtimeObservations=0)
    (ROOT.parent/'ops/after-report.json').write_text(json.dumps(report, indent=2))
    print('PASS unchanged independent injection: runner and collector refuse; zero external writes/collection')


def normal():
    """Run the retained full-entry real Node collector audit and filename mutant."""
    data = (ROOT/'test/test-gl-output-namespace-controls.py').read_bytes()
    assert hashlib.sha256(data).hexdigest() == 'fcaede8c1de2ab95914b6cdd327addf28c319bb5ba0762861541602a11922d52'
    def spec(name, path, *a, **kw):
        s = REAL_SPEC(name, path, *a, **kw)
        if P(path) == REPRO:
            s.loader.exec_module = lambda mod: mod.__dict__.update(load_independent().__dict__)
        return s
    ns = dict(__file__=str(ROOT/'test/test-gl-output-namespace-controls.py'), __name__='__main__')
    with mock.patch.object(importlib.util, 'spec_from_file_location', spec):
        exec(compile(data, ns['__file__'], 'exec'), ns)


def helper(path):
    tree = ast.parse(path.read_text())
    nodes = [n for n in tree.body if isinstance(n, (ast.Import, ast.ImportFrom)) or
             isinstance(n, ast.ClassDef) and n.name == 'OutputFiles']
    ns = {}
    exec(compile(ast.Module(body=nodes, type_ignores=[]), str(path), 'exec'), ns)
    return ns['OutputFiles']


def rejected(action):
    try:
        action()
    except (OSError, RuntimeError, ValueError):
        return
    raise AssertionError('unsafe operation accepted')


def controls():
    results = []
    for source in (RUNNER, COLLECTOR):
        cls = helper(source)
        with tempfile.TemporaryDirectory(prefix='gl-file-controls-') as tmp:
            h = P(tmp)/'task'; e = h/'ops/output'; e.mkdir(parents=True)
            outside = P(tmp)/'external'; outside.write_bytes(b'')
            fs = cls(h)
            # Every descendant is part of the flat regular-file contract. No
            # directory, socket/FIFO, dangling link or hardlink may be skipped.
            for kind in ('symlink', 'dangling', 'directory', 'fifo', 'hardlink'):
                p = e/'bad'
                if kind == 'symlink':p.symlink_to(outside)
                elif kind == 'dangling':p.symlink_to(P(tmp)/'absent')
                elif kind == 'directory':p.mkdir()
                elif kind == 'fifo':os.mkfifo(p)
                else:os.link(outside,p)
                rejected(fs.check); rejected(lambda:fs.read('bad'))
                rejected(lambda:fs.write('legitimate.log',b'blocked'))
                if kind == 'directory':p.rmdir()
                else:p.unlink()
                assert outside.read_bytes() == b''
                results.append(source.name+':'+kind)
            for name in ('../external','ops/a','/external','..',''):
                rejected(lambda:fs.write(name,b'escape'));rejected(lambda:fs.read(name))
            fs.write('normal.log',b'normal')
            assert fs.read('normal.log') == b'normal'
            # Child result writes use a held descriptor rather than a mutable
            # leaf, including substitution after exclusive creation.
            try:
                with fs.create('child.json') as fd:
                    assert not (e/'child.json').exists()
                    assert os.fstat(fd).st_nlink == 0
                    (e/'child.json').symlink_to(outside)
                    P('/proc/self/fd',str(fd)).write_bytes(b'owned descriptor')
            except RuntimeError:
                pass
            else:raise AssertionError('child output substitution accepted')
            assert outside.read_bytes()==b'';(e/'child.json').unlink()
            # Late destination swap after verify but before anonymous open:
            # publication replaces the link itself, never its outside target.
            real_open = os.open
            def swap_destination(name, flags, *a, **kw):
                if flags & os.O_TMPFILE == os.O_TMPFILE:
                    (e/'normal.log').unlink();(e/'normal.log').symlink_to(outside)
                return real_open(name, flags, *a, **kw)
            with mock.patch.object(os,'open',swap_destination):
                rejected(lambda:fs.write('normal.log',b'next'))
            assert outside.read_bytes() == b''
            (e/'normal.log').unlink()
            assert not (e/'normal.log.new').exists()
            # Publication link is exclusive, including a symlink injected at
            # linkat itself. The anonymous inode is already complete by then.
            real_link = os.link
            def swap_temp(source, name, *a, **kw):
                if name == 'normal.log.new':(e/name).symlink_to(outside)
                return real_link(source, name, *a, **kw)
            with mock.patch.object(os,'link',swap_temp):
                rejected(lambda:fs.write('normal.log',b'next'))
            assert outside.read_bytes() == b'';(e/'normal.log.new').unlink()
            # Read-open races: O_NOFOLLOW and descriptor/name equality both
            # apply, including replacement by another valid regular inode.
            for kind in ('symlink','regular'):
                (e/'normal.log').write_bytes(b'inside')
                def swap_read(name, flags, *a, **kw):
                    fd = real_open(name, flags, *a, **kw)
                    if name == 'normal.log':
                        (e/name).unlink()
                        if kind == 'symlink':(e/name).symlink_to(outside)
                        else:(e/name).write_bytes(b'replaced')
                    return fd
                with mock.patch.object(os,'open',swap_read):rejected(lambda:fs.read('normal.log'))
                (e/'normal.log').unlink()
            # Mutation while reading must not hash and return an unstable file.
            (e/'normal.log').write_bytes(b'inside'); real_read=os.read;once=[]
            def mutate_read(fd,n):
                data=real_read(fd,n)
                if not once:once.append(True);(e/'normal.log').write_bytes(b'change')
                return data
            with mock.patch.object(os,'read',mutate_read):rejected(lambda:fs.read('normal.log'))
            # Directory substitution cannot redirect a subsequent operation.
            moved=h/'ops/old';e.rename(moved);e.symlink_to(P(tmp),target_is_directory=True)
            rejected(lambda:fs.write('escaped',b'escape'));rejected(fs.names)
            assert not (P(tmp)/'escaped').exists()
            results.append(source.name+':open-temp/read/metadata/directory-races')
    # Collector must fail rather than silently skip an unsafe leaf, and reject
    # replacement of an already read file while reading a later file.
    s=REAL_SPEC('collector',COLLECTOR);c=importlib.util.module_from_spec(s);s.loader.exec_module(c)
    with tempfile.TemporaryDirectory(prefix='gl-collector-controls-') as tmp:
        h=P(tmp)/'task';e=h/'ops/output';e.mkdir(parents=True)
        outside=P(tmp)/'external';outside.write_bytes(b'secret')
        for kind in ('symlink','directory','fifo','hardlink'):
            p=e/'bad'
            if kind=='symlink':p.symlink_to(outside)
            elif kind=='directory':p.mkdir()
            elif kind=='fifo':os.mkfifo(p)
            else:os.link(outside,p)
            rejected(lambda:c.collect(h))
            if kind=='directory':p.rmdir()
            else:p.unlink()
        (e/'a.log').write_bytes(b'a');(e/'z.log').write_bytes(b'z')
        read=c.OutputFiles.read
        def replaced_after_read(fs,name):
            data=read(fs,name)
            if name=='z.log':
                (e/'a.log').unlink();(e/'a.log').write_bytes(b'new')
            return data
        with mock.patch.object(c.OutputFiles,'read',replaced_after_read):rejected(lambda:c.collect(h))
        results.append('collector:refuse-types-and-whole-inventory-replacement')
    print(json.dumps(dict(controls=results, externalWrites=0)))


def omission():
    """Late post-child injection isolates the log-write guard from prechecks."""
    i=load_independent(); original_spec=importlib.util.spec_from_file_location
    source=i.source; needle="outputs.write(name+'.log',out)"
    assert source.count(needle)==1
    def challenge(code):
        with tempfile.TemporaryDirectory(prefix='gl-late-') as tmp:
            target=P(tmp)/'external';target.write_bytes(b'');clean=[]
            def spec(name,path,*a,**kw):
                s=original_spec(name,path,*a,**kw)
                if P(path).name=='palette-browser-supervisor.py':
                    load=s.loader.exec_module
                    def loading(mod):
                        load(mod);supervise=mod.supervise
                        def child(argv,**kwargs):
                            r=supervise(argv,**kwargs)
                            if '-c' in argv and 'localFake' in argv[-1]:
                                clean.append(r['cleanupComplete'])
                                output=P(os.environ['PALETTE_GPU_EVIDENCE']).parent
                                (output/'node-startup.log').symlink_to(target)
                            return r
                        mod.supervise=child
                    s.loader.exec_module=loading
                return s
            with mock.patch.object(importlib.util,'spec_from_file_location',spec):r=i.t.exercise(code)
            assert clean==[True] and r['error'] and r['collectorError'],r
            assert target.read_bytes()==b'','unsafe log write escaped after supervised child cleanup'
    challenge(source)
    try:challenge(source.replace(needle,"(E/(name+'.log')).write_bytes(out)"))
    except AssertionError as e:
        assert str(e)=='unsafe log write escaped after supervised child cleanup',str(e)
    else:raise AssertionError('removed log confinement escaped the challenge')
    print('PASS late production log substitution; single removed log-write guard mutant REJECTED')


def primary():
    i=load_independent();replace=os.replace
    with tempfile.TemporaryDirectory(prefix='gl-primary-') as tmp:
        target=P(tmp)/'external';target.write_bytes(b'')
        def inject(a,b):
            replace(a,b)
            if P(b).name=='remote-admission.json':
                (P(b).parent/'node-startup.log').symlink_to(target)
                raise RuntimeError('primary-sentinel')
        with mock.patch.object(os,'replace',inject):r=i.t.exercise(i.source)
        assert r['error']=="RuntimeError('primary-sentinel')",r
        assert r['children']==[] and r['collected'] is None and r['collectorError'],r
        assert target.read_bytes()==b''
    print('PASS exact entry preserves original exception when diagnostic/final writes refuse the namespace')


def collector_omission():
    data=COLLECTOR.read_text();needle='data=output.read(name)'
    assert data.count(needle)==1
    def challenge(source):
        ns=dict(__name__='collector_test');exec(compile(source,str(COLLECTOR),'exec'),ns)
        cls=ns['OutputFiles'];verify=cls.verify;read_bytes=P.read_bytes
        with tempfile.TemporaryDirectory(prefix='gl-collect-race-') as tmp:
            h=P(tmp)/'task';e=h/'ops/output';e.mkdir(parents=True)
            outside=P(tmp)/'external';outside.write_bytes(b'secret')
            (e/'data.log').write_bytes(b'normal');calls=[];external=[]
            def swapped(fs,fd):
                names=verify(fs,fd);calls.append(True)
                if len(calls)==2:
                    (e/'data.log').unlink();(e/'data.log').symlink_to(outside)
                return names
            def observed_read(p,*a,**kw):
                result=read_bytes(p,*a,**kw)
                if p==e/'data.log':external.append(result)
                return result
            with mock.patch.object(cls,'verify',swapped),mock.patch.object(P,'read_bytes',observed_read):
                rejected(lambda:ns['collect'](h))
            assert not external,'unsafe collector read escaped before its final inventory check'
    challenge(data)
    mutant=data.replace(needle,"data=(pathlib.Path(task_root)/'ops/output'/name).read_bytes()")
    try:challenge(mutant)
    except AssertionError as e:
        assert str(e)=='unsafe collector read escaped before its final inventory check',str(e)
    else:raise AssertionError('removed collector read confinement escaped challenge')
    print('PASS collector late-leaf substitution; single safe-read call removal mutant REJECTED before external read')


if __name__ == '__main__':
    dict(independent=independent, normal=normal, controls=controls, omission=omission,
         primary=primary,collector_omission=collector_omission)[sys.argv[1]]()
