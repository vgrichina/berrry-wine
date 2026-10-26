import os,sys,subprocess,resource,selectors,time,json,signal,pathlib
BASE=pathlib.Path(__file__).resolve().parent
name=sys.argv[1]; cmd=sys.argv[2:]
def limits():
    resource.setrlimit(resource.RLIMIT_CPU,(60,60))
    resource.setrlimit(resource.RLIMIT_FSIZE,(24*1024*1024,24*1024*1024))
env=os.environ.copy(); env['NODE_OPTIONS']='--max-old-space-size=128'
env['GIT_SSH_COMMAND']='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
p=subprocess.Popen(cmd,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,env=env,preexec_fn=limits,start_new_session=True)
s=selectors.DefaultSelector();s.register(p.stdout,selectors.EVENT_READ);out=bytearray();start=time.monotonic();reason=None
while s.get_map():
    if time.monotonic()-start>60: reason='wall60';break
    for key,_ in s.select(.1):
        b=os.read(key.fd,8192)
        if not b:s.unregister(key.fileobj);continue
        out.extend(b)
        if len(out)>128*1024:reason='capture128KiB';break
    if reason:break
if reason:
    os.killpg(p.pid,signal.SIGTERM)
    try:p.wait(timeout=5)
    except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);p.wait(timeout=5)
else:p.wait(timeout=5)
(BASE/(name+'.log')).write_bytes(out[:128*1024])
r={'argv':cmd,'exitCode':p.returncode,'seconds':time.monotonic()-start,'bytes':len(out),'termination':reason,'limits':{'cpu':60,'wall':60,'heapMiB':128,'fileMiB':24,'captureKiB':128,'killReapSeconds':5}}
(BASE/(name+'.json')).write_text(json.dumps(r,indent=2)+'\n')
print(json.dumps(r));print(out[:8192].decode(errors='replace'))
sys.exit(p.returncode if not reason else 125)
