"""One finite original route, using the published native supervisor and guards.

All native JavaScript and the qualified module are sealed before its clocks
start. Only Git supplies source; foreign worktree changes are never adopted.
"""
import pathlib, os, json, subprocess, hashlib, base64, runpy, sys, time, re
ROOT=pathlib.Path(__file__).resolve().parent.parent
SUPERVISOR=ROOT/'tools/disciples2-current-supervisor.py'
api=runpy.run_path(str(SUPERVISOR),run_name='neverhood_setupx_supervisor')
def frozen(out,recipe):
    commit=recipe['commit'];assert re.fullmatch('[a-f0-9]{40}',commit)
    names=subprocess.check_output(['git','ls-tree','-r','--name-only',commit],cwd=ROOT).decode().splitlines()
    tracked=set(names)
    selected={p for p in names if p.startswith('lib/') and p.endswith(('.js','.json'))}
    selected.update(['host.js','test/run.js','src/api_table.json','src/win16-ordinals.generated.json','fonts/substitutions.json',
                     'tools/disciples2-current-native-source-view.cjs','tools/neverhood-setupx-stop.cjs',
                     'test/candidate-corpus/manifest.json'])
    bodies={}
    def body(p):
        if p not in bodies:bodies[p]=subprocess.check_output(['git','show',commit+':'+p],cwd=ROOT)
        return bodies[p]
    pending=list(selected)
    while pending:
        p=pending.pop()
        for relative in re.findall(rb'require\([\'\"](\.[^\'\"]+)[\'\"]\)',body(p)):
            candidate=os.path.normpath(str(pathlib.Path(p).parent/relative.decode()))
            for suffix in ('','.js','.cjs','.json','/index.js'):
                found=candidate+suffix
                if found in tracked:
                    if found not in selected:selected.add(found);pending.append(found)
                    break
    rows=[]
    for p in sorted(selected):
        b=body(p);rows.append(dict(path=p,sha256=hashlib.sha256(b).hexdigest(),body=base64.b64encode(b).decode()))
    codec=ROOT/'node_modules/pngjs'
    for p in codec.rglob('*'):
        if p.is_file() and p.suffix in ('.js','.json'):
            b=p.read_bytes();rows.append(dict(path=str(p.relative_to(ROOT)),sha256=hashlib.sha256(b).hexdigest(),body=base64.b64encode(b).decode()))
    b=pathlib.Path(recipe['qualifiedModule']).read_bytes()
    assert hashlib.sha256(b).hexdigest()==recipe['moduleSHA256']
    module=api['seal']('neverhood-setupx-qualified-module',b)
    source=api['seal']('neverhood-setupx-published-sources',json.dumps(dict(files=rows)).encode())
    api['save'](out,'runtime-inputs.json',dict(gitSHA=commit,moduleSHA256=recipe['moduleSHA256'],moduleSeals=15,sourceSeals=15,
       sources=[{k:v for k,v in row.items() if k!='body'} for row in rows],preparedAt=time.time(),sourceArchive='Git; no source or WASM archive'))
    env=os.environ.copy();env.pop('NODE_OPTIONS',None)
    env.update(recipe.get('env',{}))
    env.update(NODE_OPTIONS='--require='+str(ROOT/'tools/disciples2-current-native-source-view.cjs'),
               DISCIPLES2_SOURCE_FD='/proc/self/fd/'+str(source),DISCIPLES2_MODULE_FD='/proc/self/fd/'+str(module),
               DISCIPLES2_MODULE_SHA256=recipe['moduleSHA256'])
    return env,(source,module)
api['run'].__globals__['frozen_inputs']=frozen
if __name__=='__main__':
    out=pathlib.Path(sys.argv[1]).resolve();recipe=json.loads((out/'recipe.json').read_text())
    assert recipe['seconds']==1800 and recipe['watchdogGrace']==20 and recipe['reserveSeconds']==180
    assert recipe['bindingContract']=='native-reviewed-context-v1' and recipe['nativeScene']
    assert '--max-seconds=1800' in recipe['args'] and '--real-ticks' in recipe['args']
    assert recipe['inputPolicy']==dict(confirmationMs=500,physicalUpMs=1750,observationMs=3000,gameFreshnessSeconds=5,menuFreshnessSeconds=30)
    assert recipe['moduleHolder']=='qualified-before-clock' and not recipe.get('heavy')
    assert hashlib.sha256(SUPERVISOR.read_bytes()).hexdigest()==recipe['supervisorSHA256']
    started=time.time()
    try:api['run'](out,recipe)
    finally:api['save'](out,'runtime-return.json',dict(pid=os.getpid(),startedAt=started,returnedAt=time.time(),returned=True))
