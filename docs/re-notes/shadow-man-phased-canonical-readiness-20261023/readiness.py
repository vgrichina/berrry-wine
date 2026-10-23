#!/usr/bin/env python3
"""Pinned, phased canonical prerequisite runner; no full compile route."""
import argparse, hashlib, importlib.util, json, os, pathlib, re, resource, shutil, subprocess, sys
sys.dont_write_bytecode = True
H = pathlib.Path(__file__).resolve().parent
R = H.parents[2]
OLD = pathlib.Path('/home/user/wine-assembly-shadow-man-capture-build-readiness-oct23/docs/re-notes/shadow-man-capture-build-readiness-20261023')
EXT = pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/shadow-man-phased-canonical-readiness-oct23')
ENV = dict(os.environ, GIT_NO_LAZY_FETCH='1', PYTHONDONTWRITEBYTECODE='1')
CAP, RESERVE, FLOOR, GROWTH = 67108864, 8388608, 2982150144, 524288
def dump(f, value): (H/f).write_text(json.dumps(value, separators=(',', ':'))+'\n')
def size(p):
    return sum(x.stat().st_size for x in [p, *p.rglob('*')] if not x.is_symlink()) if p.exists() else 0
def exact(row):
    for donor in ['/home/user/wine-assembly-shadow-man-fresh-selection-repair-oct23','/home/user/wine-assembly-shadow-man-fresh-selection-independent-accept-oct23','/home/user/wine-assembly']:
        q=subprocess.run(['git','-C',donor,'cat-file','blob',row['blob']],env=ENV,capture_output=True)
        if q.returncode == 0: b=q.stdout
        elif (pathlib.Path(donor)/row['path']).is_file(): b=(pathlib.Path(donor)/row['path']).read_bytes()
        else: continue
        if hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==row['blob'] and hashlib.sha256(b).hexdigest()==row['sha256']: return b
    raise ValueError('missing exact input '+row['path'])
def scanner(f):
    return (f.startswith('src/') and f.endswith(('.wat','.watx'))) or (f.endswith('.js') and (f.startswith(('lib/','tools/','test/')) or '/' not in f))
def admission(label, extra=0):
    own, ext=size(R),size(EXT)
    total=own+ext+GROWTH+RESERVE+extra
    free=shutil.disk_usage(R).free
    record=dict(label=label,owned=own,external=ext,futureGrowth=GROWTH,reserve=RESERVE,extra=extra,total=total,cap=CAP,free=free,floor=FLOOR,passAdmission=total<=CAP and free-extra-GROWTH>=FLOOR)
    with (H/'resources.jsonl').open('a') as out: out.write(json.dumps(record)+'\n')
    if not record['passAdmission']: raise ValueError('RESOURCE DENIED '+json.dumps(record))
    return record
def plan():
    old=json.loads((OLD/'closure-inputs.json').read_text()); rows={x['path']:x for x in old['files']}
    # Prior POSITIONT recipe supplies candidate-independent data path hints ONLY.
    # Scanner universe is independently rebuilt from this exact candidate tree.
    hints=json.loads(pathlib.Path('/home/user/wine-assembly-render-positiont-canonical-prereqs-complete-oct23/docs/re-notes/render-positiont-canonical-prereqs-complete-20261023/manifest.json').read_text())
    initial={f for f in rows if scanner(f)} | {x[0] for x in hints if x[4]=='initial' and x[0] in rows}
    initial |= {'index.html','tools/shadow-man-null-preload.cjs','tools/shadow-man-null-capture.cjs'}
    provenance=exact(rows['tools/check-watx-provenance.js']).decode()
    keep=set(re.findall(r"'([^']+)'",provenance.split('const REQUIRED_FILES = [')[1].split('];')[0]))
    bundlepaths=['docs/dos-corpus/live/toyvm-bundle.js','docs/dos-corpus/live/toyvm-jit-bundle.js','fonts/Terminal.fon']
    tree=subprocess.check_output(['git','-C',str(R),'ls-tree','-r','b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a'],env=ENV).decode()
    tree={line.split('\t')[1]:line.split()[2] for line in tree.splitlines()}
    # No missing scanner paths may disappear from the view.
    assert {f for f in tree if scanner(f)} == {f for f in initial if scanner(f)}
    for f in bundlepaths:
        if f in rows: continue
        blob=tree.get(f)
        if not blob: raise ValueError('candidate lacks mandatory bundle asset '+f)
        row={'path':f,'blob':blob,'sha256':'','bytes':0}
        found=None
        for donor in ['/home/user/wine-assembly','/home/user/wine-assembly-shadow-man-fresh-selection-repair-oct23']:
            q=subprocess.run(['git','-C',donor,'cat-file','blob',blob],env=ENV,capture_output=True)
            if q.returncode==0: found=q.stdout;break
            p=pathlib.Path(donor)/f
            if p.is_file():
                b=p.read_bytes()
                if hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==blob: found=b;break
        if found is None: raise ValueError('unavailable mandatory pinned asset '+f+' '+blob)
        row.update(sha256=hashlib.sha256(found).hexdigest(),bytes=len(found));rows[f]=row
    bundle=(initial-{f for f in initial if f.startswith('test/') and f not in keep}) | set(bundlepaths)
    late=bundle-set(bundlepaths)-{f for f in bundle if f.startswith('tools/toyvm/')}
    build=exact(rows['tools/build.sh']); assert build==(OLD/'pinned-build.sh').read_bytes()
    prefix=(OLD/'canonical-precompile.sh').read_bytes()
    fence=b'echo "Compiling (WATX)..."\nnode tools/build-compile-wat.js\n'
    assert prefix==build.split(fence)[0].replace(b'cd "$(dirname "$0")/.."',b'cd "$SHADOW_SOURCE_ROOT"',1)+b'\nexit 0 # HARD STOP: compilation is outside this task\n'
    includes=re.findall(r'\(include "([^"]+)"\)',exact(rows['src/main.watx']).decode())
    combined=9+sum(rows['src/'+f]['bytes'] for f in includes)
    used=initial|bundle|late
    compact=[dict(path=f,blob=rows[f]['blob'],sha256=rows[f]['sha256'],bytes=rows[f]['bytes'],phases=[n for n,s in [('initial',initial),('bundle',bundle),('late',late)] if f in s]) for f in sorted(used)]
    # All availability/identity checks occur BEFORE source materialization.
    for row in compact:
        assert tree[row['path']]==row['blob']; exact(row)
    dump('phase-manifest.json',dict(candidate=old['candidate'],rows=compact,combinedBytes=combined,scannerFiles=sum(scanner(f) for f in initial),keepProvenanceTests=sorted(f for f in keep if f.startswith('test/'))))
    (H/'canonical-precompile.sh').write_bytes(prefix)
    overhead=size(R)+size(EXT)+GROWTH+RESERVE+262144+131072
    phases={n:sum(rows[f]['bytes'] for f in s)+(combined if n=='late' else 0)+overhead for n,s in [('initial',initial),('bundle',bundle),('late',late)]}
    free=shutil.disk_usage(R).free
    result=dict(candidate=old['candidate'],sourceBytes={n:sum(rows[f]['bytes'] for f in s) for n,s in [('initial',initial),('bundle',bundle),('late',late)]},privateGitBytes=size(R/'.git'),ownedPlanningBytes=size(R),externalBytes=size(EXT),futureGrowth=GROWTH,evidenceFuture=262144,directoryUpper=131072,reserve=RESERVE,combinedBytes=combined,phases=phases,cap=CAP,hostFree=free,hostFloor=FLOOR,admitted=max(phases.values())<=CAP and free-max(phases.values())>=FLOOR)
    dump('admission.json',result);print(json.dumps(result,indent=2))
    if not result['admitted']: return 2
    return 0
def phase(name):
    m=json.loads((H/'phase-manifest.json').read_text()); rows=m['rows']
    if name!='initial':
        for row in rows:
            p=R/row['path']
            if name not in row['phases'] and p.exists():
                assert hashlib.sha256(p.read_bytes()).hexdigest()==row['sha256'];p.unlink()
    needed=[r for r in rows if name in r['phases'] and not (R/r['path']).exists()]
    admission('before phase '+name,sum(r['bytes'] for r in needed)+131072)
    for row in needed:
        p=R/row['path'];p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(exact(row))
    for row in rows:
        if name in row['phases']: assert hashlib.sha256((R/row['path']).read_bytes()).hexdigest()==row['sha256']
    if name=='initial':
        actual={str(p.relative_to(R)) for d in ['src','lib','tools','test'] for p in (R/d).rglob('*') if p.is_file() and scanner(str(p.relative_to(R)))} | {p.name for p in R.glob('*.js')}
        assert actual=={r['path'] for r in rows if scanner(r['path'])}
    admission('phase complete '+name)
def limits():
    resource.setrlimit(resource.RLIMIT_CPU,(600,600))
    resource.setrlimit(resource.RLIMIT_FSIZE,(24*1048576,24*1048576))
def run():
    a=json.loads((H/'admission.json').read_text());assert a['admitted']
    phase('initial')
    env=dict(ENV,SHADOW_SOURCE_ROOT=str(R),SHADOW_READINESS=str(H),NODE_OPTIONS='--max-old-space-size=512 --require='+str(H/'no-compile.cjs'),NODE_PATH='/home/user/wine-dashboard-deps-20261014/node_modules')
    argv=['bash','-ex',str(H/'canonical-precompile.sh')]
    with (H/'canonical.log').open('wb') as log:
        try:
            p=subprocess.run(argv,cwd=R,env=env,stdout=log,stderr=subprocess.STDOUT,timeout=600,preexec_fn=limits());code=p.returncode
        except subprocess.TimeoutExpired: code=124
    dump('result.json',dict(argv=argv,exit=code,candidate=a['candidate'],verdict='GATES_PASS_CLOSURE_PENDING' if code==0 else 'BLOCKED',log='canonical.log',fullCompile=False))
    print('canonical prefix exit',code);return code
if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--run',action='store_true');ap.add_argument('--phase',choices=['initial','bundle','late']);ap.add_argument('--admit');ap.add_argument('--control-missing',action='store_true');args=ap.parse_args()
    try:
        # Published failed plan is immutable evidence, never a retry recipe.
        if (H/'blocker.json').exists() and not args.control_missing and not args.admit:
            print('BLOCKED: known omitted mandatory input test/run-all.sh; see blocker.json. No staging/gate retry.',file=sys.stderr)
            sys.exit(3)
        if args.control_missing:
            m=json.loads((H/'phase-manifest.json').read_text());row=next(r for r in m['rows'] if r['path']=='src/main.watx');row=dict(row,blob='0'*40);exact(row);raise AssertionError('control accepted')
        elif args.phase: phase(args.phase)
        elif args.admit: admission(args.admit, json.loads((H/'phase-manifest.json').read_text())['combinedBytes'] if args.admit=='tools/concat-wat.js' else 0)
        elif args.run: sys.exit(run())
        else: sys.exit(plan())
    except (ValueError,AssertionError,FileNotFoundError) as e:
        print('BLOCKED: '+str(e),file=sys.stderr);sys.exit(3)
