import ast,pathlib,hashlib,json,shlex,sys,runpy,subprocess,types,tempfile,resource,os
from unittest import mock
O=pathlib.Path(os.environ['RICOCHET_ACCEPT_OPS']);R=O.parent/'repo';B=R/'docs/reviews/ricochet-final-inventory-writer-contract-repair-oct27'
manifest=json.loads((B/'producer-manifest.json').read_text());receipts=[]
for n,expected in manifest['sources'].items():
    raw=(B/('api-'+n+'-command.json')).read_bytes();assert hashlib.sha256(raw).hexdigest()==expected
    bounded=json.loads((B/('bounded-api-'+n+'-command.json')).read_bytes())
    captured=[]
    def intercept(argv,**kw):
        assert kw=={'check':False};assert argv==bounded['argv'];captured.append(argv)
        return types.SimpleNamespace(returncode=0)
    with mock.patch.object(sys,'argv',[str(R/'tools/ricochet/production-commands.py'),n,'--bundle',str(B)]),mock.patch.object(subprocess,'run',intercept):
        try:runpy.run_path(str(R/'tools/ricochet/production-commands.py'),run_name='__main__')
        except SystemExit as e:assert e.code==0
    assert len(captured)==1
    argv=shlex.split(captured[0][-1]);assert argv[:3]==['python3','-B','-c']
    source=argv[3];assert hashlib.sha256(source.encode()).hexdigest()==manifest['transformedSources'][n]
    original=shlex.split(json.loads(raw)['argv'][-1])[-1]
    head,tail=source.split(';end=time.monotonic()+30',1)
    oldhead,oldtail=original.split(';end=time.monotonic()+30',1);assert tail==oldtail
    assert captured[0][:-1]==json.loads(raw)['argv'][:-1]
    assignment=next(x for x in ast.parse(original).body if isinstance(x,ast.Assign) and isinstance(x.targets[0],ast.Name) and x.targets[0].id=='j')
    payload=ast.literal_eval(assignment.value)
    with tempfile.TemporaryDirectory() as temp:
        h=pathlib.Path(temp);serial=h/'serial';serial.mkdir();c=serial/'continue.json';retained=h/'retained';retained.write_bytes(b'retained')
        helper=R/'tools/ricochet/control-publisher.py';(h/helper.name).write_bytes(helper.read_bytes())
        path=pathlib.Path
        def mapped(v):return h if v=='/tmp/ricochet-measured-cpu-round-gameplay-oct27' else path(v)
        with mock.patch.object(pathlib,'Path',mapped):exec(compile(head,'<exact-CLI-dispatched-prefix>','exec'),{})
        assert json.loads(c.read_bytes())==payload and c.stat().st_nlink==1;c.unlink()
        exists=path.exists;hits=[]
        def raced(p):
            answer=exists(p)
            if p==c and not hits:c.symlink_to(retained);hits.append(True)
            return answer
        try:
            with mock.patch.object(pathlib,'Path',mapped),mock.patch.object(path,'exists',raced):exec(compile(head,'<unchanged-historical-prefix-race>','exec'),{})
        except FileExistsError:pass
        else:raise AssertionError('production CLI prefix accepted late symlink')
        assert hits==[True] and retained.read_bytes()==b'retained';c.unlink()
        # Original exists()/write_text prefix is a discriminating negative control.
        hits.clear()
        with mock.patch.object(pathlib,'Path',mapped),mock.patch.object(path,'exists',raced):exec(compile(oldhead,'<original-unbounded-writer-control>','exec'),{})
        assert retained.read_bytes()!=b'retained' and c.is_symlink()
    receipts.append(dict(producer=n,originalSHA256=expected,transformedSHA256=manifest['transformedSources'][n],cliArgvExact=True,payloadExact=True,pollingAndNoReplayTailExact=True,symlinkAttackRejected=True,originalWriterControlViolated=True,writerFSIZE=resource.getrlimit(resource.RLIMIT_FSIZE)))
(O/'boundary-checkpoint.json').write_text(json.dumps(dict(status='PASS',candidate='93fce294621b5f40a1a23f6711c555dc5159e554',receipts=receipts,scope='Only outer API subprocess intercepted; dispatched exact prefix executed in owned fixture. No API/polling tail ran.'),indent=2))
print('PASS actual CLI all4 exact dispatch/prefix/payload/tails; strict historical symlink attack rejects; original writers fail control')
