import os, sys, json, time, signal, pathlib, subprocess, resource, datetime, hashlib
OWN = pathlib.Path('/tmp/tuxracer-real-media-tcl-syntax-gap-oct29/repo').resolve()
ROOT = pathlib.Path('/home/user/wine-assembly')
E = OWN / 'evidence'
E.mkdir(exist_ok=True)
resource.setrlimit(resource.RLIMIT_DATA, (128*1024**2,resource.getrlimit(resource.RLIMIT_DATA)[1]))
SSH = 'ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
ENV = dict(os.environ, GIT_ALTERNATE_OBJECT_DIRECTORIES=':'.join(json.loads((ROOT/'scratch/usage-watch/tuxracer-real-media-tcl-syntax-gap-oct29-object-stores.json').read_text())['stores']),GIT_SSH_COMMAND=SSH,PYTHONDONTWRITEBYTECODE='1')
def valid(cwd):
    p=pathlib.Path(cwd).resolve()
    if p!=OWN and OWN not in p.parents: raise ValueError('outside owned directory')
    if not p.is_dir(): raise ValueError('missing cwd')
    return p
def admission(label):
    s=os.statvfs(OWN); m=int(next(x.split()[1] for x in open('/proc/meminfo') if x.startswith('MemAvailable:')))*1024
    a=ROOT/'scratch/usage-watch/tuxracer-real-media-tcl-syntax-gap-oct29-admission.json'
    r=dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),device=OWN.stat().st_dev,f_bavail=s.f_bavail,blockSize=s.f_frsize,freeBytes=s.f_bavail*s.f_frsize,aggregate=125829120,minimumRemaining=3175088128,MemAvailable=m,memRequired=2147483648,aggregateVersion=hashlib.sha256(a.read_bytes()).hexdigest(),projection={'Git':3,'source':1,'tests':1,'evidence':1,'events':4,'sessionWAL':4,'future':2,'reserve':8})
    r['PASS']=r['freeBytes']-125829120>=3175088128 and m>=2147483648
    baseline=json.loads((OWN/'initial-admission.json').read_text())
    r['sharedWALPositiveGrowthCountedOnce']=sum(max(0,pathlib.Path(x['path']).stat().st_size-x['bytes']) for x in baseline['initialSharedWAL'] if pathlib.Path(x['path']).exists())
    r['taskPhysicalBytes']=sum(p.stat().st_blocks*512 for p in OWN.rglob('*') if p.is_file())
    r['sessionPaths']=baseline['sessionPaths']
    (E/(label+'.admission.json')).write_text(json.dumps(r,indent=2))
    if not r['PASS']: raise RuntimeError('admission failed: '+json.dumps(r))
def run(argv, *, cwd, label, git=False):
    cwd=valid(cwd)
    if git and argv[:3]!=['git','-C',str(OWN)]: raise ValueError('Git requires explicit owned -C')
    admission(label)
    def limits():
        os.setsid()
        resource.setrlimit(resource.RLIMIT_DATA, (256*1024**2,256*1024**2) if git else (128*1024**2,128*1024**2))
        resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(12*1024**2,12*1024**2))
    start=time.monotonic(); reason=None; peak=0
    with open(E/(label+'.stdout'),'wb') as out,open(E/(label+'.stderr'),'wb') as err:
        p=subprocess.Popen(argv,cwd=cwd,env=ENV,stdout=out,stderr=err,preexec_fn=limits)
        while p.poll() is None:
            rss=0; maxrss=0
            for q in pathlib.Path('/proc').iterdir():
                if not q.name.isdigit(): continue
                try:
                    st=(q/'stat').read_text().split(); group=int(st[4])
                    if group==p.pid:
                        n=int(st[23])*os.sysconf('SC_PAGE_SIZE');rss+=n;maxrss=max(maxrss,n)
                except (OSError,ValueError,IndexError): pass
            peak=max(peak,rss)
            if rss>512*1024**2 or (not git and maxrss>128*1024**2): reason='physical RSS limit'
            if time.monotonic()-start>120: reason='wall limit'
            if sum((E/(label+s)).stat().st_size for s in ('.stdout','.stderr'))>2*1024**2: reason='capture limit'
            if reason: break
            time.sleep(.03)
        try: os.killpg(p.pid,signal.SIGKILL)
        except ProcessLookupError: pass
        rc=p.wait()
    r=dict(argv=argv,cwd=str(cwd),exitCode=rc,reason=reason,peakGroupRSS=peak,wall=time.monotonic()-start,descendantsCleaned=True)
    (E/(label+'.json')).write_text(json.dumps(r,indent=2))
    if rc or reason: raise RuntimeError(json.dumps(r))
    return (E/(label+'.stdout')).read_text()
def git(args, *, label, mutate=False, init=False):
    if mutate and not init:
        assert run(['git','-C',str(OWN),'rev-parse','--show-toplevel'],cwd=OWN,label=label+'-top',git=True).strip()==str(OWN)
        assert run(['git','-C',str(OWN),'rev-parse','--absolute-git-dir'],cwd=OWN,label=label+'-dir',git=True).strip()==str(OWN/'.git')
    if init: assert not (OWN/'.git').exists()
    return run(['git','-C',str(OWN)]+args,cwd=OWN,label=label,git=True)
if __name__=='__main__':
    if sys.argv[1]=='init':
        results=[]
        try: run([sys.executable,'-c','raise Exception()'],label='omitted')
        except TypeError: results.append('omitted rejected before spawn')
        for p in [ROOT,ROOT/'scratch/usage-watch',pathlib.Path('/tmp/tuxracer-admitted-workdir-real-media-oct29/repo')]:
            try: run([sys.executable,'-c','raise Exception()'],cwd=p,label='outside')
            except ValueError: results.append(str(p)+' rejected before spawn')
        assert run([sys.executable,'-c','import os;print(os.getcwd())'],cwd=OWN,label='sentinel').strip()==str(OWN)
        (E/'containment.json').write_text(json.dumps(results+['owned sentinel passed']))
        (E/'launch.json').write_text(json.dumps({'ssh':SSH,'mountArgv':[],'runtime':False,'inheritedLimits':{n:resource.getrlimit(getattr(resource,n)) for n in ['RLIMIT_DATA','RLIMIT_CPU','RLIMIT_FSIZE','RLIMIT_AS']}}))
        git(['init'],label='init',mutate=True,init=True)
        git(['sparse-checkout','init','--no-cone'],label='sparse-init',mutate=True)
        git(['sparse-checkout','set','/tools/recovery/tuxracer-original-win32-recovery-oct28.py'],label='sparse-set',mutate=True)
        git(['checkout','-b','task/tuxracer-real-media-tcl-syntax-gap-oct29','3898e008861bad6c274506664b2804dbdc7d236a'],label='checkout',mutate=True)
        print('initialized')
