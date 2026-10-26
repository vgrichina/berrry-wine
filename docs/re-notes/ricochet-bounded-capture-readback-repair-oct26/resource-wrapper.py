import hashlib, json, os, pathlib, resource, shutil, signal, subprocess, sys, time
H = pathlib.Path('/tmp/ricochet-bounded-capture-readback-repair-oct26')
O = H/'ops'; REPO = H/'repo'
ROOT = pathlib.Path('/home/user/wine-assembly')
LOG = ROOT/'scratch/usage-watch/ricochet-bounded-capture-readback-repair-oct26'
PARENT = '283eb307e139b9deacd6c9921706e4b8427c8f0a'
DONOR = pathlib.Path('/tmp/ricochet-serial-progress-gameplay-api-oct26/repo')
SSH = 'ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
def save(name, obj):
    p=O/name; t=p.with_suffix(p.suffix+'.new'); t.write_text(json.dumps(obj,indent=2)+'\n'); t.replace(p)
def allocated(p):
    if not p.exists(): return 0
    seen=set(); total=0
    for q in ([p,*p.rglob('*')] if p.is_dir() else [p]):
        s=q.lstat(); k=s.st_dev,s.st_ino
        if k not in seen: total+=s.st_blocks*512; seen.add(k)
    return total
def gate(stage):
    baseline=O/'wal-baseline.json'
    if not baseline.exists(): save(baseline.name,{str(p):allocated(p) for p in pathlib.Path('/home/user/.codex').glob('*-wal')})
    wal=sum(max(0,allocated(pathlib.Path(p))-v) for p,v in json.loads(baseline.read_text()).items())
    sessions=list(pathlib.Path('/home/user/.codex/sessions').rglob('*'+os.environ['CODEX_SESSION_ID']+'.jsonl'))
    assert len(sessions)==1
    clients=[]
    for p in pathlib.Path('/proc').glob('[0-9]*'):
        try:
            a=(p/'cmdline').read_bytes().split(b'\0')
            if b'exec' not in a or not a or not a[0].endswith(b'/codex'): continue
            s=(p/'status').read_text(); rss=int(s.split('VmRSS:')[1].split()[0])*1024
            clients.append(dict(pid=int(p.name),rss=rss,growth=max(0,335544320-rss)))
        except (OSError,IndexError): pass
    charges=dict(ownLocal=allocated(H),session=allocated(sessions[0]),events=allocated(LOG),taskDispatch=sum(allocated(p) for p in LOG.parent.glob(LOG.name+'*') if p.is_file()),WALpositiveOnce=wal,publicationAndFuture=33554432,reserve=8388608)
    mem=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
    required=max(3489660928,805306368+1073741824+536870912+134217728+sum(c['growth'] for c in clients))
    free=shutil.disk_usage(H).free
    j=dict(at=time.time(),stage=stage,charges=charges,total=sum(charges.values()),cap=134217728,memAvailable=mem,required=required,clients=clients,standingGLReservation=1073741824,hostFree=free,projectedFree=free-33554432-8388608,hostFloor=2982150144)
    j['pass']=j['total']<=j['cap'] and mem>=required and j['projectedFree']>=j['hostFloor']
    save('admission-'+stage+'.json',j); assert j['pass'],j
    return j
def run(argv, git=False, cwd=None, label='command'):
    gate(label)
    cap=536870912 if git else 134217728
    def limits():
        resource.setrlimit(resource.RLIMIT_CPU,(90,90)); resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
        resource.setrlimit(resource.RLIMIT_DATA,(536870912 if git else 100663296,)*2)
    env=dict(os.environ,GIT_SSH_COMMAND=SSH,PYTHONDONTWRITEBYTECODE='1',TMPDIR=str(O))
    start=time.monotonic(); out=O/(label+'.output'); peak=0; cpu=0; reason='natural'; known={}
    with out.open('wb') as f:
        p=subprocess.Popen(argv,cwd=cwd,env=env,preexec_fn=limits,start_new_session=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
        os.set_blocking(p.stdout.fileno(),False); n=0
        while True:
            rows={}
            for q in pathlib.Path('/proc').glob('[0-9]*'):
                try:
                    s=(q/'stat').read_text(); a=s[s.rfind(')')+2:].split()
                    rows[int(q.name)]=(int(a[1]),a[19],int(a[21])*os.sysconf('SC_PAGE_SIZE'),(int(a[11])+int(a[12]))/os.sysconf('SC_CLK_TCK'),a[0])
                except (OSError,ValueError,IndexError): pass
            owners={p.pid}
            for _ in range(8):
                added={pid for pid,s in rows.items() if s[0] in owners}-owners
                if not added: break
                owners.update(added)
            known.update({pid:rows[pid] for pid in owners if pid in rows})
            live={pid:s for pid,s in rows.items() if pid in known and known[pid][1]==s[1] and s[4]!='Z'}
            peak=max(peak,sum(s[2] for s in live.values())); cpu=max(cpu,sum(s[3] for s in known.values()))
            try: b=os.read(p.stdout.fileno(),8192)
            except BlockingIOError: b=b''
            if n+len(b)>2097152: reason='output'; break
            n+=len(b); f.write(b)
            if peak>cap: reason='physical-rss'; break
            if cpu>=90: reason='cpu'; break
            if time.monotonic()-start>=120: reason='wall'; break
            if p.poll() is not None and not b: break
            time.sleep(.005)
        if reason!='natural': os.killpg(p.pid,signal.SIGKILL)
        p.wait(timeout=1)
    result=dict(argv=argv,returncode=p.returncode,reason=reason,wall=time.monotonic()-start,peakTreeRSS=peak,peakTreeCPU=cpu,outputBytes=n,cap=cap,gitDATAonly=git)
    save(label+'.json',result)
    if p.returncode or reason!='natural':
        if not (O/'first-failure.json').exists(): save('first-failure.json',result)
        raise RuntimeError(result)
    assert out.stat().st_size<=8192,'excerpt guard'
    return out.read_text().strip()
def git(*args, repo=REPO, label='git'):
    return run(['git','-c','pack.threads=1','-c','pack.window=0','-c','pack.windowMemory=16m','-c','core.preloadIndex=false','-c','index.threads=1','-C',str(repo),*args],git=True,label=label)
if __name__=='__main__':
    gate(sys.argv[1] if len(sys.argv)>1 else 'manual')
