"""Independent small fixtures. A failure is evidence; never fixes production."""
import contextlib,hashlib,importlib.util,io,json,os,runpy,stat,sys,tempfile
from pathlib import Path
R=Path(__file__).resolve().parents[1]/'repo'
P=R/'tools/enigma-bounded-staging.py'
spec=importlib.util.spec_from_file_location('candidate',P)
s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)
mutation=os.environ.get('ACCEPT_MUTATION','')
if mutation:
    code=P.read_text()
    if mutation=='skip-duplicate': code=code.replace('consume(row, stream)\n','pass # mutant skips duplicate donor\n')
    elif mutation=='double-charge':code=code.replace('if key not in seen:', 'if True:')
    else: raise ValueError(mutation)
    exec(compile(code,str(P), 'exec'),s.__dict__)
def row(p,target):
    b=p.read_bytes();return dict(kind='file',path=str(p),target=target,bytes=len(b),sha256=hashlib.sha256(b).hexdigest())
def oracle(root):
    entries=[]
    for d,ds,fs in os.walk(root):
        entries.append(Path(d).stat())
        entries.extend((Path(d)/f).stat() for f in fs)
    ids={(x.st_dev,x.st_ino):x.st_blocks*512 for x in entries}
    return dict(files=sum(stat.S_ISREG(x.st_mode) for x in entries),logicalBytes=sum(x.st_size for x in entries if stat.S_ISREG(x.st_mode)),physicalOwnedBytes=sum(ids.values()),pathSummedAllocatedBytes=sum(x.st_blocks*512 for x in entries),uniqueInodes=len(ids))
def group_identity(t):
    a=t/'a';b=t/'b';a.write_bytes(b'\0fixture\xff'*1073);b.write_bytes(a.read_bytes())
    a.chmod(0o444);b.chmod(0o444)
    rows=[row(a,'runner/fonts/a'),row(b,'runtime/fonts/b'),row(a,'vfs/fonts/a'),row(a,'runtime/fontside/a'),row(a,'runner/fonts-extra/a')]
    out=t/'output';receipt=s.stage(rows,out)
    assert receipt==oracle(out),(receipt,oracle(out))
    assert (out/rows[0]['target']).stat().st_ino==(out/rows[1]['target']).stat().st_ino
    ids=[]
    for x in rows:
        p=out/x['target'];assert p.read_bytes()==a.read_bytes()
        assert not os.path.samefile(p,a) and not os.path.samefile(p,b)
        ids.append((p.stat().st_dev,p.stat().st_ino))
    assert len(set(ids))==4
    for x in rows[:2]:assert stat.S_IMODE((out/x['target']).stat().st_mode)==0o444
    # Writing an independent nonfont may not corrupt aliases or donor content.
    (out/rows[2]['target']).write_bytes(b'changed');assert (out/rows[0]['target']).read_bytes()==a.read_bytes()
    # A duplicate donor changed AFTER its pin must still be read and rejected.
    b.chmod(0o644);bad=[rows[0],rows[1]];b.write_bytes(b'X'*bad[1]['bytes'])
    try:s.stage(bad,t/'bad')
    except ValueError:pass
    else:raise AssertionError('changed duplicate donor was accepted')
    assert not (t/'bad').exists()
    return receipt
def group_cleanup(t):
    donor=t/'donor';donor.write_bytes(b'abc');sentinel=t/'.enigma-stage-foreign';sentinel.mkdir();(sentinel/'keep').write_bytes(b'evidence')
    rows=[row(donor,'runner/fonts/a'),row(donor,'runtime/fonts/a')]
    original=s.os.link
    def broken(*a):raise OSError('injected EIO')
    for failure in ['link','interrupt','missing','oversized','namespace']:
        rr=[dict(x) for x in rows]
        @contextlib.contextmanager
        def opener(r):
            if r['target']==rr[1]['target'] and failure=='interrupt':raise KeyboardInterrupt('fixture')
            with s.source(r) as f:yield f
        if failure=='link':s.os.link=broken
        if failure=='missing':rr[1]['path']=str(t/'missing')
        if failure=='oversized':rr[1]['bytes']=2
        if failure=='namespace':rr[1]['target']='runner/fonts/a/child'
        try:s.stage(rr,t/'out',opener)
        except (OSError,KeyboardInterrupt,ValueError):pass
        else:raise AssertionError('expected failure '+failure)
        finally:s.os.link=original
        assert not (t/'out').exists();assert donor.read_bytes()==b'abc'
        assert list(t.glob('.enigma-stage-*'))==[sentinel]
    for existing in ['directory','dangling-link']:
        dest=t/existing
        if existing=='directory':dest.mkdir();(dest/'keep').write_bytes(b'old')
        else:dest.symlink_to(t/'absent')
        try:s.stage(rows,dest)
        except FileExistsError:pass
        else:raise AssertionError('existing destination accepted')
        assert os.path.lexists(dest)
    assert (t/'directory/keep').read_bytes()==b'old'
    return dict(cases=7,foreignTempPreserved=True)
def group_modes(t):
    observed=[]
    for mode in [0o600,0o755]:
        p=t/('donor'+str(mode));p.write_bytes(b'#!/bin/sh\nexit 0\n');p.chmod(mode)
        dest=t/('out'+str(mode));s.stage([row(p,'runner/required')],dest)
        actual=stat.S_IMODE((dest/'runner/required').stat().st_mode)
        observed.append(dict(source=oct(mode),destination=oct(actual),contentPreserved=(dest/'runner/required').read_bytes()==p.read_bytes()))
    print(json.dumps(dict(modeObservations=observed)),flush=True)
    assert all(x['source']==x['destination'] for x in observed),'required nonfont permissions are not preserved'
    return observed
def group_recipe(t):
    # Execute the exact recipe, replacing ONLY the manifest/pin data reads with
    # tiny owned inputs. Its helper import, validations, CLI and stage are real.
    recipe=R/'docs/re-notes/enigma-staging-footprint-repair-20261026/verify-and-stage.py'
    import gzip
    from unittest.mock import patch
    donor=t/'donor';donor.write_bytes(b'recipe font\0'*37)
    rows=[row(donor,'runner/fonts/a'),row(donor,'runtime/fonts/a'),row(donor,'vfs/writable')]
    raw=json.dumps(rows).encode();compressed=gzip.compress(raw)
    oldb=Path.read_bytes;oldt=Path.read_text
    def rb(p,*a,**kw):return compressed if p.name=='required-manifest.json.gz' else oldb(p,*a,**kw)
    def rt(p,*a,**kw):return json.dumps(dict(manifest=dict(sha256=hashlib.sha256(raw).hexdigest()))) if p.name=='input-pins.json' else oldt(p,*a,**kw)
    dest=t/'output';capture=io.StringIO()
    with patch.object(Path,'read_bytes',rb),patch.object(Path,'read_text',rt),patch.object(sys,'argv',[str(recipe),'--stage',str(dest)]),contextlib.redirect_stdout(capture):
        runpy.run_path(str(recipe),run_name='__main__')
    receipt=json.loads(capture.getvalue());assert receipt['files']==3 and len(receipt['aliases'])==1
    assert receipt['staging']==oracle(dest);assert receipt['actualFullStaging'] and not receipt['guestExecuted']
    assert not os.path.samefile(donor,dest/'runner/fonts/a')
    return dict(smallFixtureOnly=True,receipt=receipt)
if __name__=='__main__':
    group=sys.argv[1]
    with tempfile.TemporaryDirectory(prefix='fixture-',dir=Path(__file__).parent) as d:
        result=globals()['group_'+group](Path(d))
    print(json.dumps(dict(group=group,mutation=mutation,status='PASS',result=result),sort_keys=True))
