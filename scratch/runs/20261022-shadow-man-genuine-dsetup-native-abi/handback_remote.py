import pathlib,json,hashlib,subprocess,os,datetime
R=pathlib.Path('/home/user/shadow-man-dsetup-canonical-qualification-oct22');E=R/'evidence-genuine-dsetup-native-abi'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def git(*a):return subprocess.check_output(['git','-C',str(R),*a],env=dict(os.environ,GIT_NO_LAZY_FETCH='1')).decode().strip()
assert git('rev-parse','HEAD')=='84f2a0165798f30d7a131dccdcc054a224fbf57b'
assert not git('status','--porcelain','--untracked-files=no')
manifest=json.loads((R/'evidence-static-dx-harness-qualification/build-inputs.json').read_text());assert len(manifest['inputs'])==3426
for row in manifest['inputs']:
 p=R/row['path'];assert p.stat().st_size==row['bytes'] and sha(p)==row['sha256'] and (p.stat().st_mode&0o777)==(int(row['mode'],8)&0o777),row['path']
codec=json.loads((R/'evidence-pinned-dependency-qualification/codec-receipt.json').read_text())['files'];assert len(codec)==23
for row in codec:
 p=R/row['path'].removeprefix('runner/');assert p.stat().st_size==row['size'] and sha(p)==row['sha256']
assert len(list(p for p in (R/'node_modules/pngjs').rglob('*') if p.is_file()))==23
prior=json.loads((E/'prior-evidence-manifest.json').read_text())
for row in prior:
 p=R/'evidence-pinned-dependency-qualification'/row['path'];assert p.stat().st_size==row['bytes'] and sha(p)==row['sha256'],row['path']
mods=[dict(path=str(p.relative_to(R)),bytes=p.stat().st_size,sha256=sha(p)) for p in sorted((R/'build').glob('*.wasm'))]
assert [m['sha256'] for m in mods]==['65f6242b586877f000fabdf5f7f516d62f1c2d7894658dff4ef075f90f7d8f65','ccd5b0a8e4fcb84d06bf539c8a4af28b377472072f3422750122048e9339f553']
assert sha(E/'originals/dsetup.dll')=='5112c736fa664cfd658c465fad781fe7ffd2753470cbcf7019b5a6ab08c4800f'
raw=E/'execution.json';r=json.loads(raw.read_text());assert r['canonicalInstances']==1 and r['verdict'].startswith('PASS')
assert sha(raw)==json.loads((E/'execution-summary.json').read_text())['receiptNormalization']['rawSHA256']
processes=[]
for d in pathlib.Path('/proc').iterdir():
 if not d.name.isdigit():continue
 try:
  comm=(d/'comm').read_text().strip();cwd=os.readlink(d/'cwd');args=(d/'cmdline').read_bytes().replace(b'\0',b' ').decode(errors='replace')
  if comm in ['node','nodejs','bash','sh'] and cwd.startswith(str(R)) and ('node' in comm or 'build.sh' in args):processes.append(dict(pid=int(d.name),comm=comm,cwd=cwd,args=args))
 except (OSError,ProcessLookupError):pass
assert not processes,processes
allocated=int(subprocess.check_output(['du','-s','-B1',str(R)]).split()[0]);free=os.statvfs(R).f_bavail*os.statvfs(R).f_frsize;assert allocated+67108864+2000000<1073741824 and free>2147483648
out=dict(verdict='PASS',box='bx_f3gs8qm2',state='RUNNING; API responsive',expiry='2026-10-22T23:20:32.491Z',lifecycleOwner='coordinator; 22:50 checkpoint unchanged',head=git('rev-parse','HEAD'),gitClean=True,sourcePins=3426,sourceManifestSHA256=sha(R/'evidence-static-dx-harness-qualification/build-inputs.json'),codecFiles=23,codecBytes=sum(r['size'] for r in codec),priorPinnedEvidenceFiles=len(prior),priorEvidenceDirectories=sorted(p.name for p in R.glob('evidence*') if p.is_dir()),modules=mods,original=dict(bytes=(E/'originals/dsetup.dll').stat().st_size,sha256=sha(E/'originals/dsetup.dll')),rawExecution=dict(bytes=raw.stat().st_size,sha256=sha(raw)),driverSHA256=sha(E/'driver.cjs'),ownedBuildTestProcesses=processes,allocated=allocated,reserve=67108864,cap=1073741824,free=free,freeFloor=2147483648,handbackAt=datetime.datetime.now(datetime.timezone.utc).isoformat())
(E/'handback.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))
