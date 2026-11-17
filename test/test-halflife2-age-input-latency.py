#!/usr/bin/env python3
"""Authored-only profiling/refusal seam around the actual pinned controller.

No success result uses an injected pause. A late request retains its original
absolute deadline, and must cause terminal UNKNOWN with no further requests.
"""
import builtins,cProfile,importlib.util,json,os,pathlib,pstats,sys,time
ROOT=pathlib.Path(__file__).resolve().parent.parent

def profile(args):
    run=pathlib.Path(os.environ['DELPHI5_RUN'])
    assert (run/'authored-input.json').is_file(),'authored native input required'
    spec=importlib.util.spec_from_file_location('age_control',ROOT/'tools/halflife2-reviewed-next.py')
    h=importlib.util.module_from_spec(spec);spec.loader.exec_module(h)
    delay=float(os.environ.get('HL2_TEST_TRANSPORT_PAUSE','0'))
    assert delay in (0,.55)
    adapt=h.receipt_clock_body
    def measured(body):
        body=adapt(body)
        if delay:
            anchor=b'def call(command,timeout=1,cleanup=False):\n'
            assert body.count(anchor)==1
            body=body.replace(anchor,anchor+b"    if command.get('action')=='guarded-input':time.sleep(.55) # authored refusal only\n")
        return body+b'''
import builtins
builtins._hl2_age_timings=[]
def _measured(name,fn):
    def measured(*args,**kwargs):
        at=time.time();mono=time.monotonic();cpu=time.process_time()
        try:return fn(*args,**kwargs)
        finally:
            builtins._hl2_age_timings.append(dict(function=name,argument=(args[0].get('action') if name=='call' else args[0]) if args else None,
                pid=os.getpid(),at=at,returnedAt=time.time(),elapsedMs=(time.monotonic()-mono)*1000,cpuMs=(time.process_time()-cpu)*1000))
    return measured
for _n in ('save','identity','reserve','call'):
    globals()[_n]=_measured(_n,globals()[_n])
_original_fail=fail
def fail(name,error):
    (R/('profile-before-UNKNOWN-'+name+'.json')).write_text(json.dumps(dict(authoredOnly=True,calls=builtins._hl2_age_timings)))
    return _original_fail(name,error)
'''
    h.receipt_clock_body=measured
    sys.argv=['tools/halflife2-reviewed-next.py',*args]
    clock=cProfile.Profile();started=time.time();clock.enable()
    try:h.controller()
    finally:
        clock.disable();stats=pstats.Stats(clock)
        rows=[dict(file=k[0],line=k[1],function=k[2],primitiveCalls=v[0],calls=v[1],selfSeconds=v[2],cumulativeSeconds=v[3])
              for k,v in stats.stats.items()]
        (run/('profile-'+args[1]+'.json')).write_text(json.dumps(dict(startedAt=started,completedAt=time.time(),
            authoredOnly=True,injectedTransportPause=delay,calls=getattr(builtins,'_hl2_age_timings',[]),
            rows=sorted(rows,key=lambda r:-r['cumulativeSeconds'])),indent=2)+'\n')

if __name__=='__main__':profile(sys.argv[1:])
