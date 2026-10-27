import pathlib, subprocess, hashlib, json, os, time
H=pathlib.Path(__file__).parent; R=H.parent/'repo'
D=pathlib.Path('/tmp/penguin-stream-open-causal-repair-oct27/repo')
C='584f66ff25908a247464f92d3c500a91a6f4a5b4'
pins={'tools/penguin_capture_contract.py':'9ec154496d10053252701d786f26e821fc226db3bdcb0e948f45e68ab0045cb0','test/test_penguin_capture_contract.py':'ae9827feb0a5da2a8657b14fa0d2b1c9300aebf6340f504f5c9e23b692b032f5'}
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
assert os.environ['GIT_SSH_COMMAND']==SSH
def git(*args):
 return subprocess.check_output(['prlimit','--data=536870912','--','git',*args])
assert git('-C',str(D),'rev-parse','HEAD').decode().strip()==C
for p,h in pins.items(): assert hashlib.sha256(git('-C',str(D),'show',C+':'+p)).hexdigest()==h
git('init',str(R)); (R/'.git/objects/info/alternates').write_text(str(D/'.git/objects')+'\n')
git('-C',str(R),'config','core.sparseCheckout','true')
(R/'.git/info/sparse-checkout').write_text('/tools/penguin_capture_contract.py\n/test/test_penguin_capture_contract.py\n')
git('-C',str(R),'checkout','-b','task/penguin-causal-independent-accept-cleanup-oct27',C)
url=git('-C',str(D),'remote','get-url','origin').decode().strip()
assert url=='git@github.com:vgrichina/wine-assembly.git',url
git('-C',str(R),'remote','add','origin',url)
for p,h in pins.items(): assert hashlib.sha256((R/p).read_bytes()).hexdigest()==h
remote=git('-C',str(R),'ls-remote','--exit-code','origin','refs/heads/task/penguin-stream-open-causal-repair-oct27').decode().strip()
assert remote==C+'\trefs/heads/task/penguin-stream-open-causal-repair-oct27'
(H/'pins.json').write_text(json.dumps(dict(candidate=C,pins=pins,remote=remote,donor=str(D),alternates='read-only; no repack/full checkout',transform='none; exact Git blobs',SSH=SSH,mount='N/A: offline Python subprocesses; no mount argv or Node',at=time.time()),indent=2)+'\n')
print('Pinned sparse checkout and exact source remote verified')
