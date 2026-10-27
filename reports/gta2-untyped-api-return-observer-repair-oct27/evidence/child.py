import os,sys,resource
out,err,kind,*cmd=sys.argv[1:]
os.dup2(os.open(out,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600),1)
os.dup2(os.open(err,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600),2)
if kind=='git':
 resource.setrlimit(resource.RLIMIT_DATA,(512*1024**2,512*1024**2))
os.execvp(cmd[0],cmd)
