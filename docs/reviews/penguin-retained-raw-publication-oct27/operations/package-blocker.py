from common import *
import tarfile
E=H.parent/'repo/docs/reviews/penguin-retained-frame-recovery-oct27';E.mkdir(parents=True,exist_ok=True)
q=json.loads((H/'collect-remaining-1.json').read_text());assert q['stopReason']=='aggregate CPU limit' and q['cleanupComplete']
entries=[json.loads(x) for x in (H/'capture-map.jsonl').read_text().splitlines()]
assert [x['record'] for x in entries]==list(range(756))
assert json.loads((H/'capture-cursor.json').read_text())==dict(next=756,total=756,complete=True)
for row in entries:
 raw=(H/'api'/(str(row['apiIndex'])+'.raw')).read_bytes();assert len(raw)==row['rawBytes'] and sha(raw)==row['rawSHA256'] and len(raw)<=8192
assert used()==4673088 and used()+M<8*M
manifest={str(p.relative_to(H)):dict(bytes=p.stat().st_size,sha256=sha(p.read_bytes())) for p in sorted((H/'api').iterdir()) if p.is_file()}
assert all(v['bytes']<=8192 for v in manifest.values())
(E/'api-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
with tarfile.open(E/'all-original-and-recovered-api.tar.gz','w:gz') as t:
 for n in manifest:t.add(H/n,arcname=n,recursive=False)
with tarfile.open(E/'all-original-and-recovered-api.tar.gz','r:gz') as t:
 for n,v in manifest.items():assert sha(t.extractfile(n).read())==v['sha256']
shutil.copytree(H/'prior-published-report',E/'prior-published-report')
O=E/'operations';O.mkdir()
for p in H.iterdir():
 if p.is_file():shutil.copy2(p,O/p.name)
prior=json.loads((H/'prior-receipt.json').read_text())
receipt=dict(status='BLOCKED_CPU_GUARD_ALL_RAW_RECORDS_RETAINED_NO_RESTORE_OR_VISUAL',task='penguin-retained-frame-recovery-oct27',historical=True,donorCommit='a1240d3e0ed3ceb22a8ebce58113939459effb0a',priorReceipt='prior-published-report/receipt.json',helperSHA256=sha(HELPER.read_bytes()),recovery=dict(initialCursor=379,next=756,total=756,newRecords=377,noPassedRecordsRefetched=True,rawUsedBefore=2481875,rawUsedAfter=used(),budget=8*M,terminalReserve=M,remaining=8*M-used(),fullResponsesMax8192=True,rawArchive='all-original-and-recovered-api.tar.gz',apiManifest='api-manifest.json',recordHashesVerified=True),blocker=dict(reason=q['stopReason'],cpuSeconds=q['cpuSeconds'],limitSeconds=90,wallSeconds=q['wallSeconds'],peakRSS=q['peakRSS'],childExit=q['exit'],cleanupComplete=q['cleanupComplete'],exactDiagnostics='operations/collect-remaining-1.json',stopPermanent=True,noRetry=True),visual=dict(inspected=False,projectileAccepted=False,reason='Trusted aggregate CPU guard rejected collection; stopped without production ProviderCapture.finish/roundtrip or decoding/viewing PNGs'),frames=prior['frames'],input=prior['inputReceipt'],scope=prior['scope'],remainingGate='Production ProviderCapture.finish plus byte-exact roundtrip and all four complete-frame hashes remain required before view_image inspection. No visual projectile/current-main/ordinary-Quit claim.',cleanup=dict(collectorOwnedCleanupComplete=q['cleanupComplete'],guest='Original natural exit43000 batches; no new guest launch/input/replay/build',box='bx_5pu4jynk',lastState='RUNNING_API_EXEC_OBSERVED at final retained record',leftRunning=True,expiry='2026-10-27T11:14:33.925Z',shutdown='2026-10-27T11:07:00Z',owner='coordinator',lifecycleMutated=False,finalStatus=str(H/'owned-cleanup.json')),publication=dict(branch='refs/heads/task/penguin-retained-frame-recovery-oct27',reportOnlyOrphan=True,noMain=True,noPublicDeployment=True,receipt=str(H/'publication.json')),incidents=['Initial combined read-only displays exceeded8192B; later whole collector receipt display also exceeded8192B. Original tool session retained, no retrospective compliance claim.','Collector exited0 after all records retained, but unchanged trusted supervisor aggregateCPU92.073705 exceeded90; wrapper assertion failed. Rejection retained; no decoder/restore/visual execution or retry.','package.py was drafted before CPU rejection, never executed; package-blocker.py is the actual packaging recipe.'],rootRefs='Initial launcher digest reused; root/donors tracked/index/refs READONLY; no full refs listing captured')
(E/'receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
(E/'README.md').write_text('Penguin retained frame recovery stopped at aggregate CPU guard\n\nAll756 raw records retained, cursor756, original API charge4673088/8388608bytes. Recovery fetched only379..755. CPU guard92.073705s/90s rejects the operation despite childexit0, wall67.983656s, cleanupComplete true. No further runtime, decode, restore or visual inspection.\n\nRaw archive preserves api/<index>.raw and api/<index>.err. Verify api-manifest.json. Original relative donor/archive mapping and every copied hash are in operations/original-copy-manifest.json and operations/prior-report-copy-manifest.json. Complete original report retained under prior-published-report. Do not refetch records. Production finish/roundtrip and complete-frame hash validation remain required before any visual inspection. Historical module only, no projectile/Quit/current-main claim. Report-only orphan; never merge whole tree.\n')
payloads={str(p.relative_to(E)):dict(bytes=p.stat().st_size,sha256=sha(p.read_bytes())) for p in E.rglob('*') if p.is_file()}
(E/'manifest.json').write_text(json.dumps(payloads,indent=2)+'\n')
for n,v in payloads.items():assert sha((E/n).read_bytes())==v['sha256']
save('report-integrity.json',dict(status='PASS_HASH_ARCHIVE_ONLY_NOT_CAPTURE_ACCEPTANCE',payloads=len(payloads),rawStreams=len(manifest),rawUsed=used(),report=str(E)))
print('blocker report integrity PASS',len(payloads),'payloads',len(manifest),'raw streams; CPU rejection preserved')
