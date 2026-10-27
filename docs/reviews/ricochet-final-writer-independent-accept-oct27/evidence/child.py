import sys,os,pathlib,resource,json,fcntl
O=pathlib.Path(__file__).resolve().parent
name,mode,*argv=sys.argv[1:]
for fd,suffix in ((1,'.stdout'),(2,'.stderr')):
    f=os.open(O/(name+suffix),os.O_WRONLY|os.O_APPEND);os.dup2(f,fd);os.close(f)
if mode=='git':
    lock=os.open('/tmp/wine-ops-production-git.lock',os.O_CREAT|os.O_RDWR,0o600)
    fcntl.flock(lock,fcntl.LOCK_EX);os.set_inheritable(lock,True)
    s,h=resource.getrlimit(resource.RLIMIT_DATA)
    cap=512*1048576
    resource.setrlimit(resource.RLIMIT_DATA,(min(s,cap) if s!=-1 else cap,min(h,cap) if h!=-1 else cap))
(O/(name+'.child-limits.json')).write_text(json.dumps({n:resource.getrlimit(getattr(resource,n)) for n in ('RLIMIT_AS','RLIMIT_DATA','RLIMIT_CPU','RLIMIT_FSIZE')},indent=2))
os.execvpe(argv[0],argv,os.environ)
