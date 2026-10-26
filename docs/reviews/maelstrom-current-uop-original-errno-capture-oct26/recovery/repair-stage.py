from common import *
# First process stopped before transform/compile: pinned build.sh was omitted by
# staging's *.js selector. Preserve it and repair staging, not source semantics.
p=H/'canonical/tools/build.sh';row=next(r for r in json.load(open(O/'current-manifest.json'))['files'] if r['path']=='tools/build.sh');assert sha(p.read_bytes())==row['sha256'];save('missing-build-sh-transfer.json',put(p,p))
j=py('import pathlib,json;h=pathlib.Path('+repr(str(H))+');p=h/"ops/compile";p.rename(h/"ops/compile-first-preinput-failure");print(json.dumps(dict(preserved="ops/compile-first-preinput-failure",compileStarted=False)))');save('first-build-preinput-incident.json',j)
(O/'compile-api.json').rename(O/'compile-first-preinput-api.json')
j=remoteInventory();save('remote-precompile-staging-corrected.json',j);account('precompile-staging-corrected',j['allocated'],12582912)
# Exact unchanged build driver validates every source/transform anchor without
# entering compileClosure. Finite CPU/wall/file/output limits are inherited.
code='import subprocess,resource,os,json;h='+repr(str(H))+';env=dict(os.environ,MNE_CANONICAL_ROOT=h+"/canonical",MNE_STANDING=h+"/ops",MNE_ANCHORS=h+"/ops/anchors",TMPDIR=h+"/ops");env.pop("NODE_OPTIONS",None)\ndef lim():\n resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))\np=subprocess.run(["node","--max-old-space-size=512",h+"/repo/tools/maelstrom-diagnostic-canonical-build.cjs","--preflight"],env=env,capture_output=True,text=True,timeout=30,preexec_fn=lim);assert len(p.stdout)+len(p.stderr)<=131072;print(json.dumps(dict(exit=p.returncode,stdout=p.stdout,stderr=p.stderr)));assert p.returncode==0'
j=py(code,40);save('build-transform-preflight.json',j)
j=remote('python3 '+shlex.quote(str(O/'supervise.py'))+' compile',detach=True);save('compile-api.json',j);print(json.dumps(j))
