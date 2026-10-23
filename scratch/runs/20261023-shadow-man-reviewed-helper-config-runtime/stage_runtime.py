import pathlib,json,hashlib,time
from transport import *
from plan_gate import validate,admission
C=pathlib.Path('/home/user/wine-assembly-shadow-man-launcher-configuration-capture-oct23/scratch/runs/20261023-shadow-man-launcher-configuration-capture')
plan=json.loads((E/'staging-plan.json').read_text());assert validate(plan)['passAll'];fixture=json.loads((E/'offline-plan-fixture.json').read_text());assert fixture['stagingAuthorized'] and len(fixture['rejected'])==9
save('box-before.json',api('sandboxes/'+BOX))
code='''import pathlib,json,hashlib,os,shutil
R=pathlib.Path(ROOT_PATH);I=R/'immutable';M=R/'mutable';F=R/'fixed'
assert os.getuid()==1000 and os.getgid()==1000
assert not os.path.ismount(M) and not any(M.iterdir()) and not any(F.iterdir())
assert not (I/'runtime').exists() and not (I/'receipts').exists()
rows=[]
for p in sorted((I/'restored').rglob('*')):
 if p.is_file():
  with p.open('rb') as f:h=hashlib.file_digest(f,'sha256').hexdigest()
  rows.append([str(p.relative_to(I/'restored')),p.stat().st_size,h])
assert len(rows)==2083 and sum(x[1] for x in rows)==186399681
assert shutil.disk_usage(R).free>=2147483648+939524096
print(json.dumps(rows))
'''
r=run('ROOT_PATH='+repr(ROOT)+'\n'+code,'before-staging-original-hashes-api.json',30);actual=json.loads(r['stdout']);assert actual==json.loads((E/'destination-original-hashes.json').read_text());save('before-staging-original-hashes.json',dict(passAll=True,files=2083,bytes=186399681,acceptedReceiptUnchanged=True))
assert not (E/'stage-receipts.json').exists();out=[]
for x in plan:
 admission();p=pathlib.Path(x['source'])
 with p.open('rb') as f:r=upload_stream(f,x['bytes'],x['target'])
 assert r['sha256']==x['sha256'];out.append(r);save('stage-receipts.json',out)
 if len(out)%25==0:print('staged',len(out),flush=True)
for n in ['transfer-files.jsonl','stage-receipts.json']:
 p=E/n
 with p.open('rb') as f:save(n+'-upload.json',upload_stream(f,p.stat().st_size,ROOT+'/immutable/receipts/'+n))
p=C/'ctl-pin.json'
with p.open('rb') as f:save('ctl-pin-upload.json',upload_stream(f,p.stat().st_size,ROOT+'/immutable/receipts/ctl-pin.json'))
print('RUNTIME_ONLY_STAGE_COMPLETE',flush=True)
