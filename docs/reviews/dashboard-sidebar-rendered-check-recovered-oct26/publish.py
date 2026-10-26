from control import *
E=R/'docs/reviews'/P.name
accepted='7681b752d7c3fe565a49e92832c3d9825bec7ed9'
b=json.loads((P/'browser-result.json').read_text());assert b['pass']
assert json.loads((P/'real-browser.json').read_text())['aggregateMethod'].startswith('recursive PPID')
assert json.loads((P/'real-browser.json').read_text())['peakSampledProcessGroupRSS']<=1342177280
before=json.loads((P/'service-before.json').read_text());after=service();assert (before['pid'],before['startTicks'])==(after['pid'],after['startTicks'])
served,_=get('/app.js');assert served['sha256']==APP and served['cacheControl']=='no-store'
# Verify only task-owned browser identities; never touch another browser or watcher.
startup=json.loads((P/'browser-startup.json').read_text())
assert not pathlib.Path('/proc/'+str(startup['pid'])).exists(), 'own browser PID remains'
left=[]
for q in pathlib.Path('/proc').glob('[0-9]*'):
 try:
  a=(q/'cmdline').read_bytes().split(b'\0')
  if any(x.startswith(b'--user-data-dir='+str(P).encode()) for x in a):left.append(int(q.name))
 except OSError:pass
assert not left
save('service-final.json',after)
gate('before-publication')
# Do not publish private API hashes, screenshots, profiles, raw browser logs, or private receipts.
public={k:v for k,v in b.items() if k not in ['apiSHA256','clip','scope','screenshotRedaction']}
public['scope']='Actual private loopback rendered check; one fresh real API snapshot per attempt. Only sanitized aggregate counts and assertions exported. Periodic refresh disabled for bounded capture. No API data retained.'
public['screenshots']='Inspected locally: aggregate-only crops. Kept private with profiles; not in task commit.'
save('browser-sanitized.json',public)
source={k:v['sha256'] for k,v in json.loads((P/'served-before.json').read_text()).items()}
prior=json.loads((D.parent/'final-receipt.json').read_text())
save('verification.json',dict(passResult=True,actualBrowser=True,sourceCandidate=accepted,activationEvidence=BASE,sourceHashes=source,servedFinal=served,servicePID=after['pid'],serviceStartTicks=after['startTicks'],serviceIdentityUnchanged=True,serviceRSSBefore=before['rss'],serviceRSSAfter=after['rss'],observationSeconds=json.loads((P/'real-browser.json').read_text())['elapsed'],shortObservationOnly=True,longTermStabilityClaim=False,ownedBrowserProcessesRemaining=left,noSourceModification=True,noDeploy=True,noRestart=True,other1358FilesVerificationReusedFrom=BASE,priorManifestSHA256=prior['verification']['manifestSHA256'],rollbackUnchanged=dict(path=str(D.parent/'rollback.py'),sha256=sha(D.parent/'rollback.py'),backup=str(D.parent/'backups/app.js'),backupSHA256=sha(D.parent/'backups/app.js')),privateRetentionPaths=[str(P/'browser-profile'),str(P/'browser-profile-monitored'),str(P/'detail-counts-redacted.png'),str(P/'sidebar-count-redacted.png'),str(P/'first-browser-attempt')],privateContentCommitted=False,box=None,boxContacted=False,lifecycleOwner='coordinator'))
checkpoint=json.loads((P/'checkpoint.json').read_text());checkpoint.pop('browserResultSHA256',None);checkpoint['evidence']=['browser-sanitized.json','real-browser.json','served-before.json','verification.json'];checkpoint['remaining']=['task branch publication and exact remote verify'];save('checkpoint-sanitized.json',checkpoint)
E.mkdir(parents=True,exist_ok=False)
names=['browser-sanitized.json','verification.json','checkpoint-sanitized.json','incidents.json','real-browser.json','browser-startup.json','node-startup.json','launch-configuration.json','standing-inputs.json','served-before.json','resources-precheckout.json','resources-before-browser.json','resources-before-publication.json','loopback-listener.json']
for n in names:shutil.copyfile(P/n,E/n)
for n in ['control.py','browser.cjs','verify.py','publish.py']:shutil.copyfile(P/n,E/n)
(E/'README.md').write_text('''# Real private dashboard rendered sidebar verification

PASS on accepted source `7681b752d7c3fe565a49e92832c3d9825bec7ed9`, already activated by evidence commit `ed36948b6b395ef338d592289dbb0a2a232b0830`. No source edit, deploy, restart, main ownership, or main publication.

A fresh real private API snapshot rendered 77 distinct blocked task IDs from 91 blocked rows, including 14 duplicate-ID rows and zero anonymous rows. The sidebar displayed **77 distinct IDs**. The independently counted anonymous-row suffix rule and duplicate accounting matched. The detail summary preserved all four aggregate meanings, classifications preserved row semantics (89 classified roots plus two dependent rows), and overview retained its 91 blocked-row statistic. Actual Overview → Blockers navigation preserved the summary. HTML, API and loaded app returned HTTP 200 with `Cache-Control: no-store`; loaded app was not from browser cache and matched the exact accepted hash. No JavaScript page errors. This tests the actual anonymous-free snapshot; synthetic anonymous cases are covered only by reused accepted prior tests.

The initial real-browser assertions passed, but its process-group-only resource sampler omitted detached Chrome descendants. That receipt is explicitly incomplete and is retained privately. The corrected recursive-parent sampler monitored the repeated affected browser group: 1,272,545,280 bytes peak aggregate RSS within 1,342,177,280 reserved. Fresh prelaunch MemAvailable was 3,871,096,832 bytes against 3,422,552,064 required: one 268,435,456 client growth reserve, three 335,544,320 light-job allowances, full browser allowance and 805,306,368 physical floor. Existing fleet RSS is already included in MemAvailable. Browser execution lasted about six seconds under a 60-second bound. The sampler also enforced the remaining fleet reserve/floor during execution. This is a short observation, with no long-term memory/stability claim. `incidents.json` also retains the internal readers.js HTTP 404 path correction; readers.js is verified by its local deployed hash.

Installed Node 24 ran in place with explicit `--max-old-space-size=192` and matching NODE_OPTIONS; exact inherited limits and startup receipt are included. Git DATA 512 MiB applies only to child Git; Node DATA/AS remain unlimited. CPU 90 seconds, per-file 24 MiB and capture 2 MiB bounds apply. Empty mount argv was checked with the canonical parser. Disk accounting includes checkout/Git/copies/temp/evidence/session/launcher growth, positive WAL growth once, future growth and the 8 MiB reserve within 64 MiB, with host remaining space above 2,982,150,144 bytes. Existing tools and read-only donors are separately identified standing inputs.

The real API was held only in browser memory. Public evidence contains sanitized aggregates, assertions, code identities and operational receipts. No private API hash, task IDs, inbox, raw browser log, screenshot or browser profile is committed. Aggregate screenshot crops were visually inspected and remain private at the paths in verification.json, alongside both small private profiles and first-attempt receipts. No profile/browser processes remain running. Existing service PID 2896015/start identity 108624751 remained unchanged; RSS samples in verification.json are short observations only. Reused the prior verification of all 1,358 other deployed files, accepted independent/merged/source test groups and rollback receipt without replay or a full file scan. No assigned/contacted box; coordinator owns lifecycle. Claude idle; no workers launched.
''')
payloads=[dict(path=str(f.relative_to(E)),bytes=f.stat().st_size,sha256=sha(f)) for f in sorted(E.rglob('*')) if f.is_file()]
(E/'evidence-manifest.json').write_text(json.dumps(dict(candidate=accepted,base=BASE,payloads=payloads),indent=2)+'\n')
# Local payload check and whitespace review before committing.
for f in E.rglob('*'):
 if f.is_file():
  data=f.read_bytes();assert b['apiSHA256'].encode() not in data
for x in payloads:assert sha(E/x['path'])==x['sha256']
git('stage','add','--','docs/reviews/'+P.name);git('staged-check','diff','--cached','--check')
paths=git('staged-paths','diff','--cached','--name-only').splitlines();assert paths and all(x.startswith('docs/reviews/'+P.name+'/') for x in paths)
try:git('commit','commit','-m','docs: verify real private dashboard sidebar counts in browser')
except RuntimeError:
 tree=git('write-tree-sparse','write-tree','--missing-ok');commit=git('commit-tree','commit-tree',tree,'-p',BASE,inputBytes=b'docs: verify real private dashboard sidebar counts in browser\n');git('update-task-head','update-ref','refs/heads/'+BRANCH,commit,BASE)
commit=git('commit-id','rev-parse','HEAD');tree=git('tree','rev-parse','HEAD^{tree}')
assert git('parent','rev-parse','HEAD^')==BASE
assert git('changed','diff-tree','--no-commit-id','--name-only','-r',BASE,commit).splitlines()==paths
assert git('source-blob','rev-parse','HEAD:ops/app.js')==git('base-source-blob','rev-parse',BASE+':ops/app.js')
for f in E.rglob('*'):
 if f.is_file():
  key=hashlib.sha256(str(f).encode()).hexdigest()[:10]
  assert git('blob-'+key,'hash-object',str(f))==git('tree-'+key,'rev-parse','HEAD:'+str(f.relative_to(R)))
git('push','push','origin','HEAD:refs/heads/'+BRANCH)
remote=git('remote-verify','ls-remote','--heads','origin','refs/heads/'+BRANCH);assert remote.split()==[commit,'refs/heads/'+BRANCH]
final=gate('final')
save('final-receipt.json',dict(outcome='REAL_PRIVATE_BROWSER_SIDEBAR_VERIFIED',candidate=accepted,base=BASE,commit=commit,branch=BRANCH,verifiedRemote=remote,exactRemoteSHA=True,sourceHashes=source,evidenceManifestSHA256=sha(E/'evidence-manifest.json'),payloads=len(payloads),treeRelationship=dict(baseTree=prior['treeRelationship']['publishedTree'],publishedTree=tree,delta='only assigned focused evidence additions; all source unchanged'),browserSanitized=public,verification=json.loads((P/'verification.json').read_text()),resources=final,incidents=json.loads((P/'incidents.json').read_text()),remainingGates=[],mainOwnership=False,mainPublication=False,box=None,boxContacted=False,expiry=None,lifecycleOwner='coordinator',claude='idle',workersSpawned=0,ownershipReleased=True,stop=True))
print(json.dumps(dict(commit=commit,branch=BRANCH,exactRemoteVerified=True,manifest=sha(E/'evidence-manifest.json'),resources=final['pass'],outcome='PASS')))
