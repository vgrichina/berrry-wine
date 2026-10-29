"""Task-owned child limit topology. No inherited hard limit is raised."""
import json, os, pathlib, resource, subprocess, sys, time, tempfile
M=1048576
OWNED=pathlib.Path('/tmp/toyvm-overwrite-cumulative-write-limit-oct29').resolve(strict=True)
REPO=OWNED/'repo'

def validated_cwd(cwd):
    lexical=pathlib.Path(os.path.abspath(os.fspath(cwd)))
    if not lexical.is_relative_to(OWNED): raise ValueError('outside owned root before existence check')
    resolved=lexical.resolve(strict=True)
    if not resolved.is_relative_to(OWNED): raise ValueError('symlink escapes owned root')
    return resolved

def run(argv, *, cwd, git=False, timeout=120, **kwargs):
    cwd=validated_cwd(cwd)
    st=os.statvfs(OWNED)
    mem=int(next(x.split()[1] for x in pathlib.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024
    admission={'at':time.time(),'device':os.stat(OWNED).st_dev,'f_bavail':st.f_bavail,'blockSize':st.f_frsize,'free':st.f_bavail*st.f_frsize,'MemAvailable':mem,'requiredBytes':3200253952,'remainingAggregateGrowth':150994944,'memRequired':2147483648}
    admission['PASS']=admission['free']-admission['remainingAggregateGrowth']>=admission['requiredBytes'] and mem>=admission['memRequired']
    with (OWNED/'operation-admission.jsonl').open('a') as f:f.write(json.dumps(admission)+'\n')
    if not admission['PASS']:raise RuntimeError('fresh aggregate admission rejected')
    if git:
        if argv[:3]!=['git','-C',str(REPO)]: raise ValueError('explicit owned git -C required')
        if (REPO/'.git').resolve(strict=True)!=REPO/'.git': raise ValueError('foreign gitdir')
        for option,expected in [('--show-toplevel',str(REPO)),('--absolute-git-dir',str(REPO/'.git'))]:
            q=subprocess.run(['git','-C',str(REPO),'rev-parse',option],cwd=cwd,preexec_fn=lambda:child_limits(True),capture_output=True,timeout=10,check=True)
            if q.stdout.decode().strip()!=expected: raise ValueError('git identity mismatch')
    capture=kwargs.pop('capture_output',False)
    if not capture:raise ValueError('bounded private capture required')
    with tempfile.TemporaryFile(dir=OWNED) as out, tempfile.TemporaryFile(dir=OWNED) as err:
        p=subprocess.Popen(argv,cwd=cwd,preexec_fn=lambda:child_limits(git),stdout=out,stderr=err,**kwargs)
        start=time.monotonic()
        while p.poll() is None:
            rows={}
            for proc in pathlib.Path('/proc').iterdir():
                if not proc.name.isdigit():continue
                try:
                    raw=(proc/'stat').read_text();s=raw[raw.rindex(')')+2:].split();rows[int(proc.name)]=(int(s[1]),max(0,int(s[21]))*os.sysconf('SC_PAGE_SIZE'))
                except (OSError,ValueError):pass
            group={p.pid}
            while True:
                expanded=group|{pid for pid,(ppid,rss) in rows.items() if ppid in group}
                if expanded==group:break
                group=expanded
            violation=time.monotonic()-start>timeout or rows.get(os.getpid(),(0,0))[1]>128*M or sum(rows.get(pid,(0,0))[1] for pid in group)>512*M or os.fstat(out.fileno()).st_size+os.fstat(err.fileno()).st_size>2*M
            if violation:
                p.kill();p.wait();raise RuntimeError('wall/RSS/capture guard rejected operation')
            time.sleep(.02)
        out.seek(0);err.seek(0)
        return subprocess.CompletedProcess(argv,p.returncode,out.read(2*M),err.read(2*M))

def configure_parent():
    soft, hard = resource.getrlimit(resource.RLIMIT_DATA)
    if hard != resource.RLIM_INFINITY and hard < 256*M:
        raise RuntimeError('inherited DATA hard limit incompatible; stop, never raise it')
    resource.setrlimit(resource.RLIMIT_DATA, (128*M, hard))
    resource.setrlimit(resource.RLIMIT_CPU, (90,90))
    resource.setrlimit(resource.RLIMIT_FSIZE, (12*M,12*M))
    return {'inheritedDATA':[soft,hard], 'parentDATA':list(resource.getrlimit(resource.RLIMIT_DATA)), 'policy':'parent soft128; inherited hard unchanged; Git child256 only; Python child128; physical parentRSS128 monitored by task supervisor'}

def child_limits(git=False):
    amount=(256 if git else 128)*M
    resource.setrlimit(resource.RLIMIT_DATA,(amount,amount))
    resource.setrlimit(resource.RLIMIT_CPU,(90,90))
    resource.setrlimit(resource.RLIMIT_FSIZE,(12*M,12*M))

def selftest(owned):
    owned=pathlib.Path(owned).resolve(strict=True)
    rec=configure_parent(); controls={}
    for key,kw in [('omitted',{}),('root',{'cwd':'/home/user/wine-assembly'}),('donor',{'cwd':'/tmp/toyvm-pinned-log-acceptance-publication-oct29/repo'})]:
        try:run(['/bin/pwd'],capture_output=True,**kw)
        except (TypeError,ValueError):controls[key]='REJECTED BEFORE SPAWN'
        else:raise AssertionError('containment failed '+key)
    rec['controls']=controls
    rec['sentinel']=run(['/bin/pwd'],cwd=owned,capture_output=True).stdout.decode().strip()
    rec['pythonChild']=json.loads(run([sys.executable,'-B','-c','import resource,json;print(json.dumps(list(resource.getrlimit(resource.RLIMIT_DATA))))'],cwd=owned,capture_output=True).stdout)
    rec['gitVersion']=run(['git','-C',str(REPO),'--version'],cwd=REPO,git=True,capture_output=True).stdout.decode().strip()
    assert rec['pythonChild']==[128*M,128*M]
    rec['PASS']=True
    print(json.dumps(rec))
if __name__=='__main__':selftest(sys.argv[1])
