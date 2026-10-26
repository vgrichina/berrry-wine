from common import *
label=sys.argv[1]; cmd=['/usr/bin/python3',str(R/'test/alien-terminal-failfast-independent-accept-oct26.py'),label]
req=O/'request.json';req.write_text(json.dumps(dict(cmd=cmd,git=False,label=label,cwd=str(R))))
os.execv('/usr/bin/python3',['/usr/bin/python3',POOL,'--slots','1','--','/usr/bin/python3',str(O/'invoke.py'),str(req)])
