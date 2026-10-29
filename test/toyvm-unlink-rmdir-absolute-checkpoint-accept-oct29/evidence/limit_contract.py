"""Task-owned child limit topology. No inherited hard limit is raised."""
import json, os, pathlib, resource, subprocess, sys
M=1048576

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
    def run(argv, *, cwd, git=False):
        lexical=pathlib.Path(os.path.abspath(os.fspath(cwd)))
        if not lexical.is_relative_to(owned): raise ValueError('outside owned root before existence check')
        p=lexical.resolve(strict=True)
        if not p.is_relative_to(owned): raise ValueError('symlink escapes owned root')
        q=subprocess.run(argv,cwd=p,preexec_fn=lambda:child_limits(git),capture_output=True,timeout=10)
        assert len(q.stdout)+len(q.stderr)<4096
        assert q.returncode==0,(q.returncode,q.stderr[:256])
        return q.stdout.decode().strip()
    rec=configure_parent(); controls={}
    for key,kw in [('omitted',{}),('root',{'cwd':'/home/user/wine-assembly'}),('donor',{'cwd':'/tmp/toyvm-pinned-log-acceptance-publication-oct29/repo'})]:
        try:run(['/bin/pwd'],**kw)
        except (TypeError,ValueError):controls[key]='REJECTED BEFORE SPAWN'
        else:raise AssertionError('containment failed '+key)
    rec['controls']=controls
    rec['sentinel']=run(['/bin/pwd'],cwd=owned)
    rec['pythonChild']=json.loads(run([sys.executable,'-B','-c','import resource,json;print(json.dumps(list(resource.getrlimit(resource.RLIMIT_DATA))))'],cwd=owned))
    rec['gitVersion']=run(['git','-C',str(owned),'--version'],cwd=owned,git=True)
    assert rec['pythonChild']==[128*M,128*M]
    rec['PASS']=True
    print(json.dumps(rec))
if __name__=='__main__':selftest(sys.argv[1])
