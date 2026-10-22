import subprocess
S='/home/user/aoe3-canonical-c7fae5ac-staged'
raw=subprocess.check_output(['git','-C',S,'ls-tree','-rz','HEAD'])
oids=sorted({r.split(b'\t')[0].split()[2] for r in raw.split(b'\0') if r})
with open('/home/user/aoe3-canonical-c7fae5ac-evidence/current-tree-blob-fetch.log','wb') as f:
 p=subprocess.run(['git','-C',S,'fetch','--no-tags','--no-write-fetch-head','--recurse-submodules=no','--filter=blob:none','origin','--stdin'],input=b'\n'.join(oids)+b'\n',stdout=f,stderr=subprocess.STDOUT)
assert p.returncode==0,p.returncode
print('Batched current candidate tree blobs available; no full historical blob fetch')
