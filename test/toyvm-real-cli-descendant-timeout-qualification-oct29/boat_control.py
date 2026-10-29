from guard import *
import shlex,base64
BOAT='/home/user/.ascii/boat'
def api(label,code,*,box,cwd):
 return run(label,[BOAT,'exec',box,'--cwd',str(cwd),'--timeout','100','--json','--',shlex.join(['/usr/bin/python3','-B','-c',code])],cwd=REPO)
if __name__=='__main__':
 stage=sys.argv[1]
 if stage=='create':
  raw=run('boat-create',[BOAT,'new','--ttl','1800','--json','--no-update'],cwd=REPO)
  events=[json.loads(x) for x in raw.splitlines() if x.startswith('{')]; ready=next(x for x in events if x.get('event')=='ready');box=ready['id']
  save('lifecycle.json',dict(box=box,state=ready['state'],expiry=ready['archiveAfter'],cutoff='2026-10-29T03:35:00Z',shutdownOwner='coordinator; worker delegated preserve snapshot-stop and verify',createEvents=events))
  code='import os,pathlib,platform,importlib.util,ctypes.util,json,shutil,resource;print(json.dumps(dict(python=shutil.which("python3"),pythonResolved=str(pathlib.Path("/usr/bin/python3").resolve()),fuseDevice=pathlib.Path("/dev/fuse").exists(),fuseAccess=os.access("/dev/fuse",os.R_OK|os.W_OK),fuseLibrary=ctypes.util.find_library("fuse"),fusePython=importlib.util.find_spec("fuse") is not None,architecture=platform.machine(),MemAvailable=[x for x in pathlib.Path("/proc/meminfo").read_text().splitlines() if x.startswith("MemAvailable")],device=os.stat("/tmp").st_dev,statvfs=list(os.statvfs("/tmp")),limits={str(x):resource.getrlimit(x) for x in (resource.RLIMIT_DATA,resource.RLIMIT_CPU,resource.RLIMIT_FSIZE)})))'
  print(api('boat-capability',code,box=box,cwd='/home/user')[:3000])
