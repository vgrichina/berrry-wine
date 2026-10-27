import os,sys,pathlib,json,hashlib,importlib.util,resource,subprocess,time,fcntl,traceback
O=pathlib.Path('/tmp/ricochet-final-reopen-version-repair-oct27/ops');os.environ['RICOCHET_ACCEPT_OPS']=str(O);os.environ['TMPDIR']=str(O/'fixtures');os.environ['PYTHONDONTWRITEBYTECODE']='1';os.environ['GIT_SSH_COMMAND']='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
S=pathlib.Path('/tmp/gl-required-version-independent-integrate-oct26/repo/test/helpers/palette-browser-supervisor.py');assert hashlib.sha256(S.read_bytes()).hexdigest()=='9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85'
if sys.argv[1]=='inner':
 p=pathlib.Path(sys.argv[2]);cmd=sys.argv[4:];git=sys.argv[3]=='git'
 safeenv={k:os.environ[k] for k in ['RICOCHET_ACCEPT_OPS','TMPDIR','GIT_SSH_COMMAND','PYTHONDONTWRITEBYTECODE']}
 exe=pathlib.Path(__import__('shutil').which(cmd[0])).resolve()
 receipt={'argv':cmd,'argvSHA256':hashlib.sha256(json.dumps(cmd).encode()).hexdigest(),'cwd':os.getcwd(),'environment':safeenv,'environmentSHA256':hashlib.sha256(json.dumps(safeenv,sort_keys=True).encode()).hexdigest(),'executable':str(exe),'executableSHA256':hashlib.sha256(exe.read_bytes()).hexdigest(),'inheritedLimits':{str(k):resource.getrlimit(k) for k in [resource.RLIMIT_DATA,resource.RLIMIT_AS,resource.RLIMIT_CPU,resource.RLIMIT_FSIZE]},'sourcePins':{str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in [S,pathlib.Path(__file__)]}}
 p.with_suffix('.command.json').write_text(json.dumps(receipt,indent=2))
 def limits():
  if git:resource.setrlimit(resource.RLIMIT_DATA,(536870912,536870912))
  p.with_suffix('.child-limits.json').write_text(json.dumps({str(k):resource.getrlimit(k) for k in [resource.RLIMIT_DATA,resource.RLIMIT_AS,resource.RLIMIT_CPU,resource.RLIMIT_FSIZE]}))
 with p.with_suffix('.stdout').open('wb') as out,p.with_suffix('.stderr').open('wb') as err:
  try:r=subprocess.run(cmd,stdout=out,stderr=err,preexec_fn=limits);code=r.returncode
  except BaseException:traceback.print_exc(file=err);code=125
 for suffix in ['.stdout','.stderr']:
  if p.with_suffix(suffix).stat().st_size>2097152:raise SystemExit('output ceiling')
 sys.exit(code)
git=sys.argv[1]=='git';label=sys.argv[2];cmd=sys.argv[3:];p=O/label
s=importlib.util.spec_from_file_location('trusted',S);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
lock=open('/tmp/wine-ops-production-git.lock','a') if git else None
if lock:fcntl.flock(lock,fcntl.LOCK_EX)
r=m.supervise([sys.executable,'-B','-S',__file__,'inner',str(p),'git' if git else 'python',*cmd],rss_limit=(256 if git else 128)*1048576,cpu_limit=90,wall_limit=120,output_limit=2097152,check=lambda:'captured output ceiling' if sum(f.stat().st_size for f in [p.with_suffix('.stdout'),p.with_suffix('.stderr')] if f.exists())>2097152 else None)
r['output']=r['output'].decode(errors='replace');p.with_suffix('.result.json').write_text(json.dumps(r,indent=2));print(json.dumps({'label':label,**r})[:3000]);sys.exit(r['exit'] if r['exit'] else (1 if r['stopReason'] or not r['cleanupComplete'] else 0))
