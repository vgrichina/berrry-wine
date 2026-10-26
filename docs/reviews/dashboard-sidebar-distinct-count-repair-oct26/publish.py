from control import *
import base64
E=R/'docs/reviews'/P.name
E.mkdir(parents=True,exist_ok=True)
gate('prepublication')
assert sha(R/'ops/blocker-model.js')=='1d3ebcd5e31e1eb2e91eb78e9996da2ae8f12840d1a2c30a11fe61c307fe3f7b'
checkpoint=json.loads((P/'checkpoint.json').read_text())
for n,h in checkpoint['candidateFiles'].items():assert sha(R/n)==h
# No production task contents, private API snapshots or service evidence are read.
for n in ['control.py','publish.py','node-startup.json','launch-configuration.json','alternate-reuse.json','pinned-inputs.json','checkpoint.json','baseline-regression.json']:
 shutil.copy2(P/n,E/n)
for p in P.glob('resources-*.json'):shutil.copy2(p,E/p.name)
for p in P.glob('command-*'):
 if not p.is_file():continue
 if p.suffix in ['.stdout','.stderr']:
  (E/(p.name+'.json')).write_text(json.dumps(dict(encoding='base64',sha256=sha(p),data=base64.b64encode(p.read_bytes()).decode()))+'\n')
  (E/p.name).unlink(missing_ok=True)
 else:shutil.copy2(p,E/p.name)
prior=pathlib.Path('/tmp/blocker-count-private-dashboard-activation-oct26/repo/docs/reviews/blocker-count-private-dashboard-activation-oct26/git-warnings.json')
assert prior.stat().st_size<2097152
shutil.copy2(prior,E/'reused-nested-alternate-warnings.json')
incidents=[
 'Initial instruction/source exploration exceeded the 8192-byte display excerpt target. Later commands use bounded output and preserve raw logs; no task/private snapshot was captured.',
 'Initial synthetic harness omitted external homeView and dosView globals. Both first failures and corrected unchanged-donor assertion failures are retained in command logs. These were test-fixture setup errors; source was not changed to accommodate them.',
 'Reused validated 367-store leaf-first alternate closure from accepted predecessor in isolated Git only. Original nested-alternate warnings are preserved; no shared Git configuration or donor objects were modified.',
 'Publication diff check rejected whitespace in unchanged Node assertion output. Raw stdout/stderr are now losslessly base64-encoded in JSON with original SHA256; original local logs remain intact. Source and tests unchanged; no acceptance repeated.'
]
save('incidents.json',incidents);shutil.copy2(P/'incidents.json',E/'incidents.json')
(E/'README.md').write_text('''# Sidebar distinct blocker count repair, 2026-10-26

The accepted detail summary counts distinct blocked task IDs while the old navigation badge counted blocked ledger rows. Navigation now calls the accepted `BlockerModel.countSummary` API and labels its count as distinct IDs. Anonymous blocked rows remain separately visible in the badge, even when there are no IDs. The tooltip uses the exact same `countSummaryText` as the detail summary. An empty blocked set retains the existing hidden empty badge and has an explicit zero-count tooltip. With the accepted aggregate 77 IDs / 91 rows / 14 duplicates / 0 anonymous, the new badge is `77 distinct IDs`; this is a source-level implication, not a new browser observation.

Only `ops/app.js` and the new synthetic `ops/dashboard-sidebar-count.test.js` change product/test code. The blocker model is byte-for-byte unchanged. Other status statistics intentionally continue counting rows; classification, dependency/root selection, approvals and detail content are preserved. The fix changes no backend, memory readers, Telegram, deployed files or services.

Five focused Node tests execute the actual render entry, detail view and blocker row rendering in a small VM DOM fixture. Browser startup/network boot, DOM morphing and unrelated views are stubbed. They cover duplicate IDs, exact/case/whitespace identity, all accepted anonymous-ID forms, empty/nonblocked refreshes clearing stale counts, mixed statuses, search independence, retained user/agent/dependency/approval classifications and row-count status statistics. All fixtures are invented generic rows. The same assertions on the immutable accepted source fail five times with assertion errors and no loader errors after fixing the fixture's omitted external view globals. Initial fixture failures are retained transparently. The repaired source passes 5/5. No previously accepted 10/26/6 groups, browser activation or guest/build tests were repeated.

Reproduce from this checkout with `/usr/local/bin/node --max-old-space-size=192 ops/dashboard-sidebar-count.test.js`. `NODE_OPTIONS=--max-old-space-size=192` was also present in the supervised execution. The optional `--app=/absolute/path/to/immutable/ops/app.js` selects a source for unchanged-donor regression. `checkpoint.json` binds all tested source/fixture SHA-256 values to the passing command and logs. `node-startup.json` records the actual executable, flags, environment option and inherited limits. The 192 MiB old-space flag is a heap setting, not a total RSS limit. CPU 90s, wall 120s, file 24 MiB and output 2 MiB controls apply; Git alone inherits the task's 512 MiB DATA limit. No mount or guest invocation exists; the canonical parser accepted the actual empty mount argv before checkout.

Resources and the source/launch identities are retained alongside the regression logs. Disk accounting includes allocated files in the isolated task and launcher directory plus positive shared WAL growth conservatively once, with growth and an 8 MiB reserve. Existing clients are measured and already represented in host MemAvailable; one prospective-client reserve is added once. The task uses isolated local Git configuration and the exact trusted SSH identity/known-hosts route. The reused root-ref digest is retained inside launch configuration without capturing a ref listing.

Independent review, coordinator integration and separately authorized deployment remain gates. Corpus acceptance owns MAIN; this branch makes no main publication or deployment claim. No box is assigned or contacted; lifecycle remains coordinator-owned. No other workers or agents were launched. Claude remains idle. The external final receipt records the exact commit and verified remote branch to avoid self-referential commit metadata.
''')
manifest={'base':REV,'files':{str(p.relative_to(R)):{'bytes':p.stat().st_size,'sha256':sha(p)} for p in [R/'ops/app.js',R/'ops/blocker-model.js',R/'ops/dashboard-sidebar-count.test.js',*sorted(E.iterdir())] if p.is_file() and p.name!='evidence-manifest.json'}}
(E/'evidence-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
git('add','-A','--','ops/app.js','ops/dashboard-sidebar-count.test.js',str(E.relative_to(R)))
git('diff','--cached','--check')
names=git('diff','--cached','--name-only').splitlines()
assert all(n in ['ops/app.js','ops/dashboard-sidebar-count.test.js'] or n.startswith(str(E.relative_to(R))+'/') for n in names)
git('commit','-m','Use accepted distinct blocker counts in dashboard navigation')
commit=git('rev-parse','HEAD')
gate('prepush')
git('push','origin','HEAD:refs/heads/'+BRANCH)
remote=git('ls-remote','--exit-code','origin','refs/heads/'+BRANCH)
assert remote.split()==[commit,'refs/heads/'+BRANCH]
assert git('status','--porcelain')==''
for n,v in manifest['files'].items():assert sha(R/n)==v['sha256']
resources=gate('published')
receipt=dict(decision='TESTED_TASK_BRANCH_PUBLISHED',base=REV,commit=commit,remoteBranch='refs/heads/'+BRANCH,remoteObservation=remote,exactRemoteVerified=True,sourceHashes=checkpoint['candidateFiles'],manifest=str(E/'evidence-manifest.json'),manifestSHA256=sha(E/'evidence-manifest.json'),testResult='5/5 focused regressions PASS',baselineResult='5 assertion failures, 0 loader errors on immutable original after fixture correction',checkpoint=str(P/'checkpoint.json'),resources=resources,remainingGates=['independent review','coordinator integration','separately authorized deployment'],mainOwnership=False,mainPublished=False,deployed=False,box=dict(id=None,state='unassigned',expiry=None,owner='coordinator'),privateFixtures=False,workersSpawned=0)
save('final-receipt.json',receipt)
watch=json.loads((P/'board-watcher.json').read_text())['pid']
try:os.kill(watch,signal.SIGTERM)
except ProcessLookupError:pass
print(json.dumps(dict(commit=commit,remote=remote,manifest=receipt['manifest'],manifestSHA256=receipt['manifestSHA256'],receipt=str(P/'final-receipt.json'),projectedBytes=resources['projectedBytesIncluding8MiBReserve'],hostRemaining=resources['hostRemainingProjected'])))
