"""One exact empty-mount ownership correction; no remount or immutable mutation."""
import pathlib,os,json,subprocess,stat,shutil,hashlib
R=pathlib.Path('/home/user/shadow-man-streamed-installed-runtime-oct22'); M=R/'mutable'; I=R/'immutable'; F=R/'fixed'
receipt=F/'mutable-owner-correction.json'
assert not receipt.exists()
def alloc(p):return sum(x.lstat().st_blocks*512 for x in [p,*p.rglob('*')])
uid,gid=os.getuid(),os.getgid();assert uid==1000 and uid!=0
assert M.resolve()==M and M.is_mount() and not M.is_symlink() and not list(M.iterdir())
mount=json.loads(subprocess.check_output(['findmnt','--json','--target',str(M),'--output','TARGET,SOURCE,FSTYPE,OPTIONS']))['filesystems'];assert len(mount)==1
m=mount[0];assert m['target']==str(M) and m['source']=='shadow-man-qualified' and m['fstype']=='tmpfs'
s=os.statvfs(M);assert s.f_blocks*s.f_frsize==939524096 and s.f_bfree==s.f_blocks
st=M.stat();assert st.st_uid==0 and stat.S_IMODE(st.st_mode)==0o755
assert alloc(I)<2147483648 and alloc(F)+16777216<100663296 and shutil.disk_usage(R).free>=2147483648
g=json.loads((F/'hash-gate.json').read_text());assert g['passAll'] and g['allocation']['projectedTmpfs']==885211136
r=dict(workerUid=uid,workerGid=gid,beforeUid=st.st_uid,beforeGid=st.st_gid,mode=oct(stat.S_IMODE(st.st_mode)),mount=m,tmpfsCap=939524096,beforeUsed=0)
p=subprocess.run(['sudo','-n','chown',f'{uid}:{gid}','--',str(M)],capture_output=True,text=True)
r['chown']=dict(command=['sudo','-n','chown',f'{uid}:{gid}','--',str(M)],exit=p.returncode,stdout=p.stdout,stderr=p.stderr)
receipt.write_text(json.dumps(r,indent=2)+'\n');assert p.returncode==0,'supported sudo chown denied; stop without alternate method'
st=M.stat();assert (st.st_uid,st.st_gid)==(uid,gid) and stat.S_IMODE(st.st_mode)==0o755
s=os.statvfs(M);assert s.f_blocks*s.f_frsize==939524096
probe=M/'owner-write-probe';probe.write_bytes(b'ordinary-runtime-user-write-probe\n');assert probe.stat().st_uid==uid;probe.unlink();assert not list(M.iterdir())
r.update(afterUid=st.st_uid,afterGid=st.st_gid,ordinaryWriteProbe=True,probeDeleted=True);receipt.write_text(json.dumps(r,indent=2)+'\n')
# One clone only, from the already verified originals. Never touch their metadata.
assert (s.f_bavail*s.f_frsize)>885211136
shutil.copytree(I/'restored/parent-vfs',M/'vfs')
assert os.statvfs(M).f_bavail*s.f_frsize>885211136-alloc(M)
shutil.copyfile(I/'restored/parent-registry.json',M/'registry.json')
assert hashlib.sha256((M/'registry.json').read_bytes()).hexdigest()==g['registrySHA256']=='d7143f29d29576cd015ec875264028fa70795d0f18de457e31927048081d9de3'
assert (M/'registry.json').read_bytes()==(I/'restored/parent-registry.json').read_bytes()
(M/'output').mkdir();(M/'output/tmp').mkdir()
r.update(cloneComplete=True,registryCloneSHA256=g['registrySHA256'],mutableAllocated=alloc(M),tmpfsUsed=(s.f_blocks-os.statvfs(M).f_bfree)*s.f_frsize,immutableAllocated=alloc(I),fixedAllocated=alloc(F),freeBytes=shutil.disk_usage(R).free)
receipt.write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r))
