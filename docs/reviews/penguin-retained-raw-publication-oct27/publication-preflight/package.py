import pathlib,json,hashlib,tarfile,shutil,os,resource,time
H=pathlib.Path(__file__).parent; D=pathlib.Path('/tmp/penguin-retained-frame-recovery-oct27/ops')
E=H.parent/'repo/docs/reviews/penguin-retained-raw-publication-oct27'
PIN='efcf3c5656a40800a4add90f1882d24830b8cb142626161dd3535d0027491c0b'
HELPER=pathlib.Path('/tmp/penguin-accepted-explicit-budget-main-integrate-oct27/repo/tools/penguin_capture_contract.py')
def digest(f):
 h=hashlib.sha256();n=0
 for b in iter(lambda:f.read(65536),b''):h.update(b);n+=len(b)
 return dict(bytes=n,sha256=h.hexdigest())
def ident(p):
 with p.open('rb') as f:return digest(f)
def write(p,j):p.write_text(json.dumps(j,indent=2)+'\n')
def copy(src,dst):
 assert src.is_file() and not src.is_symlink()
 dst.parent.mkdir(parents=True,exist_ok=True)
 with src.open('rb') as i,dst.open('wb') as o:shutil.copyfileobj(i,o,65536)
 assert ident(src)==ident(dst)
assert ident(HELPER)['sha256']==PIN
E.mkdir(parents=True,exist_ok=True)
source=json.loads((D/'result.json').read_text())
assert source['status']=='BLOCKED_CPU_THEN_PUBLICATION_PEER_RSS_STOP'
assert source['firstRejection']['cpuSeconds']>90 and source['publicationRejection']['peerRSS']==341233664
raw={str(p.relative_to(D)):ident(p) for p in sorted((D/'api').iterdir()) if p.is_file()}
assert all(v['bytes']<=8192 for v in raw.values())
assert sum(v['bytes'] for v in raw.values())==4673088
rows=[json.loads(x) for x in (D/'capture-map.jsonl').read_text().splitlines()]
assert [r['record'] for r in rows]==list(range(756))
for r in rows:assert raw['api/'+str(r['apiIndex'])+'.raw']==dict(bytes=r['rawBytes'],sha256=r['rawSHA256'])
assert json.loads((D/'capture-cursor.json').read_text())==dict(next=756,total=756,complete=True)
write(E/'api-manifest.json',raw)
def verify_archive(p):
 seen=set()
 with tarfile.open(p,'r|gz') as t:
  for m in t:
   assert m.isfile() and m.name in raw and m.name not in seen
   with t.extractfile(m) as f:assert digest(f)==raw[m.name]
   seen.add(m.name)
 assert seen==set(raw)
 return len(seen)
candidate=D.parent/'repo/docs/reviews/penguin-retained-frame-recovery-oct27/all-original-and-recovered-api.tar.gz'
archive=E/'all-original-and-recovered-api.tar.gz'
reuse=dict(candidate=str(candidate),exists=candidate.exists(),accepted=False)
if candidate.exists():
 try:
  reuse['verifiedMembers']=verify_archive(candidate);reuse['identity']=ident(candidate);reuse['accepted']=True
 except Exception as e:reuse['rejection']=repr(e)
if reuse['accepted']:copy(candidate,archive)
else:
 with tarfile.open(archive,'w:gz') as t:
  for n in raw:t.add(D/n,arcname=n,recursive=False)
verified=verify_archive(archive)
write(H/'archive-integrity.json',dict(status='PASS_ARTIFACT_HASHES_ONLY',members=verified,rawBytes=4673088,archive=ident(archive),reuse=reuse,maxHashChunk=65536,extractedToFilesystem=False,pngDecode=False))
for p in sorted((D/'prior-published-report').rglob('*')):
 if p.is_file():copy(p,E/'prior-published-report'/p.relative_to(D/'prior-published-report'))
prior=json.loads((D/'prior-report-copy-manifest.json').read_text())
for row in prior['files']:
 assert ident(E/row['archivePath'])==dict(bytes=row['bytes'],sha256=row['sha256'])
for p in sorted(D.iterdir()):
 if p.is_file():copy(p,E/'operations'/p.name)
config=dict(ssh='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes',helper=ident(HELPER),reusedConfiguration=ident(D/'configuration-checkpoint.json'),rootRefDigest=json.loads(pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/penguin-retained-raw-publication-oct27/root-ref-digest.json').read_text()),mountValidation='No checkout or runtime/mount invocation. Unchanged original canonical filename-bearing tree enumeration receipt preserved under prior-published-report/runtime/startup-mount-receipt.json; no runtime acceptance repeated.',inheritedChildLimits={str(k):resource.getrlimit(k) for k in (resource.RLIMIT_DATA,resource.RLIMIT_AS,resource.RLIMIT_CPU,resource.RLIMIT_FSIZE)},packager=ident(pathlib.Path(__file__)),supervisor=ident(pathlib.Path('/tmp/gl-required-version-independent-integrate-oct26/repo/test/helpers/palette-browser-supervisor.py')))
write(H/'configuration.json',config)
for n in ('admission.json','configuration.json','archive-integrity.json','run.py','package.py','wal-baseline.json'):
 copy(H/n,E/'publication-preflight'/n)
receipt=dict(status='ARTIFACT_PRESERVATION_ONLY_NO_CAPTURE_OR_RUNTIME_ACCEPTANCE',task='penguin-retained-raw-publication-oct27',sourceCommit='a1240d3e0ed3ceb22a8ebce58113939459effb0a',sourceReceipt='operations/result.json',sourceReceiptIdentity=ident(D/'result.json'),helperSHA256=PIN,capture=source['capture'],firstRejection=source['firstRejection'],priorPublicationRejection=source['publicationRejection'],incidents=source['incidents']+['This publication worker initial policy displays exceeded8192B; later root config/mount combined display also exceeded8192B. Full original session retained; no retrospective compliance claim.'],remainingGates=source['remainingGate'],originalMappings=['operations/original-copy-manifest.json','operations/prior-report-copy-manifest.json'],rawMapping='operations/capture-map.jsonl',history='operations/api-history.jsonl',cursor='operations/capture-cursor.json',rawManifest='api-manifest.json',rawArchive='all-original-and-recovered-api.tar.gz',archiveIntegrity=json.loads((H/'archive-integrity.json').read_text()),noRuntimeOrAcceptanceExecuted=True,noSourceRepair=True,noCollectionRetry=True,publication=dict(ref='refs/heads/task/penguin-retained-raw-publication-oct27',reportOnlyOrphan=True,neverMergeOrphanTree=True,mainTouched=False,publicDeployment=False,finalCanonicalReceipt=str(H/'result.json'),remoteBackup='Pending exact remote-ref verification, recorded in finalCanonicalReceipt'),cleanup=dict(original=source['cleanup'],boxState='Historical last-observed RUNNING only; no current-state assertion or lifecycle operation',lifecycleOwner='coordinator',expiry='2026-10-27T11:14:33.925Z',ownedBoardWatcher='Cleaned at final publication closeout; see finalCanonicalReceipt'))
write(E/'receipt.json',receipt)
(E/'README.md').write_text('Penguin raw transport preservation only\n\nAll 756 raw records are retained. Recovery fetched only records 379..755. Original API accounting is 4,673,088 / 8,388,608 bytes, including 2,481,875 prior bytes and a 1 MiB terminal reserve. This publication does not reset or retry the exhausted collection allowance.\n\nCollection child exit 0 did not satisfy acceptance: the trusted supervisor rejected aggregate CPU 92.073705 > 90 seconds. A later publication attempt was rejected at peer RSS 341233664 > 335544320 bytes. The empty Git initialization sequencing incident and failed setup diagnostics remain in operations/. Preserve these causal failures.\n\nThe archive preserves original api/<index>.raw and api/<index>.err bytes. Only bounded archive roundtrip and hash integrity were checked. No ProviderCapture.finish, frame restoration, PNG decoding, image inspection, guest execution, tests, or acceptance processing occurred in this publication task.\n\nProduction finish, roundtrip, all four complete-frame hashes, visual projectile, current-main qualification, and ordinary Quit remain OPEN. Historical prior reports retain their original qualified scope. No capture/runtime acceptance is claimed.\n\nCanonical receipt: manifest.json binds every payload and receipt.json; the final external ops/result.json binds that manifest to the exact verified publication commit and cleanup. Report-only orphan branch: NEVER merge the whole tree or main. Boat bx_5pu4jynk lifecycle belongs exclusively to coordinator; last-observed RUNNING is historical, not a claim that shutdown occurred.\n')
payloads={str(p.relative_to(E)):ident(p) for p in sorted(E.rglob('*')) if p.is_file()}
write(E/'manifest.json',dict(status='ARTIFACT_PRESERVATION_ONLY',helperSHA256=PIN,files=payloads,publicationAndCleanup=str(H/'result.json')))
for n,v in payloads.items():assert ident(E/n)==v
write(H/'report-integrity.json',dict(status='PASS_HASH_ARCHIVE_ONLY_NOT_ACCEPTANCE',payloadCount=len(payloads),rawStreams=len(raw),records=756,sourceReceipt=ident(D/'result.json'),manifest=ident(E/'manifest.json'),report=str(E),completed=time.time()))
print('Artifact preservation integrity PASS:',len(raw),'raw streams,756 mapped records;',len(payloads),'report payloads; no acceptance claim')
