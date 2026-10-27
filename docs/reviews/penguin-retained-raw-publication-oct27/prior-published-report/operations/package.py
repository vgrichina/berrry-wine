from common import *
import tarfile,io,struct
R=H.parent/'repo';E=R/'docs/reviews/penguin-published-projectile-gameplay-oct27'
E.mkdir(parents=True,exist_ok=True)
(R/'.git/info/sparse-checkout').write_text('/docs/reviews/penguin-published-projectile-gameplay-oct27/\n')
runtime=json.loads((H/'runtime/execution/receipt.json').read_text());visual=json.loads((H/'visual-inspection.json').read_text());transport=json.loads((H/'restore-receipt.json').read_text())
assert runtime['guest_starts']==1 and all(p['returncode']==0 and p['owned_group_absent'] for p in runtime['phases'])
assert len(transport['images'])==4 and transport['chargedOnce']<=8*M
assert visual['inspectedNames']==[x['name'] for x in transport['images']]
for info in transport['images']:
 p=H/'restored'/info['name'];b=p.read_bytes();assert sha(b)==info['sha256'] and len(b)==info['size'];assert struct.unpack('>II',b[16:24])==(840,660)
 shutil.copyfile(p,E/info['name'])
for dirname in ('runtime',):shutil.copytree(H/dirname,E/dirname,dirs_exist_ok=True)
evidence=E/'operations';evidence.mkdir(exist_ok=True)
for p in H.iterdir():
 if p.is_file() and (p.suffix in ('.py','.json','.jsonl','.stdout','.stderr') or p.name=='startup.js'):
  if p.name in ('package-receipt.json',):continue
  shutil.copyfile(p,evidence/p.name)
api_manifest={p.name:dict(bytes=p.stat().st_size,sha256=sha(p.read_bytes())) for p in sorted((H/'api').iterdir()) if p.is_file()}
save('api-manifest.json',api_manifest);(E/'api-manifest.json').write_text(json.dumps(api_manifest,indent=2)+'\n')
with tarfile.open(E/'original-api-responses.tar.gz','w:gz',compresslevel=6) as archive:
 for p in sorted((H/'api').iterdir()):archive.add(p,arcname=p.name,recursive=False)
source=json.loads((H/'input-identity.json').read_text());admission=json.loads((H/'accounting.json').read_text());config=json.loads((H/'runtime-config.json').read_text())
receipt=dict(status=visual['status'],task='penguin-published-projectile-gameplay-oct27',historical=True,scope='Original Penguin real ordinary A input. Historical runner/module only; no current-main emulator qualification; production capture helper integrated4a2bec145ef34b0d084b96b09a682a16e89703fd.',runtimeManifest=dict(path='/tmp/penguin-postloop-shot-acceptance-oct24/manifest.json',sha256='4141f5ff9e95ad35f8891394d79706a9a9a4792fe8dffce8f0f59bc4633ed5fd',files=291,bytes=15760340,localPins='operations/local-pins.json',remoteRehash='operations/remote-rehash.json'),runnerSHA256='3c59fd034391e069f24a6047cf96cd8dac84a791d7d7591d55e5f7cb6e161a5e',moduleSHA256='8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686',exeSHA256='14d6e430c26c44c94ef5c176eca2f66edd82dd66fd155d29a5596e3d6e170fc1',captureHelperSHA256=sha(HELPER.read_bytes()),startup='runtime/execution/receipt.json',mounts='runtime/startup-mount-receipt.json',dispatch=visual['inputReceipt'],visual=visual,transport=transport,resources=dict(local=admission,remote='operations/remote-admission.json',guestPeakRSS=runtime['phases'][1]['peak_rss'],guestProcessGroupPhysicalCeiling=2*1024*M,nodeHeap=512*M,git='Git child only DATA512MiB physical256MiB two permits+flock; parent/Node DATA AS unchanged',python='128MiB physical, CPU90 wall120 FSIZE24MiB output2MiB display8192B cumulative ordinary output1MiB; capture raw separate explicit8MiB'),tests='Reused unchanged accepted16 targeted+10 independent; no suite rerun. Fresh exact Node startup, canonical filename tree enumeration,291 remote hashes,one real guest,actual provider lossless roundtrip and full840x660 frame inspection.',cleanup=dict(guestGroupsAbsent=True,startupGroupAbsent=True,ordinaryQuit=False,guestExit='Natural runner max-batches43000 exit0; not ordinary game Quit',localWatcher='active through publication; final owned cleanup at ops/owned-cleanup.json'),box=dict(id=BOX,stateAtLaunch='RUNNING',stateAtHandback='pending final read-only state check',expiry='2026-10-27T11:14:33.925Z',shutdown='2026-10-27T11:07:00Z',owner='coordinator',leaveRunning=True),publication=dict(branch='refs/heads/task/penguin-published-projectile-gameplay-oct27',receipt=str(H/'publication.json'),exactRemoteVerification=str(H/'remote-verify.stdout'),reportOnlyOrphan=True,noMain=True),incidents=['Initial read-only displays exceeded8192B; original session retained without retrospective compliance.','Owned API sandbox literal accidentally included capacity digit suffix8;404 metadata failure retained api/0 raw+err and remote-initial stderr. Corrected using authoritative task runtime/live/shutdown receipts bx_5pu4jynk before any staging/guest; no unchanged denied retry.','Read-only donor alternate-depth warnings retained in read-input.stderr; exact150source and141file inputs independently hashverified, zero fetch/repack/donor writes.','Local operation label actual-capture-plan collided with child metadata filename; original operation receipt retained capture-plan-operation-receipt.json, collect-1 failed before API calls. Original immutable remote plan recovered, no recomputation, ledger reset, or guest replay.'],rootRefs='Initial launcher digest reused; root tracked/index/refs read-only, no full listing captured or later comparison claimed',at=time.time())
(E/'receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
manifest={str(p.relative_to(E)):dict(bytes=p.stat().st_size,sha256=sha(p.read_bytes())) for p in E.rglob('*') if p.is_file() and p.name!='manifest.json'}
(E/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
save('package-receipt.json',dict(files=len(manifest),bytes=sum(x['bytes'] for x in manifest.values()),manifestSHA256=sha((E/'manifest.json').read_bytes()),report=str(E)))
print(json.dumps(dict(status=visual['status'],files=len(manifest),bytes=sum(x['bytes'] for x in manifest.values()))))
