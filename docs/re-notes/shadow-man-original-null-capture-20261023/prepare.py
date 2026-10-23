"""Destination integrity and one UID1000-owned bounded clone. No guest."""
import pathlib,json,hashlib,os,shutil,subprocess
R=pathlib.Path('/home/user/shadow-man-original-null-capture-oct23');I=R/'immutable';M=R/'mutable';F=R/'fixed'
def sha(p):
 with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def alloc(p):return sum(x.lstat().st_blocks*512 for x in [p,*p.rglob('*')])
assert os.getuid()==1000
rows=[json.loads(x) for x in (I/'receipts/transfer-files.jsonl').read_text().splitlines()]
assert len(rows)==2083 and sum(x['bytes'] for x in rows)==186399681
assert {str(p) for p in (I/'restored').rglob('*') if p.is_file()}=={x['path'] for x in rows}
for x in rows:
 p=pathlib.Path(x['path']);assert not p.is_symlink() and p.stat().st_size==x['bytes'] and sha(p)==x['sha256']
accepted=json.loads((I/'receipts/accepted-installed-payload.json').read_text());assert accepted['files']==1959 and accepted['originalPayloadBytes']==100354053
V=I/'restored/parent-vfs'
for x in accepted['mapping']:
 p=V/x['installed']['path'];assert p.stat().st_size==x['original']['size'] and sha(p)==x['original']['sha256']
assert sha(I/'restored/parent-registry.json')==sha(I/'registry-preflight.json')=='d7143f29d29576cd015ec875264028fa70795d0f18de457e31927048081d9de3'
staged=json.loads((F/'staging-complete.json').read_text())['filesManifest']
for x in staged:
 p=pathlib.Path(x['path']);assert p.stat().st_size==x['bytes'] and sha(p)==x['sha256']
game=V/'program files/acclaim entertainment/shadowman'
pins={'d3dconfigutility.exe':(573440,'850c69cfa4a0d610072a67763d54179bc4cdc58875560ce5ede33bfa44d19fe0'),'mss32.dll':(328704,'09e2dec3d1e996571fb2c95e5de393410d486f1728c86473b550282edd83588c'),'dsetup.dll':(135680,'5112c736fa664cfd658c465fad781fe7ffd2753470cbcf7019b5a6ab08c4800f')}
for n,(size,h) in pins.items():assert (game/n).stat().st_size==size and sha(game/n)==h
native=[dict(path=str(p.relative_to(V)),bytes=p.stat().st_size,sha256=sha(p)) for p in V.rglob('*') if p.is_file() and p.suffix.lower() in ['.dll','.exe']]
files=[p for p in V.rglob('*') if p.is_file()];assert len(files)==2045
pageCopy=sum((p.stat().st_size+4095)//4096*4096 for p in files)
projection=4*(pageCopy+8388608)+4*len(files)*4096+16777216+67108864
assert projection<=939524096 and alloc(I)+16777216<=2147483648 and shutil.disk_usage(R).free>=2147483648+939524096
assert not list(M.iterdir())
cmd=['sudo','-n','mount','-t','tmpfs','-o','size=939524096,uid=1000,gid=1000,mode=0755','shadow-man-null-01a167e9',str(M)]
p=subprocess.run(cmd,capture_output=True,text=True);assert p.returncode==0,p.stderr
assert M.stat().st_uid==1000 and M.stat().st_gid==1000 and M.stat().st_mode&0o777==0o755
s=os.statvfs(M);assert s.f_blocks*s.f_frsize==939524096
probe=M/'ordinary-write';probe.write_text('uid1000');assert probe.read_text()=='uid1000';probe.unlink()
shutil.copytree(V,M/'vfs');shutil.copyfile(I/'restored/parent-registry.json',M/'registry.json');(M/'output/tmp').mkdir(parents=True)
assert len([p for p in (M/'vfs').rglob('*') if p.is_file()])==2045 and sha(M/'registry.json')==sha(I/'restored/parent-registry.json')
for p in I.rglob('*'):
 assert not p.is_symlink();p.chmod(0o555 if p.is_dir() else 0o444)
I.chmod(0o555)
r=dict(passAll=True,guestAttempts=0,restoredFiles=len(rows),restoredBytes=186399681,acceptedPayloadFiles=1959,acceptedPayloadBytes=100354053,stagedFiles=len(staged),native=native,registrySHA=sha(M/'registry.json'),cloneFiles=2045,cloneCount=1,tmpfsOwner=1000,tmpfsCap=939524096,tmpfsUsed=alloc(M),projectedTmpfs=projection,immutableAllocated=alloc(I),fixedAllocated=alloc(F),free=shutil.disk_usage(R).free)
(F/'restoration-gate.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r))
