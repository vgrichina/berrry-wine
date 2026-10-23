"""One fresh destination, accepted per-file Range206 -> raw PUT, no retry."""
import time,io,os,subprocess,shutil
from transport import *
C=pathlib.Path('/home/user/wine-assembly-shadow-man-launcher-configuration-capture-oct23/scratch/runs/20261023-shadow-man-launcher-configuration-capture')
R=pathlib.Path('/home/user/wine-assembly-shadow-man-remaining-files-launcher-capture-oct23/scratch/runs/20261023-shadow-man-remaining-files-launcher-capture')
W=E.parents[2]
def admission():
 a=json.loads((E/'admission.json').read_text());own=int(subprocess.check_output(['du','-s','-B1',str(W)]).split()[0]);total=a['selectedAllocated']+own+a['toolsAndGitAllowance']+a['reserve'];assert total<a['cap'];assert shutil.disk_usage(W).free>a['hostFloor'];return total
def main():
 assert not (E/'recovery-started.json').exists();admission();save('recovery-started.json',dict(time=time.time(),box=BOX))
 save('box-before.json',api('sandboxes/'+BOX))
 run('''import pathlib,os,shutil,json
R=pathlib.Path('''+repr(ROOT)+''');assert os.getuid()==1000 and os.getgid()==1000
assert not R.exists(),'Fresh root must be absent; preserve any existing state'
assert shutil.disk_usage('/home/user').free>=2147483648+939524096
R.mkdir();(R/'immutable').mkdir();(R/'fixed').mkdir();(R/'mutable').mkdir()
print(json.dumps(dict(uid=os.getuid(),gid=os.getgid(),free=shutil.disk_usage(R).free,root=str(R))))''','fresh-destination.json')
 rows=json.loads((E/'full-accepted-manifest.json').read_text());assert len(rows)==2083 and sum(x['bytes'] for x in rows)==186399681
 done=0;total=0;start=time.monotonic();current=None
 try:
  for x in rows:
   current=x;admission()
   with source_file(PREFIX+'/'+x['rel'],x['bytes']) as src:
    receipt=upload_stream(src,x['bytes'],ROOT+'/immutable/restored/'+x['rel']);assert src.read(1)==b''
   assert receipt['sha256']==x['sha256'], 'Source hash mismatch'
   with (E/'transfer-files.jsonl').open('a') as out:out.write(json.dumps(receipt)+'\n')
   done+=1;total+=x['bytes']
   if done%100==0:print(json.dumps(dict(files=done,bytes=total,seconds=round(time.monotonic()-start,2))),flush=True)
  save('transfer-complete.json',dict(passAll=True,files=done,bytes=total,seconds=time.monotonic()-start,snapshot=SNAP,prefix=PREFIX))
 except Exception as ex:
  save('first-transfer-error.json',dict(type=type(ex).__name__,detail=str(ex) if isinstance(ex,(RuntimeError,AssertionError)) else 'Transport exception, URL suppressed',file=current['rel'] if current else None,completed=done,bytes=total,seconds=time.monotonic()-start));raise RuntimeError('FIRST transfer error; STOP') from None
 plan=json.loads((C/'staging-plan.json').read_text());assert len(plan)==217
 index={l.split('\t')[1]:l.split()[1] for l in (E/'base-index.txt').read_text().splitlines()}
 for x in plan:
  p=pathlib.Path(x['source']);assert p.stat().st_size==x['bytes']
  with p.open('rb') as f:assert hashlib.file_digest(f,'sha256').hexdigest()==x['sha256']
  rel=x['target'].split('/immutable/runtime/',1)
  if len(rel)==2 and rel[1] in index:
   b=p.read_bytes();assert hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==index[rel[1]],rel[1]
 save('staging-plan.json',plan);out=[]
 for x in plan:
  admission();p=pathlib.Path(x['source'])
  with p.open('rb') as f:r=upload_stream(f,x['bytes'],x['target'])
  assert r['sha256']==x['sha256'];out.append(r);save('stage-receipts.json',out)
 # Complete inventories become destination-side hash inputs before any clone.
 for n,t in [('transfer-files.jsonl','transfer-files.jsonl'),('stage-receipts.json','stage-receipts.json')]:
  with (E/n).open('rb') as f:upload_stream(f,(E/n).stat().st_size,ROOT+'/immutable/receipts/'+t)
 for n in ['ctl-pin.json']:
  p=C/n
  with p.open('rb') as f:upload_stream(f,p.stat().st_size,ROOT+'/immutable/receipts/'+n)
 print('RESTORE_AND_STAGE_COMPLETE',flush=True)
if __name__=='__main__':main()
