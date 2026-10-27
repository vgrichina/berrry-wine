import pathlib,json,time,shutil,os,hashlib,importlib.util,sys,subprocess,fcntl,resource
H=pathlib.Path(__file__).parent
R=H.parent/'repo'
P=pathlib.Path('/tmp/gl-required-version-independent-integrate-oct26/repo/test/helpers/palette-browser-supervisor.py')
assert hashlib.sha256(P.read_bytes()).hexdigest()=='9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85'
s=importlib.util.spec_from_file_location('supervisor',P);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
A=json.loads((H/'admission.json').read_text());M=1048576
def size(p):
    if p.is_file():return p.stat().st_blocks*512
    return sum(x.stat().st_blocks*512 for x in p.rglob('*') if x.is_file())
def gate():
    own=size(H.parent);events=size(pathlib.Path(A['launcher']))+size(pathlib.Path(A['session']))
    wal=sum(max(0,pathlib.Path(p).stat().st_blocks*512-n) for p,n in A['walBaseline'].items())
    source=size(R) if R.exists() else 0
    free=shutil.disk_usage(H).free;mem=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
    # Full outstanding fleet futures counted once; conservative until handback.
    q=dict(at=time.time(),own=own,sourceGit=source,events=events,positiveWalGrowth=wal,projectedTask=own+events+wal+8*M,free=free,future=112*M,projectedFree=free-112*M,memAvailable=mem)
    (H/'accounting.json').write_text(json.dumps(q,indent=2)+'\n')
    if source>8*M or events+wal>8*M or size(H)>8*M or q['projectedTask']>32*M:return 'task/category ceiling'
    if q['projectedFree']<2982150144:return 'disk floor'
    if mem<max(A['memoryRequired'],A['physicalFloor']):return 'physical floor'
def run(argv,label,rss=128*M):
    assert gate() is None,gate()
    result=m.supervise(argv,rss_limit=rss,cpu_limit=90,wall_limit=120,output_limit=2*M,check=gate)
    output=result.pop('output');(H/(label+'.log')).write_bytes(output)
    (H/(label+'.json')).write_text(json.dumps(result,indent=2)+'\n')
    assert result['exit']==0 and result['stopReason'] is None and result['cleanupComplete'],result
    return output
def git(*args):
    env=os.environ.copy();env['GIT_SSH_COMMAND']=A['ssh'];env['GIT_NO_LAZY_FETCH']='1';env['GIT_OPTIONAL_LOCKS']='0'
    cmd=[sys.executable,'-B','/home/user/wine-assembly/scratch/usage-watch/light-execution-pool-oct26.py','--slots','2','--',sys.executable,'-B',str(H/'control.py'),'direct',*args]
    p=subprocess.run(cmd,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=180)
    assert p.returncode==0,(p.returncode,p.stderr.decode()[:8192],p.stdout.decode(errors='replace')[:8192])
    return p.stdout
if __name__=='__main__':
    if sys.argv[1]=='direct':
        with open('/tmp/wine-ops-production-git.lock','a') as lock:
            fcntl.flock(lock,fcntl.LOCK_EX)
            out=run([sys.executable,'-B',str(H/'control.py'),'git-child',*sys.argv[2:]],'git-last',256*M)
            sys.stdout.buffer.write(out)
    elif sys.argv[1]=='git-child':
        resource.setrlimit(resource.RLIMIT_DATA,(512*M,512*M))
        os.execvp('git',['git',*sys.argv[2:]])
    elif sys.argv[1]=='test':
        out=run([sys.executable,'-B',str(H/'boundary.py')],'boundary')
        print(out.decode()[:8192])
