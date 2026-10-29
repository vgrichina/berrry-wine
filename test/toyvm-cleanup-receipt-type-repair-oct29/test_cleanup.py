#!/usr/bin/env python3
"""Actual caller API/CLI with deterministic receipts; no backend or child executes."""
import contextlib, copy, importlib.util, io, json, pathlib, sys, tempfile
from unittest.mock import patch

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[1]
source = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT/'test/toyvm-bounded24-caller-wiring-oct28/qualify_accounted.py'
spec = importlib.util.spec_from_file_location('cleanup_caller', source)
c = importlib.util.module_from_spec(spec); spec.loader.exec_module(c)
receipt = pathlib.Path(sys.argv[1])
limits = dict(live_limit=32768, write_limit=65536, file_limit=16384, rss_limit=128*1024**2,
              cpu_limit=1.25, wall_limit=2.5, output_limit=4096)
command = [sys.executable, '-B', '-c', 'print("bounded child success")']
base = dict(exit=0, stopReason=None, peakRSS=10000000, cpuSeconds=.01, wallSeconds=.1,
            output=b'bounded child success\n', cleanupComplete=True,
            filesystem=dict(live=12288, peak=12288, written=5, failure=None, openHandles=0),
            filesystemCleanup=dict(unmountExit=0, remainingMounts=[], serverExit=-15,
                                   serverStdout='', serverStderr=''))
checks=[]
MISSING=object()
with tempfile.TemporaryDirectory(prefix='cleanup-', dir=HERE) as tmp:
    work=pathlib.Path(tmp)
    def invoke(result, expected, name, *, exception=False, domain='tiny-fixture'):
        calls=[]
        def backend(argv, actual_work, **forwarded):
            assert argv==command and actual_work==work
            assert forwarded==dict(limits,backend='synchronous-fuse')
            calls.append(True)
            if exception:
                e=RuntimeError('deterministic backend exception'); e.filesystemCleanup=result['filesystemCleanup']; raise e
            return copy.deepcopy(result)
        with patch.object(c,'load_backend',return_value=backend), patch('subprocess.Popen',side_effect=AssertionError('no process allowed')) as spawn:
            api=c.qualify(domain=domain,receipt=receipt,command=command,work=work,**limits)
            args=['--domain',domain,'--receipt',str(receipt),'--work',str(work)]
            for k,v in limits.items():args.extend(['--'+k.replace('_','-'),str(v)])
            stream=io.StringIO()
            with contextlib.redirect_stdout(stream): code=c.main(args+['--']+command)
            cli=json.loads(stream.getvalue())
            spawn.assert_not_called()
        assert json.dumps(api,sort_keys=True)==json.dumps(cli,sort_keys=True),(name,api,cli)
        assert api['accepted'] is expected and code==(0 if expected else 1),(name,api,code)
        assert api['browserAllowed'] is False and api['browserAllowanceRemaining']==c.BROWSER_ALLOWANCE
        assert len(calls)==(0 if domain!='tiny-fixture' else 2)
        if not expected and not exception and domain=='tiny-fixture' and name.startswith('cleanup:'):
            assert api['cleanupComplete'] is False and 'cleanup not established' in api['failures'],name
        if exception:
            assert api['cleanupComplete'] is False
            assert api['filesystemCleanupComplete'] is c.filesystem_clean(result['filesystemCleanup'])
        checks.append(name)
    # Original adversarial input first, with both production entry points.
    r=copy.deepcopy(base);r['filesystemCleanup']['unmountExit']=False
    invoke(r,False,'cleanup:original-False-unmount')
    for field,values,valid_values in [
        ('unmountExit',[True,0.0,1.0,-0.0,float('nan'),float('inf'),'0',[],{},1,-15,MISSING,None,0],(None,0)),
        ('serverExit',[False,True,0.0,-15.0,float('nan'),float('inf'),None,'0',[] ,{},1,-9,MISSING,0,-15],(0,-15)),
        ('remainingMounts',[None,False,0,{},'',(),['owned mount'],MISSING,[]],([],)),
    ]:
        for i,value in enumerate(values):
            r=copy.deepcopy(base)
            if value is MISSING:r['filesystemCleanup'].pop(field)
            else:r['filesystemCleanup'][field]=value
            expected=any(type(value) is type(v) and value==v for v in valid_values)
            invoke(r,expected,'cleanup:'+field+':'+str(i))
    for value in [None,False,0,1,1.0,[],{},'true',MISSING,True]:
        r=copy.deepcopy(base)
        if value is MISSING:r.pop('cleanupComplete')
        else:r['cleanupComplete']=value
        invoke(r,value is True,'cleanup:complete:'+repr(value))
    for value in [None,False,0,[], 'cleanup',MISSING]:
        r=copy.deepcopy(base)
        if value is MISSING:r.pop('filesystemCleanup')
        else:r['filesystemCleanup']=value
        invoke(r,False,'cleanup:shape:'+repr(value))
    for unmount in [None,0]:
        for server in [0,-15]:
            r=copy.deepcopy(base);r['filesystemCleanup'].update(unmountExit=unmount,serverExit=server)
            invoke(r,True,'legitimate:'+repr((unmount,server)))
            invoke(r,False,'exception-legitimate:'+repr((unmount,server)),exception=True)
    r=copy.deepcopy(base);r['filesystemCleanup']['unmountExit']=False
    invoke(r,False,'exception-malformed',exception=True)
    for domain in ['browser','browser-profile','unknown']:
        invoke(base,False,'domain:'+domain,domain=domain)
    # Changed caller regressions: cleanup cannot override unknown/failure evidence.
    for field,value in [('stopReason','accounting unknown'),('stopReason',MISSING),('exit',7),
                        ('filesystem',None),('cpuSeconds',2),('wallSeconds',float('nan')),
                        ('peakRSS',MISSING),('output',b'x'*4097)]:
        r=copy.deepcopy(base)
        if value is MISSING:r.pop(field)
        else:r[field]=value
        # NaN does not compare equal to itself; omit this redundant equality fixture.
        if field=='wallSeconds':r[field]=-1
        invoke(r,False,'regression:'+field+':'+repr(value))
    for field,value in [('failure','write quota'),('openHandles',1),('written',65537)]:
        r=copy.deepcopy(base);r['filesystem'][field]=value
        invoke(r,False,'regression:filesystem:'+field)
print(json.dumps(dict(passed=checks,count=len(checks),actualProcesses=0,browserAllowance=c.BROWSER_ALLOWANCE)))
