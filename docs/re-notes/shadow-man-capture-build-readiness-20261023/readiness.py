#!/usr/bin/env python3
"""Exact-input admission followed by the canonical prefix; never compilation."""
import argparse, hashlib, json, os, pathlib, shutil, subprocess, sys
HERE = pathlib.Path(__file__).resolve().parent
CAND = 'b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a'
ACCEPT = '4dab22cfefb7b7048fbb6189b81cdccdd4ab8753'
ROOT = pathlib.Path('/home/user/wine-assembly')
DONOR = pathlib.Path(str(ROOT)+'-shadow-man-fresh-selection-repair-oct23')
REVIEW = pathlib.Path(str(ROOT)+'-shadow-man-fresh-selection-independent-accept-oct23')
ENV = dict(os.environ, GIT_NO_LAZY_FETCH='1')
def git(root, *args):
    p = subprocess.run(['git','-C',str(root),*args],env=ENV,capture_output=True)
    if p.returncode: raise ValueError(p.stderr.decode())
    return p.stdout
def read_exact(row, masked):
    if row['path'] == masked: raise FileNotFoundError('masked required input '+masked)
    for repo in [DONOR, REVIEW, ROOT]:
        p = subprocess.run(['git','-C',str(repo),'cat-file','blob',row['blob']],env=ENV,capture_output=True)
        if p.returncode == 0:
            data = p.stdout
        else:
            f=repo/row['path']
            if not f.is_file(): continue
            data=f.read_bytes()
        blob=hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
        if blob==row['blob'] and hashlib.sha256(data).hexdigest()==row['sha256']:
            return data
    raise FileNotFoundError('required exact input unavailable '+row['path']+' '+row['blob'])
def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--control-missing', choices=['src/main.watx'])
    ap.add_argument('--source-root', type=pathlib.Path)
    args=ap.parse_args()
    manifest=json.loads((HERE/'closure-inputs.json').read_text())
    assert manifest['candidate']==CAND
    assert git(DONOR,'rev-parse','HEAD').decode().strip()==CAND
    assert git(REVIEW,'rev-parse','HEAD').decode().strip()==ACCEPT
    tree={line.split('\t')[1]:line.split()[2] for line in git(DONOR,'ls-tree','-r',CAND).decode().splitlines()}
    rows=manifest['files']
    expected={f for f in tree if (f.startswith(('src/','lib/','tools/','test/')) or '/' not in f) and f.endswith(('.wat','.watx','.js','.cjs','.mjs','.json','.sh','.html','.css')) and not f.startswith(('test/binaries/','test/candidate-corpus/'))}
    expected.update(['CLAUDE.md','AGENTS.md','tools/watx-src/CHANGELOG.md','tools/watx-src/PROVENANCE.md'])
    assert {r['path'] for r in rows}==expected, 'manifest membership differs from exact focused tree inventory'
    # Check required root first, so the rejecting control does not replay input review.
    rows=sorted(rows,key=lambda r:(r['path']!='src/main.watx',r['path']))
    for row in rows:
        assert tree[row['path']]==row['blob']
        read_exact(row,args.control_missing)
    build=read_exact(next(r for r in rows if r['path']=='tools/build.sh'),None)
    assert build==(HERE/'pinned-build.sh').read_bytes()
    fence=b'echo "Compiling (WATX)..."\nnode tools/build-compile-wat.js\n'
    assert build.count(fence)==1
    prefix=build.split(fence)[0].replace(b'cd "$(dirname "$0")/.."',b'cd "$SHADOW_SOURCE_ROOT"',1)
    prefix+=b'\nexit 0 # HARD STOP: compilation is outside this task\n'
    assert prefix==(HERE/'canonical-precompile.sh').read_bytes()
    assert b'node tools/build-compile-wat.js' not in prefix
    cap=64*1024**2
    scanner=[r for r in rows if (r['path'].startswith('src/') and r['path'].endswith(('.wat','.watx'))) or (r['path'].endswith('.js') and (r['path'].startswith(('lib/','tools/','test/')) or '/' not in r['path']))]
    lower=sum(r['bytes'] for r in scanner)+manifest['gitDonorBytes']+8*1024**2
    verdict=dict(verdict='BLOCKED',stage='pre-checkout disk admission',candidate=CAND,acceptance=ACCEPT,verifiedFocusedInputs=len(rows),scannerFiles=len(scanner),scannerSourceBytes=sum(r['bytes'] for r in scanner),gitBytes=manifest['gitDonorBytes'],reserveBytes=8*1024**2,scannerLowerBound=lower,cap=cap,excess=lower-cap,completePlanBytes=manifest['projectedPeak'],free=shutil.disk_usage(ROOT).free,floor=2982150144,cheapGatesExecuted=0,compilation=False,runtime=False)
    print(json.dumps(verdict,indent=2))
    # A larger allocation or a different staging design needs separate admission.
    # There is no override, automatic refilling, or reduced scanner view.
    if lower>cap or manifest['projectedPeak']>cap: return 2
    if verdict['free']-manifest['projectedPeak']<verdict['floor']: return 2
    if not args.source_root: raise ValueError('complete materialized exact source-root required before gates')
    for row in rows:
        data=(args.source_root/row['path']).read_bytes()
        if hashlib.sha256(data).hexdigest()!=row['sha256']: raise ValueError('materialized input mismatch '+row['path'])
    env=dict(ENV,SHADOW_SOURCE_ROOT=str(args.source_root.resolve()),NODE_OPTIONS='--require='+str(HERE/'no-compile.cjs'))
    # Prefix is derived verbatim from the pinned authoritative script, retains
    # every gate and generation step, ends after check-parens, and exits.
    p=subprocess.run(['bash','-ex',str(HERE/'canonical-precompile.sh')],env=env,timeout=600)
    if p.returncode: return p.returncode
    # This plan is NOT a complete dynamic JS dependency proof. Never emit READY
    # solely because the source gates passed.
    print('BLOCKED: full dependency/provenance closure must be independently completed')
    return 4
if __name__=='__main__':
    try: sys.exit(main())
    except (AssertionError,ValueError,FileNotFoundError) as e:
        print('BLOCKED required-input verification: '+str(e),file=sys.stderr)
        sys.exit(3)
