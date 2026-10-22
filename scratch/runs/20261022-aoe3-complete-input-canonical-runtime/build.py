from pathlib import Path
import subprocess,json,hashlib,os,time,datetime
E=Path('/home/user/aoe3-canonical-c7fae5ac-evidence'); S=Path('/home/user/aoe3-canonical-c7fae5ac-staged'); R=Path('/home/user/aoe3-original-oct22')
assert not (E/'build-result.json').exists() and not (E/'canonical-build.log').exists()
assert (E/'original-pins-after-stage.log').read_text().startswith('PASS 373')
raw=(E/'staged-closure-verification.json').read_text(); result=json.loads(raw[raw.index('{'):]); assert result['result']=='PASS' and result['files']==3420 and result['stagedRootVerified']==str(S)
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=S).strip()==b'c7fae5ac7ea9e29dfa3f83a7c2bd87d092e0b3b2'
def h(p):
    with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
for r in json.loads((R/'runner-manifest.json').read_text()):
    p=R/r['path'];assert p.stat().st_size==r['size'] and h(p)==r['sha256'],str(p)
env=dict(os.environ,NODE_PATH=str(R/'runner/node_modules'))
resolution=subprocess.check_output(['node','-e',"const p=require.resolve('pngjs');const v=require('pngjs/package.json').version;if(v!=='7.0.0')throw Error(v);console.log(JSON.stringify({path:p,version:v}))"],cwd=S,env=env,text=True)
(E/'dependency-resolution.json').write_text(resolution)
assert h(Path('/usr/local/bin/node'))=='f3432a45b03b2da0d270095fdd8813dc34cbea73f5fc8b18c7a384b7cf9b333a'
size=sum(p.stat().st_size for b in [S,E] for p in b.rglob('*') if p.is_file());assert size+268435456<1073741824
cmd=['env','-u','NODE_OPTIONS','-u','WINE_REGION_MAP','-u','WINE_REGION_SHAKE','-u','WINE_WAT_NAMES','-u','WINE_WAT_COMPILER','NODE_PATH='+str(R/'runner/node_modules'),'bash','tools/build.sh']
def stamp():return datetime.datetime.now(datetime.timezone.utc).isoformat()
meta=dict(revision='c7fae5ac7ea9e29dfa3f83a7c2bd87d092e0b3b2',cwd=str(S),command=cmd,startedAt=stamp(),environment={k:env.get(k) for k in ['PATH','HOME','LANG','LC_ALL','NODE_PATH']},removed=['NODE_OPTIONS','WINE_REGION_MAP','WINE_REGION_SHAKE','WINE_WAT_NAMES','WINE_WAT_COMPILER'],fullInheritedEnvironmentSHA256=hashlib.sha256(json.dumps(dict(os.environ),sort_keys=True).encode()).hexdigest(),nodeSHA256=h(Path('/usr/local/bin/node')),measuredBytesBefore=size,reservedAdditionalBytes=268435456,buildAttempts=1,guestAttempts=0)
(E/'build-command.json').write_text(json.dumps(meta,indent=2)+'\n')
with (E/'canonical-build.log').open('wb') as out:p=subprocess.run(cmd,cwd=S,stdout=out,stderr=subprocess.STDOUT)
meta.update(exitCode=p.returncode,finishedAt=stamp(),outputs={str(f.relative_to(S)):dict(bytes=f.stat().st_size,sha256=h(f)) for f in (S/'build').glob('*') if f.is_file()})
(E/'build-result.json').write_text(json.dumps(meta,indent=2)+'\n')
print(json.dumps(meta,indent=2));print((E/'canonical-build.log').read_text()[-7000:])
for base,rows in [(R/'runtime',json.loads((R/'runtime-pins.json').read_text())),(R/'installed',json.loads((R/'installed-audit/installed-manifest.json').read_text())['files'])]:
    for r in rows:
        f=base/r['path'];assert f.stat().st_size==r['size'] and h(f)==r['sha256'],str(f)
(E/'original-pins-after-build.log').write_text('PASS 373 immutable original runtime/installed pins\n')
with (E/'post-build-closure-verification.log').open('wb') as out:
    check=subprocess.run(['python3',str(E/'closure.py'),'--repo',str(S),'--staged-root',str(S)],stdout=out,stderr=subprocess.STDOUT)
assert check.returncode==0
subprocess.run(['git','diff','--exit-code','HEAD'],cwd=S,check=True,stdout=subprocess.DEVNULL)
print('Post-build closure, source and 373 original pins PASS')
