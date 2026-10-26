import pathlib,os,json,time,shutil,hashlib
P=pathlib.Path;M=1048576
H=P('/tmp/gl-required-file-version-inventory-repair-oct26');O=H/'ops';L=P('/home/user/wine-assembly/scratch/usage-watch/gl-required-file-version-inventory-repair-oct26');SESSION=P('/home/user/.codex/sessions/2026/10/26/rollout-2026-10-26T22-53-12-01a17a6a-f493-7de1-8e46-3072bd036c96.jsonl');W=P('/home/user/.codex/state_5.sqlite-wal')
def size(p):
 if not p.exists():return 0
 return sum(q.lstat().st_blocks*512 for q in [p,*p.rglob('*')] if not q.is_symlink()) if p.is_dir() else p.stat().st_blocks*512
def measure(label):
 b=O/'baseline.json'
 if not b.exists():b.write_text(json.dumps(dict(wal=W.stat().st_size)))
 clients=[]
 for p in P('/proc').glob('[0-9]*/cmdline'):
  try:
   a=p.read_bytes().split(b'\0');s=p.parent.joinpath('status').read_text()
   if a and b'/bin/codex' in a[0] :
    clients.append(dict(pid=int(p.parent.name),argv=[x.decode() for x in a if x],rss=int(s.split('VmRSS:')[1].split()[0])*1024))
  except (OSError,IndexError):pass
 own=size(H)+size(L)+size(SESSION)+max(0,W.stat().st_size-json.loads(b.read_text())['wal'])
 # 8MiB selective Git/source +8MiB evidence/publication +16MiB future +8MiB reserve.
 projected=own+40*M
 mem=int(P('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
 required=(768+256+64*len(clients))*M
 free=shutil.disk_usage(H).free;remaining=max(0,64*M-own)+4*64*M
 j=dict(at=time.time(),label=label,ownMeasured=own,projected=projected,allocation=64*M,future=16*M,reserve=8*M,selectiveGitSourceEvidencePublication=16*M,positiveWalGrowth=max(0,W.stat().st_size-json.loads(b.read_text())['wal']),session=str(SESSION),launcher=str(L),clients=clients,prospectiveClients=0,clientGrowth=64*M*len(clients),memAvailable=mem,required=required,free=free,remainingFleetGrowth=remaining,projectedFree=free-remaining,floor=2982150144,standing='readonly donor and installed tools excluded; no links',mountArgv=[],mountValidation='no guest invocation or mounts in this offline task; nothing to parse',ssh='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes')
 j['admitted']=projected<=64*M and mem>=required and j['projectedFree']>=j['floor']
 (O/'admission-latest.json').write_text(json.dumps(j,indent=2)+'\n')
 if not j['admitted']:raise RuntimeError('admission failed '+json.dumps({k:j[k] for k in ['ownMeasured','projected','memAvailable','required','projectedFree']}))
 return j
if __name__=='__main__':
 j=measure('fresh');(O/'admission-corrected-residents.json').write_text(json.dumps(j,indent=2)+'\n');print({k:j[k] for k in ['ownMeasured','projected','memAvailable','required','projectedFree','admitted']})
