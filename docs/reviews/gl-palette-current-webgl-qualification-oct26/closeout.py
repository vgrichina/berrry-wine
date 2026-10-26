from common import *
save('post-execution-source-verification.json',verify())
test=json.load(open(O/'test-result.json'));assert test['stage']=='passed' and [r['version'] for r in test['results']]==[1,2]
assert all(len(r['observations'])==42 and r['stats']['errors']==0 and r['stats']['fallbacks']==0 for r in test['results'])
paths=['/opt/google/chrome/google-chrome','/opt/google/chrome/betterchromium-timezone.sh','/tmp/wa-local-runtime-deps/node_modules/@puppeteer/browsers/lib/launch.js','/tmp/wa-local-runtime-deps/node_modules/puppeteer-core/lib/puppeteer/node/ChromeLauncher.js']
save('launcher-findings.json',dict(status='BLOCKED_CONTROL_CONFORMANCE',firstBlocker='Installed /usr/bin/google-chrome resolves to BetterChromium wrapper sourcing betterchromium-timezone.sh, which invokes curl https://ipwho.is/?fields=success,timezone during normal launch. This conflicts with loopback-only runtime network requirement. Invocation discovered after completed test; response and success unknown; no retry.',secondaryBlocker='Puppeteer defaults detached=true on Linux. Process-group-only supervisor omitted detached Chrome processes; 365080576B RSS is a Node/group lower bound, not an aggregate browser/task RSS qualification. Full process-tree CPU is also unqualified. File-size and CPU rlimits inherited by children; aggregate disk and host MemAvailable were monitored.',rendererInterpretation='Wrapper explicitly requests ANGLE SwiftShader and identifies itself as BetterChromium. WebGL debug renderer returns Intel/Mesa string. Actual physical backend cannot be established from that string in this fork. No hardware-GPU claim; no independently verified SwiftShader backend identity.',sources=[dict(path=p,sha256=sha(pathlib.Path(p).read_bytes()),bytes=pathlib.Path(p).stat().st_size) for p in paths],runtimeRetry=False))
receipt=dict(status='BLOCKED_CONTROL_CONFORMANCE_WITH_PASSING_FRAMEBUFFER_ASSERTIONS',originalMainRevision=REV,snapshot=json.load(open(O/'snapshot-identity.json')),browser=test['browser'],wasmSHA256=test['wasmSha256'],versions=[dict(version=r['version'],actualVersion=r['actualVersion'],reportedRenderer=r['renderer'],observations=len(r['observations']),gpuObservations=sum('expected' not in o for o in r['observations']),softwareObservations=sum('expected' in o for o in r['observations']),errors=r['stats']['errors'],fallbacks=r['stats']['fallbacks']) for r in test['results']],resources=json.load(open(O/'test-receipt.json')),firstBlockerFile='launcher-findings.json',sourceByteIdentity='All 149 blob/length/SHA256 pins verified before and after; unchanged helpers, fixture, production JS and canonical compiler.',scope='Cooperative full-VM WebGL conformance observations only; not benchmark, production renderWorker queue, 27-app gameplay, or game acceptance.',lifecycle=dict(box=None,state='No assigned box; no box accessed',expiry=None,owner='coordinator'),noRetry=True)
save('conclusion.json',receipt)
R=H/'evidence-repo';R.mkdir();g('init','-q',str(R),cwd=H)
BR='task/'+H.name
g('symbolic-ref','HEAD','refs/heads/'+BR,cwd=R)
for k,v in [('gc.auto','0'),('user.name','Wine Ops'),('user.email','wine-ops@local'),('core.sshCommand',SSH)]:g('config',k,v,cwd=R)
g('remote','add','origin','git@github.com:vgrichina/wine-assembly.git',cwd=R)
P=R/'docs/reviews'/H.name;P.mkdir(parents=True)
for p in O.iterdir():
 if p.is_file() and p.name not in ['db-baseline.json']:
  shutil.copyfile(p,P/p.name)
shutil.copyfile(L/'root-ref-digest.json',P/'root-ref-digest.json')
shutil.copyfile(ROOT/'scratch/usage-watch/gl-palette-current-webgl-admission-oct26.json',P/'coordinator-admission.json')
(P/'README.md').write_text('''Exact-main palette WebGL qualification: control conformance blocked

The unchanged production fixture compiled and passed 42 framebuffer observations in each WebGL version in installed Chrome 151.0.7922.108. This is retained assertion evidence, not a compliant overall qualification: the installed BetterChromium wrapper invokes an external timezone lookup, and process-group monitoring omitted detached Chrome. See launcher-findings.json. No runtime retry occurred.

The WebGL renderer reports Intel/Mesa despite the wrapper requesting SwiftShader. This does not establish hardware GPU use or independently prove the physical SwiftShader backend. Timings are diagnostics, not benchmark results.

Original main revision: 754c97d3ff22ce0a0cd06d08ac06dc0446fbcbb2. The local 149-file subset snapshot is 0d65e6daf568a2b0104fcaea75801e9fcac6d1ae and is not main. source-manifest.json contains every source path, original Git blob, size and full SHA256; all 149 were checked before and after. The publication branch is an independent evidence-only root commit; it has no main or source snapshot ancestry.

Recovery: from a complete trusted repository containing the original revision, read each source-manifest.json path using git show REV:path, verify length, Git blob hash and SHA256 before writing it into an empty directory. Do not fetch or checkout the incomplete donor. No source archive, games, tools or installed modules are embedded here. Installed tools execute in place and installed-module-manifest.json identifies their complete module file contents. Recreating the exact subset snapshot commit is unnecessary: retain its distinct identity and use a fresh honestly identified subset snapshot if needed.

The exact runtime command/environment and Node inherited limits are in test-receipt.json and node-startup.log. Do not rerun this acceptance until the network and full descendant accounting blockers are resolved under the original controls. The browser profile/cache/TMPDIR were under the owned task root, included in the monitored allocation, and removed normally by Puppeteer. PeakAccountingBytes includes positive WAL once, external events/session, future growth and 8MiB reserve; it excludes separately listed standing read-only installation sizes. RSS is explicitly a lower bound, not a full-tree peak. CPU90/wall120/file24MiB/output2MiB limits retained; Git DATA512MiB was applied only to Git children. Host disk and MemAvailable gates passed. Chrome wrapper side effects outside its task TMPDIR were not independently accounted; no claim of complete resource conformance is made.

No source fixes, other qualification groups, workers, games, acquisitions, main publication or box operations. Cooperative full-VM WebGL observations do not qualify the production renderWorker queue, game acceptance or 27 apps. No assigned box; lifecycle remains with coordinator.
''')
gate('before-publication')
shutil.copyfile(O/'admission-before-publication.json',P/'admission-before-publication.json')
payloads={p.name:dict(bytes=p.stat().st_size,sha256=sha(p.read_bytes())) for p in sorted(P.iterdir())}
(P/'evidence-manifest.json').write_text(json.dumps(dict(originalMainRevision=REV,branch=BR,files=payloads),indent=2)+'\n')
for name,r in payloads.items():assert sha((P/name).read_bytes())==r['sha256']
g('add','--','docs/reviews/'+H.name,cwd=R);g('diff','--cached','--check',cwd=R)
staged=g('diff','--cached','--name-only',cwd=R).decode().splitlines();assert staged and all(p.startswith('docs/reviews/'+H.name+'/') for p in staged)
g('commit','-q','-m','Retain exact-main palette WebGL observations and first control blockers',cwd=R)
commit=g('rev-parse','HEAD',cwd=R).decode().strip()
gate('committed')
save('local-publication.json',dict(commit=commit,branch=BR,originalMainRevision=REV,evidenceOnlyRootCommit=True,payloads=len(payloads),manifestSHA256=sha((P/'evidence-manifest.json').read_bytes())))
(O/'push.log').write_bytes(g('push','--porcelain','origin','HEAD:refs/heads/'+BR,cwd=R))
remote=g('ls-remote','--exit-code','origin','refs/heads/'+BR,cwd=R).decode().strip();assert remote==commit+'\trefs/heads/'+BR
# Verify the committed payloads rather than relying solely on working files.
for name,r in payloads.items():assert sha(g('show',commit+':docs/reviews/'+H.name+'/'+name,cwd=R))==r['sha256']
save('final-receipt.json',dict(status=receipt['status'],commit=commit,branch=BR,verifiedRemote=remote,originalMainRevision=REV,snapshotCommit=receipt['snapshot']['snapshotCommit'],manifestSHA256=sha((P/'evidence-manifest.json').read_bytes()),lifecycle=receipt['lifecycle'],remainingBlockers=['wrapper external network invocation','detached browser full-tree RSS/CPU accounting','physical renderer identity unverified']))
gate('final')
print(json.dumps(json.load(open(O/'final-receipt.json')),indent=2))
