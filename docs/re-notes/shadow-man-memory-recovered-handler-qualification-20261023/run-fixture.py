#!/usr/bin/env python3
"""One fixed arena per sequential, fully reaped native child. No build path."""
import hashlib,json,pathlib,re,shutil,sys,time
from guard import H,ROOT,EXT,run
def size(p):
    return sum(q.stat().st_size for q in p.rglob('*') if q.is_file()) if p.is_dir() else p.stat().st_size
def admission(mode,argv):
    session=next(pathlib.Path('/home/user/.codex/sessions/2026/10/23').glob('*01a167bf-0542-7773-ba00-f21b473ebde4.jsonl'))
    measured=dict(privateTree=size(ROOT),external=size(EXT),separateSession=size(session))
    growth=dict(task=12582912,external=4194304,session=12582912,reserve=8388608)
    projected=sum(measured.values())+sum(growth.values())
    free=shutil.disk_usage(ROOT).free
    available=int(re.search(r'^MemAvailable:\s+(\d+)',pathlib.Path('/proc/meminfo').read_text(),re.M)[1])*1024
    contract=json.loads((H/'accepted-contract.json').read_text())
    module=pathlib.Path(contract['module']['path']).read_bytes()
    assert hashlib.sha256(module).hexdigest()==contract['module']['sha256'] and len(module)==1879746
    verdict='PASS' if projected<=67108864 and free-projected>=2982150144 and available>=1610612736 else 'DENIED'
    j=dict(at=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),argv=argv,measured=measured,growth=growth,projected=projected,cap=67108864,hostFree=free,hostAfterProjection=free-projected,hostFloor=2982150144,memAvailable=available,memFloor=1610612736,oldSpaceMiB=512,cpuSeconds=150,wallSeconds=150,liveTaskArenas=0,concurrentNativeChildren=0,nextChildArenaCount=1,arenaBytes=536870912,initialPages=8192,maximumPages=8192,workers=False,sourceCompile=False,guard=contract['guard'],verdict=verdict)
    (H/(mode+'.admission.json')).write_text(json.dumps(j,indent=2)+'\n')
    if verdict!='PASS':raise SystemExit(125)
if __name__=='__main__':
    mode=sys.argv[1]
    assert mode in ['normal','capture','wrong-command']
    assert not (H/(mode+'.admission.json')).exists(),'one-shot case; preserve failed execution'
    argv=[shutil.which('node'),'--max-old-space-size=512',str(H/'fixture.cjs'),mode]
    admission(mode,argv)
    run(mode,argv,expected=(86,) if mode=='capture' else (0,),native=True)
