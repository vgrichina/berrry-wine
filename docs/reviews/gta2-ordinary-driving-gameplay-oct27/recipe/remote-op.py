from common import *
mode=sys.argv[1]
if mode in ('compile-startup','guest-startup'):
 j,raw=remote('python3 '+shlex.quote(REMOTE+'/remote-supervise.py')+' '+mode,timeout=35);save(mode+'-api.json',j);print(j['stdout'])
elif mode in ('compile','guest'):
 j,raw=remote('python3 '+shlex.quote(REMOTE+'/remote-supervise.py')+' '+mode,detach=True);save(mode+'-dispatch.json',j);print(json.dumps(j))
elif mode=='status':
 target=sys.argv[2];code='import pathlib,json;h=pathlib.Path('+repr(REMOTE)+');p=h/'+repr(target+'-receipt.json')+';print(json.dumps(dict(receipt=json.loads(p.read_text()) if p.exists() else None,stdoutTail=(h/'+repr(target+'.stdout')+').read_text()[-1600:] if (h/'+repr(target+'.stdout')+').exists() else None,stderrTail=(h/'+repr(target+'.stderr')+').read_text()[-1600:] if (h/'+repr(target+'.stderr')+').exists() else None)))'
 j,raw=py(code);save(target+'-status-'+str(time.time_ns())+'.json',j);print(j['stdout'])
else:raise ValueError(mode)
