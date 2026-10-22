import pathlib,json,hashlib,subprocess,os,datetime
R=pathlib.Path('/home/user/shadow-man-dsetup-canonical-qualification-oct22');E=R/'evidence-pinned-dependency-qualification';os.chdir(R)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def git(*a):return subprocess.check_output(['git',*a],env=dict(os.environ,GIT_NO_LAZY_FETCH='1')).decode().strip()
q=json.loads((E/'qualification.json').read_text());assert len(q['results'])==9 and not q['notRun'] and all(r['exit']==0 for r in q['results'])
assert git('rev-parse','HEAD')==q['source'] and not git('status','--porcelain','--untracked-files=no')
manifest=json.loads((R/'evidence-static-dx-harness-qualification/build-inputs.json').read_text());assert manifest['revision']==q['source'] and len(manifest['inputs'])==3426
for row in manifest['inputs']:
 p=R/row['path'];assert p.stat().st_size==row['bytes'] and sha(p)==row['sha256'] and (p.stat().st_mode&0o777)==(int(row['mode'],8)&0o777),row['path']
closure=dict(path='evidence-static-dx-harness-qualification/build-inputs.json',sha256=sha(R/'evidence-static-dx-harness-qualification/build-inputs.json'),inputs=3426,verdict='PASS bytes/modes exact retained manifest, no source modifications')
(E/'closure-after.json').write_text(json.dumps(closure,indent=2)+'\n')
receipt=json.loads((E/'codec-receipt.json').read_text());rows=[]
for row in receipt['files']:
 rel=row['path'].removeprefix('runner/');p=R/rel;assert p.stat().st_size==row['size'] and sha(p)==row['sha256'];rows.append(dict(source=row['path'],target=rel,bytes=row['size'],sha256=row['sha256']))
assert rows==json.loads((E/'codec-staged-before.json').read_text());assert sorted(str(p.relative_to(R)) for p in (R/'node_modules/pngjs').rglob('*') if p.is_file())==sorted(r['target'] for r in rows)
(E/'codec-staged-after.json').write_text(json.dumps(rows,indent=2)+'\n')
mods=[dict(path=str(p.relative_to(R)),bytes=p.stat().st_size,sha256=sha(p)) for p in sorted((R/'build').glob('*.wasm'))];assert [m['sha256'] for m in mods]==['65f6242b586877f000fabdf5f7f516d62f1c2d7894658dff4ef075f90f7d8f65',q['canonicalSHA256']]
processes=[]
for d in pathlib.Path('/proc').iterdir():
 if not d.name.isdigit():continue
 try:
  comm=(d/'comm').read_text().strip();cwd=os.readlink(d/'cwd');args=(d/'cmdline').read_bytes().replace(b'\0',b' ').decode(errors='replace')
  if comm in ['node','nodejs','bash','sh'] and cwd.startswith(str(R)) and ('node' in comm or 'build.sh' in args):processes.append(dict(pid=int(d.name),comm=comm,cwd=cwd,args=args))
 except (OSError,ProcessLookupError):pass
assert not processes,processes
allocated=int(subprocess.check_output(['du','-s','-B1',str(R)]).split()[0]);free=os.statvfs(R).f_bavail*os.statvfs(R).f_frsize;assert allocated+67108864+2097152<1073741824 and free>2147483648
from collections import Counter
events=[e for r in q['results'] for e in r['events']];counts=Counter((e['op'],e['sha256']) for e in events)
pre=json.loads((E/'preflight.json').read_text());exp={r['name'] for r in pre['canonicalExports']};text=(R/'test/test-dll-import-no-ilt.js').read_text()
import re
extra=re.findall(r'\(export "([^"]+)"\)',text);assert not extra
(E/'extra-module-reasons.json').write_text(json.dumps(dict(directxSetup=dict(missingCanonicalExports=['test_directx_setup'],moduleSHA256=q['results'][0]['events'][0]['sha256']),noILT=dict(missingCanonicalExports=extra,moduleSHA256=q['results'][5]['events'][0]['sha256'],deviation='No extra exports; canonical can satisfy exports, but existing helper has no supported file input. Worker mistakenly ran its default full-source compile rather than stopping. Redundant compile outside stated condition; no source/expectation edits.'),reason='DirectXSetup only: missing test_directx_setup requires permitted separate extra-export module. No canonical artifact rebuild.'),indent=2)+'\n')
out=dict(verdict='PASS_ALL_NINE',box='bx_f3gs8qm2',state='RUNNING; API exec responsive',expiry='2026-10-22T23:20:32.491Z',lifecycleOwner='coordinator',head=git('rev-parse','HEAD'),parent=git('rev-parse','HEAD^'),gitClean=True,retainedRoot=str(R),newEvidence=str(E),priorEvidencePreserved=sorted(p.name for p in R.glob('evidence*') if p.is_dir()),closure=closure,modules=mods,codecFiles=len(rows),codecBytes=sum(r['bytes'] for r in rows),ownedBuildTestProcesses=processes,allocated=allocated,reserve=67108864,cap=1073741824,free=free,freeFloor=2147483648,newCanonicalBuilds=0,testRequiredExtraExportFullSourceCompiles=1,redundantDefaultFullSourceCompiles=1,sourceFixtureCompiles=1,identityCounts=[dict(op=k[0],sha256=k[1],count=v) for k,v in sorted(counts.items())],nativeGenuineDSETUP11='UNKNOWN',installedRegistry='UNKNOWN',game='NOT RUN',handbackAt=datetime.datetime.now(datetime.timezone.utc).isoformat())
(E/'handback.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))
