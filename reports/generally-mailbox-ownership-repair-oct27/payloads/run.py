import pathlib, sys, os, json, hashlib, importlib.util, shlex, time, resource
R=pathlib.Path('/tmp/generally-mailbox-ownership-repair-oct27'); O=R/'ops'; M=1048576
S=pathlib.Path('/tmp/gl-required-version-independent-integrate-oct26/repo/test/helpers/palette-browser-supervisor.py')
assert hashlib.sha256(S.read_bytes()).hexdigest()=='9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85'
s=importlib.util.spec_from_file_location('sup',S); sup=importlib.util.module_from_spec(s); s.loader.exec_module(sup)
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
os.environ.clear()
os.environ.update(PATH='/usr/local/bin:/usr/bin:/bin',HOME='/home/user',LANG='C.UTF-8',TZ='UTC',NODE_OPTIONS='--max-old-space-size=512',GIT_SSH_COMMAND=SSH,GIT_CONFIG_NOSYSTEM='1',GIT_TERMINAL_PROMPT='0',PYTHONDONTWRITEBYTECODE='1')
label=sys.argv[1]; kind=sys.argv[2]; cmd=sys.argv[3:]
assert not (O/(label+'.json')).exists(), 'no unchanged retries'
out=O/(label+'.stdout'); err=O/(label+'.stderr')
out.touch(exist_ok=False); err.touch(exist_ok=False)
if kind=='git':
    # DATA applies only to the exec'd Git subprocess, never supervisor/Node.
    cmd=['/usr/bin/flock','/tmp/wine-ops-production-git.lock','/usr/bin/python3','-B','-c',"import os,resource,sys;resource.setrlimit(resource.RLIMIT_DATA,(536870912,536870912));os.execvp(sys.argv[1],sys.argv[1:])",*cmd]
shell='exec '+shlex.join(cmd)+' >'+shlex.quote(str(out))+' 2>'+shlex.quote(str(err))
def check():
    if out.stat().st_size+err.stat().st_size>2*M:return 'output guard'
    if sum(p.stat().st_size for p in O.glob('*.stdout'))+sum(p.stat().st_size for p in O.glob('*.stderr'))>M:return 'cumulative output guard'
    if os.statvfs(O).f_bavail*os.statvfs(O).f_frsize < 2982150144:return 'disk floor'
    return None
result=sup.supervise(['/bin/bash','-c',shell],rss_limit=(256 if kind=='git' else 768 if kind=='node' else 128)*M,cpu_limit=90,wall_limit=120,output_limit=2*M,check=check)
(O/(label+'.supervisor-output')).write_bytes(result.pop('output'))
result.update(command=cmd,stdout=str(out),stderr=str(err),inheritedLimits={str(k):resource.getrlimit(k) for k in (resource.RLIMIT_AS,resource.RLIMIT_DATA,resource.RLIMIT_FSIZE)},ssh=SSH if kind=='git' else None)
(O/(label+'.json')).write_text(json.dumps(result,indent=2))
print(json.dumps({k:result[k] for k in ('exit','stopReason','cleanupComplete','peakRSS','wallSeconds') if k in result}))
sys.exit(0 if result['exit']==0 and result['stopReason'] is None and result['cleanupComplete'] else 1)
