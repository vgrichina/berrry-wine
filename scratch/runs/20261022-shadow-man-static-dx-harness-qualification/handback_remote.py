import pathlib,json,subprocess,os,hashlib,datetime
R=pathlib.Path('/home/user/shadow-man-dsetup-canonical-qualification-oct22');E=R/'evidence-static-dx-harness-qualification';os.chdir(R);env=dict(os.environ,GIT_NO_LAZY_FETCH='1')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def git(*a):return subprocess.check_output(['git',*a],env=env).decode().strip()
q=json.loads((E/'qualification.json').read_text());assert [r['exit'] for r in q['results']]==[0,1] and len(q['notRun'])==8
assert q['results'][0]['canonicalInstantiations']==1 and q['results'][1]['allInstantiations']==0
assert "Cannot find module 'pngjs'" in (E/'test-directx-setup.log').read_text()
manifest=json.loads((E/'build-inputs.json').read_text());assert len(manifest['inputs'])==3426
for row in manifest['inputs']:assert sha(R/row['path'])==row['sha256']
mods=[dict(path=str(p.relative_to(R)),bytes=p.stat().st_size,sha256=sha(p)) for p in sorted((R/'build').glob('*.wasm'))];assert mods[1]['sha256']==q['canonicalSHA256'];assert mods[0]['sha256']=='65f6242b586877f000fabdf5f7f516d62f1c2d7894658dff4ef075f90f7d8f65'
processes=[]
for line in subprocess.check_output(['ps','-eo','pid,comm,args']).decode().splitlines():
 if ('node ' in line or 'build.sh' in line) and str(R) in line:processes.append(line)
assert not processes,processes
assert git('rev-parse','HEAD')==q['source'] and not git('status','--porcelain','--untracked-files=no')
allocated=int(subprocess.check_output(['du','-s','-B1',str(R)]).split()[0]);free=os.statvfs(R).f_bavail*os.statvfs(R).f_frsize;assert allocated+67108864+2097152<1073741824 and free>2147483648
out=dict(verdict='PASS harness causal repair; BLOCKED pngjs dependency before DirectXSetup instantiation',box='bx_f3gs8qm2',state='RUNNING; API exec responsive',expiry='2026-10-22T23:20:32.491Z',lifecycleOwner='coordinator',head=git('rev-parse','HEAD'),parent=git('rev-parse','HEAD^'),history=git('log','--format=raw','-6'),gitClean=True,retainedRoot=str(R),newEvidence=str(E),priorEvidencePreserved=[str(p.relative_to(R)) for p in R.glob('evidence*') if p.is_dir()],closureInputsVerified=3426,modules=mods,ownedBuildTestProcesses=processes,allocated=allocated,reserve=67108864,cap=1073741824,free=free,freeFloor=2147483648,newBuilds=0,newModuleCompiles=0,canonicalFileInstantiationsIncludingControls=4,remainingNotRun=8,nativeGenuineDSETUP11='UNKNOWN',installedRegistry='UNKNOWN',handbackAt=datetime.datetime.now(datetime.timezone.utc).isoformat())
(E/'handback.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))
