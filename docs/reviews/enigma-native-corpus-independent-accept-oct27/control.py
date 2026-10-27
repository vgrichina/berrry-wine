import sys
sys.dont_write_bytecode=True
sys.path.insert(0,'/tmp/enigma-retained-canonical-native-msg-qualification-oct26/ops')
import common as c
from pathlib import Path
import json,os,shutil,time
c.H=Path('/tmp/enigma-native-corpus-independent-accept-oct27');c.O=c.H/'ops';c.R=c.H/'repo'
ROOT=Path('/home/user/wine-assembly');NAME=c.H.name
def gate(stage):
    # Admission reserves every byte of the 48 MiB allocation once; standing
    # donor/tools are read-only and not copied. All existing bytes are in free.
    baseline=c.O/'wal-baseline.json'
    wals=list(Path('/home/user/.codex').glob('*.sqlite-wal'))
    if not baseline.exists():c.save(baseline.name,{str(p):c.alloc(p) for p in wals})
    b=json.loads(baseline.read_text())
    session=sum(c.alloc(p) for p in Path('/home/user/.codex/sessions/2026/10/27').glob('*'+os.environ.get('CODEX_THREAD_ID','NONE')+'*'))
    actual=dict(task=c.alloc(c.H),launcher=c.alloc(ROOT/'scratch/usage-watch'/NAME),session=session,positiveWAL=sum(max(0,c.alloc(p)-b.get(str(p),0)) for p in wals))
    clients=[]
    for p in Path('/proc').glob('[0-9]*'):
        try:
            cmd=p.joinpath('cmdline').read_bytes()
            if b'/bin/codex' in cmd and (b'exec\0' in cmd or b'resume\0' in cmd):clients.append(dict(pid=int(p.name),rss=int(p.joinpath('status').read_text().split('VmRSS:')[1].split()[0])*1024,argv=cmd.decode(errors='replace').split('\0')[:-1]))
        except (OSError,IndexError):pass
    peers={}
    for n,cap in [('gl-output-file-confinement-repair-oct27',62914560),('alien-dispatch-boundary-independent-publication-oct27',50331648)]:
        used=c.alloc(Path('/tmp')/n)+c.alloc(ROOT/'scratch/usage-watch'/n)
        peers[n]=max(0,cap-used)
    used=sum(actual.values());reserve=8388608;future=max(reserve,50331648-used)
    free=shutil.disk_usage(c.H).free;mem=int(Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
    required=(768+256+64*len(clients))*1048576
    j=dict(at=time.time(),stage=stage,actual=actual,allocation=50331648,categories=dict(sourceGitTestsEvidence=16777216,sessionEventsPositiveWALOnce=16777216,publication=8388608,reserve=reserve),future=future,peerRemaining=peers,free=free,projectedFree=free-future-sum(peers.values()),floor=2982150144,memAvailable=mem,required=required,clients=clients,residentRSSAlreadyInMemAvailable=True,standingReadOnly=['donor repo/ops','retained modules','installed Python/Git/Node'],mountArgv=[],mountValidation='N/A: no runtime, mounts or filename-bearing mount argv')
    j['pass']=used+reserve<=50331648 and j['projectedFree']>=j['floor'] and mem>=required
    c.save('admission-'+stage+'.json',j)
    assert j['pass'],j
c.gate=gate
if __name__=='__main__':
    if sys.argv[1]=='gate':gate(sys.argv[2])
    elif sys.argv[1]=='supervise':
        a=json.load(open(sys.argv[2]));c.supervised(a['cmd'],a['git'],a['label'],a.get('cwd',str(c.R)),a.get('inputPath'))
    else:
        git=sys.argv[1]=='git';label=sys.argv[2];cmd=sys.argv[3:]
        req=c.O/'request.json';req.write_text(json.dumps(dict(cmd=cmd,git=git,label=label,cwd=str(c.R))))
        import subprocess
        # Replace this controller: only pool+supervisor+descendants consume RAM.
        os.execv(sys.executable,[sys.executable,str(ROOT/'scratch/usage-watch/light-execution-pool-oct26.py'),'--slots','2' if git else '1','--',sys.executable,__file__,'supervise',str(req)])
