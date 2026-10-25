from control import *
admission('recover-doc-tree')
# Recreate the missing tree from readonly renderer donor index, omitting its
# receipt-only addition. All blobs must exist; normal write-tree is required.
idx=OUT/'recovery.index';ee={**E,'GIT_INDEX_FILE':str(idx)}
f=OUT/'donor-doc-index.raw'
rc,_,b=run(['python3','-c',"import subprocess,sys;sys.exit(subprocess.run(['git','ls-files','--stage','-z','--','docs'],stdout=open(sys.argv[1],'wb')).returncode)",str(f)],cwd='/tmp/render-byte-identity-accepted-integrate-oct25/repo',env=E,label='donor-doc-index');assert rc==0,b
assert f.stat().st_size<2*1048576
a=f.read_bytes()
records=[x for x in a.split(b'\0') if x and not x.split(b'\t',1)[1].startswith(b'docs/reviews/render-byte-identity-accepted-integrate-oct25/')]
data=b'\0'.join(records)+b'\0'
f=OUT/'doc-index-input';f.write_bytes(data)
rc,_,b=run(['git','read-tree','--empty'],cwd=R,env=ee);assert rc==0,b
# run helper has no stdin parameter; bounded file-redirection subprocess wrapper.
rc,_,b=run(['python3','-c',"import subprocess,sys;sys.exit(subprocess.run(['git','update-index','-z','--index-info'],stdin=open(sys.argv[1],'rb')).returncode)",str(f)],cwd=R,env=ee,label='recover-doc-index');assert rc==0,b
recovered=[]
import re
for attempt in range(120):
 rc,a,b=run(['git','write-tree'],cwd=R,env=ee,label='recover-doc-write-tree')
 if rc==0:break
 match=re.search(rb"invalid object 100644 ([0-9a-f]{40}) for '([^']+)'",b);assert match,b
 oid,path=match.groups();rel=path.decode();task=Path(rel).parts[2]
 sources=[Path('/tmp')/task/'repo'/rel,Path('/tmp')/task/'ops'/Path(rel).name]
 source=next((p for p in sources if p.is_file()),None);assert source,(oid,rel)
 assert source.stat().st_size<1048576
 actual=git('hash-object',str(source)).strip();assert actual==oid,(source,actual,oid)
 assert git('hash-object','-w',str(source)).strip()==oid
 recovered.append(dict(path=rel,oid=oid.decode(),source=str(source),bytes=source.stat().st_size))
else:raise RuntimeError('recovery limit')
save('recovered-doc-blobs',recovered)
root=a.decode().strip();rc,a,b=run(['git','ls-tree',root,'docs'],cwd=R,env=ee);assert rc==0,b
assert a.split()[2]==b'886c8277c45050aa25d8fd0f9e2b03103ff25fbe',a
save('doc-tree-recovery',dict(expected='886c8277c45050aa25d8fd0f9e2b03103ff25fbe',recovered=True,records=len(records),donorReadonly=True,normalWriteTree=True))
print('Exact missing docs tree recovered')
