import pathlib,json,hashlib,time
H=pathlib.Path(__file__).parent;R=H.parent/'repo';E=R/'docs/reviews/penguin-retained-raw-publication-oct27'
def ident(p):
 h=hashlib.sha256();n=0
 with p.open('rb') as f:
  for b in iter(lambda:f.read(65536),b''):h.update(b);n+=len(b)
 return dict(bytes=n,sha256=h.hexdigest())
def write(p,j):p.write_text(json.dumps(j,indent=2)+'\n')
ref='refs/heads/task/penguin-retained-raw-publication-oct27'
commit=(R/'.git'/ref).read_text().strip()
assert (H/'verify-remote.stdout').read_text().strip()==commit+'\t'+ref
assert not (H/'clean-report.stdout').read_bytes()
for label in ('package-preservation','seal-report','init-report','stage-report','review-staged','commit-report','push-report','verify-remote','clean-report'):
 q=json.loads((H/(label+'.json')).read_text());assert q['exit']==0 and q['stopReason'] is None and q['cleanupComplete']
publication=dict(status='EXACT_REMOTE_REF_VERIFIED_ARTIFACT_PRESERVATION_ONLY',artifactCommit=commit,ref=ref,remote='git@github.com:vgrichina/wine-assembly.git',serverRedirect='git@github.com:vgrichina/berrry-wine.git (reported by server, trusted configuration unchanged)',remoteVerified=True,mainTouched=False,reportOnlyOrphan=True,neverMergeOrphanTree=True,publicDeployment=False,completedAt=time.time(),pushReceipt='publication-preflight/push-report.json',exactRemoteReceipt='publication-preflight/verify-remote.json',cleanup='publication-preflight/owned-cleanup.json',finalReceipt=str(H/'result.json'),note='A follow-up receipt commit preserves this verified artifact-publication checkpoint; final tip identity is independently verified and recorded in finalReceipt.')
write(E/'publication.json',publication)
m=json.loads((E/'manifest.json').read_text())
for label in ('package-preservation','seal-report','init-report','stage-report','review-staged','commit-report','push-report','verify-remote','clean-report'):
 for suffix in ('.json','.stdout','.stderr','.supervisor-output'):
  n=label+suffix;p=E/'publication-preflight'/n;p.write_bytes((H/n).read_bytes());m['files'][str(p.relative_to(E))]=ident(p)
p=E/'publication-preflight/record-publication.py';p.write_bytes(pathlib.Path(__file__).read_bytes());m['files'][str(p.relative_to(E))]=ident(p)
receipt=json.loads((E/'receipt.json').read_text());receipt['publication']['artifactCommit']=commit;receipt['publication']['remoteBackup']=True;receipt['publication']['exactRemoteVerification']='publication.json';receipt['cleanup']['ownedBoardWatcher']='publication-preflight/owned-cleanup.json: exact watcher identity terminated and proc absent'
write(E/'receipt.json',receipt)
for n in ('receipt.json','publication.json'):m['files'][n]=ident(E/n)
m['publication']='publication.json';m['cleanup']='publication-preflight/owned-cleanup.json'
write(E/'manifest.json',m)
# Only modified receipt payloads require hashing again; unchanged archive evidence is reused.
write(H/'publication-checkpoint.json',dict(status='PASS_PUBLICATION_RECEIPT_HASHES_ONLY',artifactCommit=commit,ref=ref,remoteVerified=True,manifest=ident(E/'manifest.json'),archiveHashReused=json.loads((H/'archive-integrity.json').read_text())['archive'],noCaptureOrRuntimeAcceptance=True))
print('Verified artifact commit',commit,'and sealed publication/cleanup receipts for durable follow-up commit.')
