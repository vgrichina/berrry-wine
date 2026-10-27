from common import *
mode=sys.argv[1]
if mode.startswith('boundary-'):
 i=mode.split('-')[1];cmd=['env','BOUNDARY_INDEX='+i,'/usr/bin/python3',str(R/'test/test-alien-terminal-dispatch-boundary-oct26.py'),'Boundary']
elif mode=='partial-http':cmd=['/usr/bin/python3',str(R/'test/test-alien-terminal-dispatch-boundary-oct26.py'),'Boundary.test_partial_http_request_remains_pending']
elif mode in ('unit','production'):cmd=['/usr/bin/python3',str(R/'test/test-alien-control-sequence.py'),'--group',mode]
elif mode in ('early-terminal','historical'):cmd=['/usr/bin/python3',str(R/'test/alien-terminal-failfast-independent-accept-oct26.py'),mode]
elif mode=='postwal-omission':cmd=['/usr/bin/python3',str(O/'postwal-omission-run.py')]
elif mode=='omission':cmd=['/usr/bin/python3',str(O/'omission-run.py')]
else:raise ValueError(mode)
req=O/('request-'+mode+'.json');req.write_text(json.dumps(dict(cmd=cmd,git=False,label=mode,cwd=str(R))))
os.execv('/usr/bin/python3',['/usr/bin/python3',POOL,'--slots','1','--','/usr/bin/python3',str(O/'invoke.py'),str(req)])
