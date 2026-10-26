from control import *
E=R/'docs/reviews'/P.name
gate('before-evidence-publication')
before=json.loads((P/'service-before.json').read_text());after=service()
assert (before['pid'],before['startTicks'])==(after['pid'],after['startTicks'])
served,_=get('/app.js');assert served['status']==200 and served['sha256']==APP
manifest=json.loads((P/'deployed-before-manifest.json').read_text())
assert set(manifest)=={str(f.relative_to(L)) for f in L.rglob('*') if f.is_file()}
for n,v in manifest.items():assert sha(L/n)==(APP if n=='app.js' else v['sha256']),n
save('service-final.json',after)
blocked=json.loads((P/'resources-before-browser.json').read_text())
save('verification.json',dict(activated=True,served=served,allOtherFilesUnchanged=len(manifest)-1,fileSetUnchanged=True,manifestSHA256=sha(P/'deployed-before-manifest.json'),beforePID=before['pid'],afterPID=after['pid'],startTicksUnchanged=True,beforeRSS=before['rss'],afterRSS=after['rss'],sampleSeconds=time.time()-json.loads((P/'activation.json').read_text())['at'],shortSampleOnly=True,longTermStabilityClaim=False,browserExecuted=False,renderedSidebarVerified=False,freshPrivateAPICounts=None,privateAPIFetches=0,privateContentExported=False,blocker=dict(kind='fresh physical memory admission denied before browser execution',availableBytes=blocked['MemAvailable'],requiredBytes=blocked['requiredAvailable'],shortfallBytes=blocked['requiredAvailable']-blocked['MemAvailable'],owner='coordinator',resumeCondition='separately authorize/assign bounded rendered check after an actual capacity change; preserve resource reserves or serialize other work',unchangedRetry=False),rollback=dict(path=str(P/'rollback.py'),sha256=sha(P/'rollback.py'),backup=str(P/'backups/app.js'),backupSHA256=sha(P/'backups/app.js')),box=None,boxContacted=False,lifecycleOwner='coordinator'))
save('checkpoint.json',dict(candidate=BASE,sourceHashes=json.loads((D.parent/'final-receipt.json').read_text())['sourceHashes'],sourceTree='c49a1dcd5ca7e55889d8c8b7042779bece88ff6c',completed=['exact input/HTML-script compatibility','private atomic app activation','HTTP200 exact served app hash','1358 other deployed files unchanged and server identity unchanged'],reused='independent8/8incl128 snapshots28route transitions; merged8/8; candidate5/5; prior10/26/6; no replay',remaining=['actual real rendered sidebar/detail/row stats verification blocked by fresh memory admission'],evidence=['activation.json','compatibility.json','verification.json','resources-before-browser.json'],browserCandidateSHA256=sha(P/'browser.cjs')))
save('incidents.json',[dict(kind='resource denial',evidence='resources-before-browser.json',operation='real browser',resolution='stopped before spawning browser; no unchanged retry; private activation retained as authorized'),dict(kind='standing-tool directory footprint read denied',path='/opt/google/chrome/extensions',effect='optional du exited nonzero; no task execution or acquisition attempted; standing tool directory lower-bound approximation only, no bypass')])
E.mkdir(parents=True,exist_ok=False)
names=['activation.json','compatibility.json','verification.json','checkpoint.json','incidents.json','launch-configuration.json','node-startup.json','standing-inputs.json','loopback-listener.json','service-before.json','service-after-activation.json','service-final.json','resources-precheckout.json','resources-before-activation.json','resources-before-browser.json','resources-before-evidence-publication.json','startup.json','mount-empty.json']
for n in names:shutil.copyfile(P/n,E/n)
for n in ['control.py','activate.py','rollback.py','browser.cjs','publish.py']:shutil.copyfile(P/n,E/n)
(E/'README.md').write_text('''# Private dashboard sidebar activation — 2026-10-26

Activated only the accepted `ops/app.js` from commit `7681b752d7c3fe565a49e92832c3d9825bec7ed9` on the existing private loopback service. Served HTTP 200 and full-file SHA-256 match `81fd237e43112d93f946ed327e3d4e9cdd57ed1f7fc0642d2583e0b3e8693059`. All 1,358 other deployed files and the file set were checked unchanged; server PID/start identity unchanged. No restart or main publication.

**Rendered verification BLOCKED:** the fresh pre-browser memory check measured 3,561,222,144 bytes available against 3,690,987,520 required. Chrome was never started; no unchanged retry, no screenshot, no private API fetch or current-count claim. The retained bounded browser script is unexecuted and must not be read as acceptance evidence. Current distinct/sidebar counts remain unverified in a rendered browser. Historical 77/91 counts are not fresh measurements. Existing independent 8/8 (128 snapshots, 28 route transitions), merged 8/8, candidate 5/5 and prior 10/26/6 receipts were reused without replay.

`checkpoint.json` binds exact source/fixture hashes and remaining checks. `verification.json` records the blocker, sample bounds, backup hash and rollback path. The lossless prior app backup remains locally at `/tmp/dashboard-sidebar-private-browser-activation-oct26/backups/app.js`; run the retained rollback.py from that directory to restore atomically, only while the live app still equals the old or accepted hash. No private task contents, inbox, task IDs or secrets are included. The complete local pre-activation file manifest is retained locally; only its digest is published.

Resource receipts reserve two new clients once (existing RSS already reflected in MemAvailable), three other lightweight execution allowances plus a freshly sized 1.25 GiB aggregate browser allowance based on the prior 1.14 GiB observed peak, and the physical floor. Git DATA 512 MiB applies only to Git children; Node startup used installed Node 24, heap flag 192 MiB, CPU 90 seconds, wall 120 seconds, file 24 MiB and output 2 MiB limits, with unlimited inherited DATA/AS. No browser reservation was relaxed. Disk projection includes all checkout/Git/evidence/session/launcher growth, positive WAL growth counted once, 8 MiB future growth and 8 MiB reserve inside 64 MiB. Installed tools/donors are standing read-only inputs. No assigned/contacted box; lifecycle remains with coordinator. Claude idle; no workers spawned.
''')
payloads=[dict(path=str(f.relative_to(E)),bytes=f.stat().st_size,sha256=sha(f)) for f in sorted(E.rglob('*')) if f.is_file()]
(E/'evidence-manifest.json').write_text(json.dumps(dict(base=BASE,sourceTree='c49a1dcd5ca7e55889d8c8b7042779bece88ff6c',payloads=payloads),indent=2)+'\n')
git('stage-evidence','add','--','docs/reviews/'+P.name)
git('staged-check','diff','--cached','--check')
paths=git('staged-paths','diff','--cached','--name-only').splitlines();assert paths and all(p.startswith('docs/reviews/'+P.name+'/') for p in paths)
try:git('commit','commit','-m','docs: record private sidebar activation and browser resource blocker')
except RuntimeError:
 # Sparse immutable unrelated blobs need not be materialized to preserve their tree entries.
 # Preserve the ordinary first failure and use Git's supported sparse tree plumbing.
 tree=git('write-tree-sparse','write-tree','--missing-ok')
 commit=git('commit-tree','commit-tree',tree,'-p',BASE,inputBytes=b'docs: record private sidebar activation and browser resource blocker\n')
 git('update-task-head','update-ref','refs/heads/'+BRANCH,commit,BASE)
commit=git('commit-id','rev-parse','HEAD');tree=git('published-tree','rev-parse','HEAD^{tree}')
assert git('parent','rev-parse','HEAD^')==BASE
changed=git('final-changed-paths','diff-tree','--no-commit-id','--name-only','-r',BASE,commit).splitlines();assert changed==paths
assert git('unchanged-source-blob','rev-parse','HEAD:ops/app.js')==git('base-source-blob','rev-parse',BASE+':ops/app.js')
for f in E.rglob('*'):
 if f.is_file():assert git('payload-blob-'+hashlib.sha256(str(f).encode()).hexdigest()[:10],'hash-object',str(f))==git('payload-tree-'+hashlib.sha256(str(f).encode()).hexdigest()[:10],'rev-parse','HEAD:'+str(f.relative_to(R)))
git('push','push','origin','HEAD:refs/heads/'+BRANCH)
remote=git('remote-verify','ls-remote','--heads','origin','refs/heads/'+BRANCH);assert remote.split()==[commit,'refs/heads/'+BRANCH]
finalResource=gate('final-handback')
save('final-receipt.json',dict(outcome='EXACT_PRIVATE_ACTIVATION_COMPLETE_RENDERED_CHECK_RESOURCE_BLOCKED',candidate=BASE,commit=commit,branch=BRANCH,verifiedRemote=remote,exactRemoteSHA=True,mainPublication=False,sourceHashes=json.loads((D.parent/'final-receipt.json').read_text())['sourceHashes'],evidenceManifestSHA256=sha(E/'evidence-manifest.json'),evidencePayloads=len(payloads),treeRelationship=dict(baseTree='c49a1dcd5ca7e55889d8c8b7042779bece88ff6c',publishedTree=tree,delta='only focused nonprivate evidence additions; all source paths unchanged'),activation=json.loads((P/'activation.json').read_text()),verification=json.loads((P/'verification.json').read_text()),resources=finalResource,incidents=json.loads((P/'incidents.json').read_text()),remainingGates=['actual rendered sidebar/detail/row-stat consistency after real memory capacity change'],box=None,expiry=None,boxContacted=False,lifecycleOwner='coordinator',claude='idle',workersSpawned=0,ownershipReleased=True,stop=True))
print(json.dumps(dict(commit=commit,branch=BRANCH,exactRemoteVerified=True,tree=tree,manifest=sha(E/'evidence-manifest.json'),resources=finalResource['pass'],outcome='activated; browser blocked before execution')))
