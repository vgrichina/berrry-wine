import os, resource, sys, json
from pathlib import Path
base, kind, *cmd = sys.argv[1:]
os.dup2(os.open(base+'.stdout', os.O_WRONLY|os.O_CREAT|os.O_TRUNC, 0o600), 1)
os.dup2(os.open(base+'.stderr', os.O_WRONLY|os.O_CREAT|os.O_TRUNC, 0o600), 2)
try:
    if kind == 'git':
        resource.setrlimit(resource.RLIMIT_DATA, (512<<20, 512<<20))
    Path(base+'.limits.json').write_text(json.dumps({n:resource.getrlimit(getattr(resource,'RLIMIT_'+n)) for n in ('DATA','AS','RSS','CPU','FSIZE')}))
    os.execvp(cmd[0], cmd)
except BaseException:
    import traceback
    traceback.print_exc()
    raise
