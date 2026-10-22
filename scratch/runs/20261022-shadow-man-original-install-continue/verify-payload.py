import pathlib,json,hashlib,subprocess,shutil,os
R=pathlib.Path('/home/user/shadow-man-install-continue-oct22');O=pathlib.Path('/home/user/shadow-man-install-quota-oct22/session');V=O/'parent-vfs';I=V/'program files/acclaim entertainment/shadowman'
def sha(p):
 with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
assert I.exists();assert not (R/'native').exists();current=sum(p.stat().st_blocks*512 for p in R.rglob('*'));assert current+500000000<2147483648;assert shutil.disk_usage(R).free-500000000>=2982150144
p=subprocess.run(['unshield','-d',str(R/'native'),'x',str(R/'recovery/source/Demos/Shadowman/data1.cab')],capture_output=True,text=True,timeout=30);(R/'native-extraction.json').write_text(json.dumps(dict(command=p.args,exitCode=p.returncode,stdout=p.stdout,stderr=p.stderr)));assert p.returncode==0,p.stderr
mapping=[]
for f in sorted((R/'native').rglob('*')):
 if not f.is_file():continue
 rel=f.relative_to(R/'native');target=I/pathlib.Path(*rel.parts[1:]).as_posix().lower();original=dict(path=str(rel),size=f.stat().st_size,sha256=sha(f));installed=dict(path=str(target.relative_to(V)),exists=target.is_file(),size=target.stat().st_size if target.exists() else None,sha256=sha(target) if target.is_file() else None)
 mapping.append(dict(original=original,installed=installed,match=installed['size']==original['size'] and installed['sha256']==original['sha256']))
assert len(mapping)==1959
allfiles=[dict(path=str(f.relative_to(V)),size=f.stat().st_size,sha256=sha(f)) for f in sorted(V.rglob('*')) if f.is_file()]
log=(O/'output.log').read_text();import re
exitrows=[]
for f in O.glob('*.jsonl'):
 for line in f.read_text().splitlines():
  x=json.loads(line)
  if x.get('name')=='ExitProcess' or x.get('kind') in ['guest-input-dequeued','guest-input-target','node-exit']:exitrows.append(dict(file=f.name,**x))
result=dict(originalCabinet='data1.cab',files=len(mapping),originalPayloadBytes=sum(x['original']['size'] for x in mapping),matched=sum(x['match'] for x in mapping),mismatches=[x for x in mapping if not x['match']],installedRoot=str(I),installedExe=next(x for x in allfiles if x['path'].endswith('/shadowman.exe')),mapping=mapping,vfs=allfiles,inputAndExitEvents=exitrows,finishLogLines=[line for line in log.splitlines() if any(s in line for s in ['click 415,394','ExitProcess','child-exit','Max seconds','max-seconds reached'])])
(R/'installed-payload.json').write_text(json.dumps(result,indent=2));print(json.dumps({k:v for k,v in result.items() if k not in ['mapping','vfs','inputAndExitEvents']}))
