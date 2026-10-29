import pathlib,json,hashlib,base64,shlex,sys,os
R=pathlib.Path(__file__).parent; P=R/'repo'; E=R/'e'
D=json.loads(pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/toyvm-rename-nonempty-runtime-oct29-dispatch.json').read_text())
events=[json.loads(x) for x in (E/'boat-create.stdout').read_text().splitlines()]
ready=next(x for x in events if x.get('event')=='ready');box=ready['id']
(R/'lifecycle.json').write_text(json.dumps(dict(box=box,expiry=ready['archiveAfter'],cutoff=D['box']['cutoffUTC'],shutdownOwner=D['box']['shutdownOwner'],state='ready')))
files={}
def add(remote,local,pin=None):
 b=pathlib.Path(local).read_bytes()
 if pin: assert len(b)==pin['bytes'] and hashlib.sha256(b).hexdigest()==pin['sha256']
 files[remote]=base64.b64encode(b).decode()
for k,v in D['sourcePins'].items():add('repo/'+k,P/k,v)
for k,n in [('runtimeFixture','fixture.py'),('runtimeObserver','observer.py'),('sourcePhaseOracle','oracle.json'),('originalCancellationReceipt','cancellation.json')]:add(n,D[k],D[k+'Pin'])
for k in ['taskSupervisor','validationScript','limitModule']:
 b=pathlib.Path(D[k]).read_bytes();assert len(b)==D[k+'Pin']['bytes'] and hashlib.sha256(b).hexdigest()==D[k+'Pin']['sha256']
add('dispatch.json','/home/user/wine-assembly/scratch/usage-watch/toyvm-rename-nonempty-runtime-oct29-dispatch.json')
manifest={k:dict(bytes=len(base64.b64decode(v)),sha256=hashlib.sha256(base64.b64decode(v)).hexdigest()) for k,v in files.items()}
(R/'stage-manifest.json').write_text(json.dumps(manifest,indent=2))
(R/'launch-configuration.json').write_text(json.dumps(dict(mountArgv=[],intendedGuestFiles=[],canonicalParser='No filename-bearing mount argv: direct Boat API staging, no guest runner mount parser invoked',stagedFiles=list(files),trustedGitSSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes',browserAllowanceUnspent=True)))
stage="import pathlib,base64,json,hashlib,os; r=pathlib.Path('/tmp/tvrn'); assert not r.exists(); r.mkdir(); files="+repr(files)+"\nfor n,v in files.items():\n p=r/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(base64.b64decode(v))\nprint(json.dumps({n:dict(bytes=(r/n).stat().st_size,sha256=hashlib.sha256((r/n).read_bytes()).hexdigest()) for n in files}))"
mode=sys.argv[1]
code=stage if mode=='stage' else "import os;os.chdir('/tmp/tvrn/repo');os.execv('/usr/bin/python3',['/usr/bin/python3','-B','/tmp/tvrn/observer.py'])"
if mode=='collect':code="import pathlib,json; r=pathlib.Path('/tmp/tvrn');print(json.dumps({n:(r/n).read_text() for n in ['result.json','prelaunch.json','cli.stdout','cli.stderr'] if (r/n).exists()}))"
argv=['/usr/bin/python3','-B',str(R/'ops.py'),'boat-'+mode,'/home/user/.ascii/boat','exec',box,'--cwd','/tmp' if mode=='stage' else '/tmp/tvrn/repo','--timeout','100','--json','--no-update','--',shlex.join(['/usr/bin/python3','-B','-c',code])]
os.execv('/usr/bin/python3',argv)
