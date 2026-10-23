"""One sequential remaining-file restoration; first failure ends task."""
import datetime, hashlib, http.client, json, os, pathlib, shutil, time, urllib.request, urllib.error
from transport import *
PRIOR=pathlib.Path('/home/user/wine-assembly-shadow-man-launcher-configuration-capture-oct23/scratch/runs/20261023-shadow-man-launcher-configuration-capture')
OLD=pathlib.Path('/home/user/wine-assembly-shadow-man-streamed-installed-runtime-oct22/scratch/runs/20261022-shadow-man-streamed-installed-runtime/transfer-files.jsonl')
DEADLINE=datetime.datetime(2026,10,23,1,22,tzinfo=datetime.timezone.utc).timestamp()
def local_gate():
 a=json.loads((E/'admission.json').read_text());d={p:int(subprocess.check_output(['du','-s','-B1',p]).split()[0]) for p in a['donors']};own=int(subprocess.check_output(['du','-s','-B1',str(E.parents[2])]).split()[0]);total=sum(d.values())+own+a['toolsAllowance']+a['rootAllowance']+a['reserve'];assert total<a['cap'] and shutil.disk_usage(E).free>a['hostFloor'];save('local-current.json',dict(wholeLocal=total,own=own,reserve=a['reserve'],hostFree=shutil.disk_usage(E).free))
def inventory(name):
 code="""import pathlib,json,hashlib,os,shutil,subprocess
R=pathlib.Path(ROOT);I=R/'immutable'
def sha(p):
 with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def rows(p):return [dict(path=str(x),bytes=x.stat().st_size,sha256=sha(x),mode=x.stat().st_mode&511) for x in p.rglob('*') if x.is_file()]
def alloc(p):return sum(x.lstat().st_blocks*512 for x in [p,*p.rglob('*')])
print(json.dumps(dict(uid=os.getuid(),originals=rows(I/'restored'),runtime=[x for x in rows(R) if '/restored/' not in x['path'] and '/mutable/' not in x['path']],immutableReadOnly=all(not p.stat().st_mode&146 for p in [I,*I.rglob('*')]),immutableAllocated=alloc(I),fixedAllocated=alloc(R/'fixed'),mutableAllocated=alloc(R/'mutable'),tmpfsMounted=os.path.ismount(R/'mutable'),freeBytes=shutil.disk_usage(R).free,nodeProcesses=subprocess.run(['pgrep','-a','node'],capture_output=True,text=True).stdout)))
""".replace('ROOT',repr(ROOT))
 r=run(code,name+'-api.json',30);assert not r['stdoutTruncated'];j=json.loads(r['stdout']);save(name+'.json',j);return j
def error_detail(e):
 p=getattr(e,'partial',None)
 return dict(errorClass=type(e).__name__,partialLength=len(p) if isinstance(p,bytes) else p,expected=getattr(e,'expected',None),httpStatus=e.code if isinstance(e,urllib.error.HTTPError) else None)
def transfer(x):
 target=ROOT+'/immutable/restored/'+x['rel'];size=x['bytes'];state=dict(target=target,expectedBytes=size,sourceReadCalls=0,sourceBytes=0,yieldedBytes=0,phase='SOURCE_OPEN',bufferLimit=65536)
 timeout=min(90,max(1,int(DEADLINE-time.time())));assert timeout>=30
 src=None
 try:
  src=source_file(PREFIX+'/'+x['rel'],size)
  state['phase']='DESTINATION_UPLOAD_URL';u=api('sandboxes/'+BOX+'/files/upload-url',dict(path=target,ttlSeconds=300));assert u['method']=='PUT' and u['path']==target
  h=hashlib.sha256()
  def blocks():
   while state['sourceBytes']<size:
    state['sourceReadCalls']+=1
    try:b=src.read(min(65536,size-state['sourceBytes']))
    except Exception as ex:
     state['sourceReadFailure']=error_detail(ex);raise
    if not b:state['sourceReadFailure']=dict(errorClass='SourceUnderflow',partialLength=0,expected=size-state['sourceBytes']);raise RuntimeError('source underflow')
    state['sourceBytes']+=len(b);h.update(b);state['yieldedBytes']+=len(b);yield b
  state['phase']='DESTINATION_PUT'
  req=urllib.request.Request(u['url'],data=blocks(),headers={'Content-Length':str(size),'Content-Type':'application/octet-stream'},method='PUT')
  try:
   with OPENER.open(req,timeout=timeout) as f:
    state['phase']='DESTINATION_RESPONSE_READ';state['destinationStatus']=f.status;assert f.status==200
    reply=f.read(65537);state['responseBytes']=len(reply);assert len(reply)<=65536
  except Exception as ex:
   if 'sourceReadFailure' not in state:state['destinationFailure']=error_detail(ex)
   raise
  assert state['sourceBytes']==size and h.hexdigest()==x['sha256']
  state['phase']='DESTINATION_HASH'
  r=run('import pathlib,hashlib,json\np=pathlib.Path('+repr(target)+')\nwith p.open("rb") as f:h=hashlib.file_digest(f,"sha256").hexdigest()\nassert p.stat().st_size=='+str(size)+' and h=='+repr(x['sha256'])+'\np.chmod(0o444)\nprint(json.dumps(dict(bytes=p.stat().st_size,sha256=h)))','last-file-hash-api.json',10)
  state.update(verified=True,sha256=h.hexdigest(),destinationVerification=json.loads(r['stdout']))
  with (E/'completed-new.jsonl').open('a') as out:out.write(json.dumps(state)+'\n')
  return state
 except Exception as ex:
  state.update(failure=error_detail(ex),at=datetime.datetime.now(datetime.timezone.utc).isoformat());save('first-transfer-failure.json',state);raise RuntimeError('First transfer failure; details preserved, no retry') from None
 finally:
  if src:src.close()
def main():
 local_gate();save('box-before.json',api('sandboxes/'+BOX))
 full=[]
 for line in OLD.read_text().splitlines():
  x=json.loads(line);x['rel']=x['path'].split('/immutable/restored/',1)[1];x['path']=ROOT+'/immutable/restored/'+x['rel'];full.append(x)
 assert len(full)==2083 and sum(x['bytes'] for x in full)==186399681
 save('full-accepted-manifest.json',full)
 fresh=inventory('fresh-retained');assert fresh['uid']==1000 and fresh['immutableReadOnly'] and not fresh['nodeProcesses'] and not fresh['tmpfsMounted'] and fresh['mutableAllocated']==4096
 expected={x['path']:x for x in full};actual={x['path']:x for x in fresh['originals']}
 prior=list(map(json.loads,(PRIOR/'transfer-files.jsonl').read_text().splitlines()));assert len(prior)==1845 and set(actual)=={x['path'] for x in prior}
 for x in fresh['originals']:assert x['bytes']==expected[x['path']]['bytes'] and x['sha256']==expected[x['path']]['sha256']
 stages=list({x['path']:x for x in json.loads((PRIOR/'stage-receipts.json').read_text())+json.loads((PRIOR/'gate-tools-final-upload.json').read_text())}.values());rt={x['path']:x for x in fresh['runtime']}
 for x in stages:assert rt[x['path']]['bytes']==x['bytes'] and rt[x['path']]['sha256']==x['sha256']
 # The last two gate-tool receipts are outside the runtime; fresh immutable hash seals also cover these.
 missing=[x for x in full if x['path'] not in actual];assert len(missing)==238 and sum(x['bytes'] for x in missing)==32579084
 save('missing-238.json',missing);save('reconciliation.json',dict(passAll=True,retainedFiles=1845,retainedBytes=153820597,missingFiles=238,missingBytes=32579084,runtimeFiles=len(rt),stageReceiptsMatched=len(stages)))
 assert fresh['immutableAllocated']+32579084+16777216<2147483648 and fresh['fixedAllocated']+16777216<100663296 and fresh['freeBytes']>2147483648+939524096
 # Only ancestor directories of missing files receive temporary write permission.
 paths=set()
 for x in missing:
  p=pathlib.PurePosixPath(x['path']).parent
  while str(p).startswith(ROOT+'/immutable'):
   paths.add(str(p));p=p.parent
 save('temporary-parent-paths.json',sorted(paths))
 code='import pathlib\npaths='+repr(sorted(paths,key=lambda x:len(x)))+'\nfor x in paths:\n p=pathlib.Path(x)\n if not p.exists():p.mkdir()\n p.chmod(0o755)\n'
 run(code,'parents-write-api.json',15)
 try:
  for i,x in enumerate(missing):
   local_gate()
   if time.time()+max(35,x['bytes']/200000)+90>=DEADLINE:save('time-stop.json',dict(nextFile=x['rel'],remainingSeconds=DEADLINE-time.time(),completed=i));break
   transfer(x);print(json.dumps(dict(completed=i+1,total=238,path=x['rel'],bytes=x['bytes'])),flush=True)
 finally:
  run('import pathlib\npaths='+repr(sorted(paths,key=lambda x:-len(x)))+'\nfor x in paths:\n p=pathlib.Path(x)\n if p.exists():p.chmod(0o555)\n','parents-readonly-api.json',15)
  inventory('after-transfer');save('box-after-transfer.json',api('sandboxes/'+BOX))
if __name__=='__main__':main()
