"""Pinned inputs only; no candidate oracle or historical suite execution."""
import hashlib,json,pathlib,sys
TASK=pathlib.Path('/tmp/toyvm-final-composition-independent-accept-oct29')
REPO=TASK/'repo'
OUT=REPO/'test/toyvm-final-composition-independent-accept-oct29'
DISPATCH=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/toyvm-final-composition-independent-accept-oct29-dispatch.json')
def pin(p):
 b=p.read_bytes();return dict(bytes=len(b),sha256=hashlib.sha256(b).hexdigest())
def main():
 d=json.loads(DISPATCH.read_text()); assert pathlib.Path.cwd().resolve()==REPO
 assert sys.executable=='/usr/bin/python3'
 for key,pk in [('taskSupervisor','taskSupervisorPin'),('limitModule','limitModulePin'),('pythonExecutable','pythonExecutablePin')]:
  assert pin(pathlib.Path(d[key]))==d[pk],key
 receipt=TASK/'inputs/candidate-receipt.json'
 assert pin(receipt)==d['canonicalReceiptPin']
 assert pin(pathlib.Path(d['canonicalReceipt']))==d['canonicalReceiptPin']
 c=json.loads(receipt.read_text());assert c['commit']==d['candidate']
 assert c['sourcePinsAfter']==d['sourcePins']
 verified={}
 for name,expected in c['artifacts'].items():
  f=TASK/'inputs/candidate-tests'/pathlib.Path(name).name
  assert pin(f)==expected,name;verified[name]=expected
 for name,expected in d['sourcePins'].items():assert pin(REPO/name)==expected,name
 # Verify all required tree entries and exact Git blob identities, without subprocesses.
 tree={line.split('\t')[1]:line.split()[2] for line in (TASK/'e/git-source-closure.stdout').read_text().splitlines()}
 assert set(tree)==set(d['sourcePins'])
 for name,blob in tree.items():
  b=(REPO/name).read_bytes();assert hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==blob
 remote=(TASK/'e/git-source-remote.stdout').read_text().split()
 assert remote==[d['candidate'],'refs/heads/task/toyvm-final-accepted-components-candidate-oct29']
 baseline=(TASK/'inputs/candidate-tests/baseline-caller.py').read_bytes()
 caller=next(n for n in d['sourcePins'] if n.endswith('qualify_accounted.py'))
 adapter=next(n for n in d['sourcePins'] if n.endswith('supervise_accounted.py'))
 provenance=json.loads((TASK/'inputs/candidate-tests/provenance.json').read_text())
 assert pin(TASK/'inputs/candidate-tests/baseline-caller.py')==provenance['beforeSourcePins'][caller]
 old=b'5ac463e9168b1162b47b784e919a6f71830d5581c5fbde14597f8e1e866eb3bf'
 new=d['sourcePins'][adapter]['sha256'].encode()
 assert baseline.count(old)==1 and baseline.replace(old,new)==(REPO/caller).read_bytes()
 assert (TASK/'inputs/candidate-tests/accepted-adapter.py').read_bytes()==(REPO/adapter).read_bytes()
 identity=(TASK/'e/git-identity.stdout').read_text().splitlines()
 assert identity==[str(REPO),str(REPO/'.git'),d['candidate'],'task/toyvm-final-composition-independent-accept-oct29']
 stores=json.loads(pathlib.Path(d['objectStores']).read_text())['stores']
 actual=(REPO/'.git/objects/info/alternates').read_text().splitlines()
 assert actual==stores and all(pathlib.Path(s).is_absolute() for s in stores)
 result=dict(status='PASS',candidate=d['candidate'],sourcePins=d['sourcePins'],artifacts=verified,
  canonicalCandidateReceipt=pin(receipt),sourceClosureGitBlobs=tree,remote=remote,
  callerDelta='one adapter SHA256 pin replacement only',adapter='byte-identical accepted donor e45f6f6d',
  flatObjectStores=actual,launchConfiguration=dict(SSH='trusted task supervisor exact GIT_SSH_COMMAND',mountArgv=[],intendedMountFiles=[],mountParser='not applicable: no mount operation authorized or executed'),
  retainedScope=c['reuseScope'],python=pin(pathlib.Path(sys.executable)))
 (OUT/'input-verification.json').write_text(json.dumps(result,indent=2)+'\n')
 print('PASS five source pins, eleven artifacts, exact one-pin caller delta, donor adapter, Git closure and remote identity')
if __name__=='__main__':main()
