from common import *
import tarfile
R=H.parent/'repo';E=R/'docs/reviews/penguin-retained-frame-recovery-oct27';E.mkdir(parents=True,exist_ok=True)
restore=json.loads((H/'restore-receipt.json').read_text());visual=json.loads((H/'visual.json').read_text());prior=json.loads((H/'prior-receipt.json').read_text())
assert restore['status']=='PASS_ACTUAL_PROVIDER_PRODUCTION_HELPER_ROUNDTRIP'
assert json.loads((H/'capture-cursor.json').read_text())['next']==756
assert used()<8*M-M
for info in restore['images']:
 p=H/'restored'/info['name'];assert len(p.read_bytes())==info['size'] and sha(p.read_bytes())==info['sha256']
rawManifest={str(p.relative_to(H)):dict(bytes=p.stat().st_size,sha256=sha(p.read_bytes())) for p in sorted((H/'api').iterdir()) if p.is_file()}
assert all(x['bytes']<=8192 for x in rawManifest.values())
(E/'api-manifest.json').write_text(json.dumps(rawManifest,indent=2)+'\n')
with tarfile.open(E/'all-original-and-recovered-api.tar.gz','w:gz') as t:
 for name in rawManifest:t.add(H/name,arcname=name,recursive=False)
shutil.copytree(H/'restored',E/'frames')
shutil.copytree(H/'prior-published-report',E/'prior-published-report')
ops=E/'operations';ops.mkdir()
for p in H.iterdir():
 if p.is_file() and p.name!='api-manifest.json':shutil.copy2(p,ops/p.name)
receipt=dict(status='RECOVERED_ALL_RETAINED_FRAMES_VISUALLY_REVIEWED',historical=True,task='penguin-retained-frame-recovery-oct27',donorCommit='a1240d3e0ed3ceb22a8ebce58113939459effb0a',priorReceipt='prior-published-report/receipt.json',captureHelperSHA256=sha(HELPER.read_bytes()),recovery=dict(start=379,end=756,recordsFetched=377,noRefetch=True,rawPriorUsed=2481875,rawFinalUsed=used(),budget=8*M,terminalReserve=M,remaining=8*M-used(),restore='operations/restore-receipt.json',rawArchive='all-original-and-recovered-api.tar.gz',rawManifest='api-manifest.json'),frames=restore['images'],visual=visual,input=prior['inputReceipt'],scope=prior['scope'],cleanup=dict(localSupervisedOperations='all completed operations require cleanupComplete true',guest='Original natural exit43000 batches; no new guest/input/build',box='bx_5pu4jynk',state='RUNNING_API_EXEC_OBSERVED',expiry='2026-10-27T11:14:33.925Z',shutdown='2026-10-27T11:07:00Z',owner='coordinator',lifecycleMutated=False),remainingGate=visual['remainingGate'],publication=dict(reportOnlyOrphan=True,noMain=True,noPublicDeployment=True,branch='refs/heads/task/penguin-retained-frame-recovery-oct27',receipt=str(H/'publication.json')),incidents=['Initial combined read-only displays exceeded8192B; original tool session retained. No subsequent recovery/setup failures before this packaging checkpoint.'],rootRefs='Initial launcher digest reused; no root/donor tracked/index/ref writes; no full show-ref capture')
(E/'receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
(E/'README.md').write_text('Retained Penguin frame recovery\n\n'+visual['conclusion']+'\n\nThis report preserves historical module qualification only. No guest launch, replay, input, build, source integration, main change or public deployment. Recover raw responses from all-original-and-recovered-api.tar.gz at api/<index>.raw and api/<index>.err; verify api-manifest.json. Original donor mapping and hashes: operations/original-copy-manifest.json and operations/prior-report-copy-manifest.json. Run the retained restore.py/common.py only after retargeting owned paths and verifying the exact production helper; ProviderCapture.finish and byte-exact roundtrip already passed. Do not refetch records0..755.\n\nRemaining gate: '+visual['remainingGate']+'\n')
manifest={str(p.relative_to(E)):dict(bytes=p.stat().st_size,sha256=sha(p.read_bytes())) for p in E.rglob('*') if p.is_file()}
(E/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
with tarfile.open(E/'all-original-and-recovered-api.tar.gz','r:gz') as t:
 for n,x in rawManifest.items():assert sha(t.extractfile(n).read())==x['sha256']
for n,x in manifest.items():assert sha((E/n).read_bytes())==x['sha256']
save('report-integrity.json',dict(status='PASS',files=len(manifest),rawStreams=len(rawManifest),rawUsed=used(),report=str(E)))
print('report integrity PASS',len(manifest),'payloads',len(rawManifest),'raw streams',used(),'API bytes')
