import os,sys,pathlib,json,resource,hashlib
h=pathlib.Path('/tmp/alien-menu-action-budget-controller-repair-oct27');r=h/'repo';o=h/'ops'
donor=pathlib.Path('/tmp/alien-dispatch-boundary-independent-publication-oct27/repo');script=donor/'test/test-alien-control-sequence.py'
(o/'affected-inputs.json').write_text(json.dumps(dict(script=str(script),scriptSHA256=hashlib.file_digest(script.open('rb'),'sha256').hexdigest(),root=str(r),argv=[sys.executable,str(script),'--group','unit'],executable=sys.executable,limits={k:resource.getrlimit(getattr(resource,'RLIMIT_'+k)) for k in ('CPU','FSIZE','DATA','AS')},sourcePins={p:hashlib.file_digest((r/p).open('rb'),'sha256').hexdigest() for p in ['test/alien-gameplay-sequence.py','test/helpers/alien-control-sequence.py']}),indent=2))
os.execve(sys.executable,[sys.executable,str(script),'--group','unit'],dict(os.environ,ALIEN_CONTROL_ROOT=str(r),PYTHONDONTWRITEBYTECODE='1'))
