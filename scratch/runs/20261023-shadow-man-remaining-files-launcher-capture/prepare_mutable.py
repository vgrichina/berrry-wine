"""One fresh hard tmpfs; clone verified originals without changing immutable bytes."""
import pathlib,json,subprocess,os,shutil,hashlib
R=pathlib.Path('/home/user/shadow-man-launcher-configuration-capture-oct23');I=R/'immutable';M=R/'mutable';F=R/'fixed'
def alloc(p):return sum(x.lstat().st_blocks*512 for x in [p,*p.rglob('*')])
g=json.loads((F/'hash-gate.json').read_text());assert g['passAll'] and not any(M.iterdir())
assert subprocess.run(['sudo','-n','mount','-t','tmpfs','-o','size=939524096,mode=0755,uid=1000,gid=1000','shadow-man-qualified',str(M)],capture_output=True).returncode==0
s=os.statvfs(M);assert s.f_blocks*s.f_frsize==939524096
assert os.getuid()==1000 and M.stat().st_uid==1000 and M.stat().st_gid==1000
probe=M/'ordinary-write-probe';probe.write_bytes(b'probe');probe.unlink()
shutil.copytree(I/'restored/parent-vfs',M/'vfs');shutil.copyfile(I/'restored/parent-registry.json',M/'registry.json');(M/'output').mkdir();(M/'output/tmp').mkdir()
def run(cmd,name):
 p=subprocess.run(cmd,capture_output=True,text=True,env=dict(PATH=os.defpath,HOME='/home/user',LANG='C.UTF-8',NODE_PATH=str(I/'runtime/node_modules'),SHADOW_RUNTIME=str(I/'runtime'),SHADOW_PREFLIGHT_OUTPUT=str(F/'dependency-preflight.json')))
 (F/name).write_text(json.dumps(dict(command=cmd,exit=p.returncode,stdout=p.stdout,stderr=p.stderr),indent=2)+'\n');assert p.returncode==0,name
run(['node',str(F/'dependency-preflight.cjs')],'dependency-preflight-command.json')
run(['node',str(F/'forwarding-fixture.cjs')],'forwarding-fixture-result.json')
run(['node',str(F/'guard-fixture.cjs')],'guard-fixture-result.json')
assert hashlib.sha256((M/'registry.json').read_bytes()).hexdigest()==g['registrySHA256']
assert alloc(F)+16*1024*1024<=100663296 and alloc(I)+16*1024*1024<=2147483648
used=(s.f_blocks-os.statvfs(M).f_bfree)*s.f_frsize;free=shutil.disk_usage(R).free;assert free>=2147483648
# Lock recovered source bytes. Runtime is read-only; all guest writes are clones.
for p in I.rglob('*'):
 assert not p.is_symlink()
 p.chmod(0o555 if p.is_dir() else 0o444)
I.chmod(0o555)
result=dict(passAll=True,guestAttempts=0,mutableAllocated=alloc(M),tmpfsUsed=used,tmpfsCap=s.f_blocks*s.f_frsize,fixedAllocated=alloc(F),immutableAllocated=alloc(I),freeBytes=free,registryCloneSHA256=g['registrySHA256'],immutableReadOnly=True)
(F/'mutable-prepared.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
