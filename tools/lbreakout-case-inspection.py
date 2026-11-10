"""Generate read-only inspection for one LBreakout browser case.

Launcher stdout is published only after communicate() returns. Its absence
during execution is expected; it must not mask passive terminal records.
"""
import json


def inspection_source(root, run, case):
    if case not in ('fixture', 'original'):
        raise ValueError('unsupported LBreakout case')
    return '''import json,pathlib
p=pathlib.Path(%s)/%s
out=p/%s
log=p/(%s+'.log')
markers=['first-browser-failure.json','first-failure.json','cleanup.json','chrome-exit.json']
terminal={n:json.loads((out/n).read_text()) for n in markers if (out/n).exists()}
wait=p/(('fixture-launcher' if %s=='fixture' else 'launcher')+'-wait.json')
if wait.exists():terminal['launcherWait']=json.loads(wait.read_text())
print(json.dumps(dict(case=%s,files=sorted(f.name for f in out.iterdir()) if out.exists() else [],latest=json.loads((out/'latest.json').read_text()) if (out/'latest.json').exists() else None,terminal=terminal,logPath=str(log),logAvailable=log.exists(),output=log.read_text()[-4000:] if log.exists() else None)))
''' % tuple(json.dumps(v) for v in (root, run, case, case, case, case))
