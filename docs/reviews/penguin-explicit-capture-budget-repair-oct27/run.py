import sys, os, json, hashlib, importlib.util, time, shutil
from pathlib import Path
ROOT=Path('/tmp/penguin-explicit-capture-budget-repair-oct27')
supervisor=Path('/tmp/gl-required-version-independent-integrate-oct26/repo/test/helpers/palette-browser-supervisor.py')
assert hashlib.sha256(supervisor.read_bytes()).hexdigest()=='9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85'
spec=importlib.util.spec_from_file_location('trusted',supervisor); mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
name, kind, *cmd=sys.argv[1:]; base=ROOT/'ops'/name
os.environ['GIT_SSH_COMMAND']='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
os.environ['PYTHONDONTWRITEBYTECODE']='1'
os.environ['PENGUIN_CONTRACT_RECEIPTS']=str(ROOT/'ops/evidence')
os.environ['GIT_CONFIG_NOSYSTEM']='1'
os.chdir(ROOT/'repo')
def check():
    if shutil.disk_usage(ROOT).free < 2982150144: return 'disk floor'
    sizes=[Path(str(base)+'.'+s).stat().st_size if Path(str(base)+'.'+s).exists() else 0 for s in ('stdout','stderr')]
    if sum(sizes)>2<<20:return 'output file cap'
    usage=sum(p.stat().st_blocks*512 for p in ROOT.rglob('*') if not p.is_symlink())
    if usage+(40<<20)>128<<20:return 'task allocation reserve'
    return None
assert not check(), check()
mem=int(next(s.split()[1] for s in Path('/proc/meminfo').read_text().splitlines() if s.startswith('MemAvailable:')))*1024
assert mem >= 805306368+(256<<20),mem
receipt=dict(command=cmd, commandSHA256=hashlib.sha256(json.dumps(cmd).encode()).hexdigest(), sshSHA256=hashlib.sha256(os.environ['GIT_SSH_COMMAND'].encode()).hexdigest(), supervisorSHA256=hashlib.sha256(supervisor.read_bytes()).hexdigest(), memAvailable=mem, free=shutil.disk_usage(ROOT).free, at=time.time(), kind=kind)
receipt['safeEnvironment']={k:os.environ.get(k) for k in ('PATH','LANG','LC_ALL','TZ','PYTHONDONTWRITEBYTECODE','PENGUIN_CONTRACT_RECEIPTS','GIT_CONFIG_NOSYSTEM')}
receipt['safeEnvironmentSHA256']=hashlib.sha256(json.dumps(receipt['safeEnvironment'],sort_keys=True).encode()).hexdigest()
receipt['pythonExecutableSHA256']=hashlib.sha256(Path(sys.executable).read_bytes()).hexdigest()
receipt['wrapperSHA256']=hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
receipt['childWrapperSHA256']=hashlib.sha256((ROOT/'ops/child.py').read_bytes()).hexdigest()
try:
    result=mod.supervise([sys.executable,str(ROOT/'ops/child.py'),str(base),kind,*cmd],rss_limit=(256 if kind=='git' else 128)<<20,cpu_limit=90,wall_limit=120,output_limit=2<<20,check=check)
    result['output']=result['output'].decode(errors='replace');receipt.update(result)
finally:
    base.with_suffix('.json').write_text(json.dumps(receipt,indent=2))
print(json.dumps({k:receipt.get(k) for k in ('exit','stopReason','peakRSS','cleanupComplete')}))
for stream in ('stdout','stderr'):
    p=Path(str(base)+'.'+stream)
    if p.exists(): print(stream+': '+p.read_text(errors='replace')[:3500])
sys.exit(0 if receipt.get('exit')==0 and not receipt.get('stopReason') and receipt.get('cleanupComplete') else 1)
