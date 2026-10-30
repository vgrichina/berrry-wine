from supervisor import *
import importlib.util
source=ROOT/'tools/recovery/tuxracer-original-win32-recovery-oct28.py'
test=ROOT/'tools/recovery/test-tuxracer-published-syntax-independent-accept-oct29.py'
spec=importlib.util.spec_from_file_location('challenges',test)
m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
results=json.loads((E/'adversarial-checkpoint.json').read_text())['completed'] if (E/'adversarial-checkpoint.json').exists() else []
for c in m.CASES:
    name=c['name']; fixture=ROOT/'fixtures'/name
    if name in {r['case'] for r in results}:
        assert hashlib.sha256((fixture/'main.tcl').read_bytes()).hexdigest()==next(r['fixtureSHA256'] for r in results if r['case']==name)
        continue
    run([sys.executable,str(test),'--source',str(source),'--task-dir',str(ROOT),'--case',name],cwd=ROOT,name='api-'+name)
    out=run([sys.executable,str(source),'literal-sources',str(fixture),str(fixture/'inventory.json')],cwd=ROOT,name='cli-'+name,expected=1 if c['reject'] else 0)
    api=json.loads((fixture/'api.json').read_text())
    if c['reject']:
        assert api['rejection'] and api['rejection'] in (E/('cli-'+name+'.stderr')).read_text()
    else: assert json.loads(out)==api['api'],name
    assert not (fixture/'SENTINEL').exists()
    results.append(dict(case=name,apiEqualsActualCLI=True,rejected=c['reject'],sentinelAbsent=True,fixtureSHA256=hashlib.sha256((fixture/'main.tcl').read_bytes()).hexdigest()))
    save('adversarial-checkpoint',dict(PASS=True,completed=results,remaining=len(m.CASES)-len(results),candidate='e57ec87fb3a37260abb5c7e45ad8d37f3cc4e803'))
print(json.dumps(dict(PASS=True,cases=len(results),apiEqualsActualCLI=True)))
