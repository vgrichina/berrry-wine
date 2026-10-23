"""Destination-only verification of immutable actual installation and runtime."""
import pathlib,json,hashlib,os,shutil
R=pathlib.Path('/home/user/shadow-man-launcher-configuration-capture-oct23');I=R/'immutable';V=I/'restored/parent-vfs'
def sha(p):
 with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def alloc(p):return sum(x.lstat().st_blocks*512 for x in [p,*p.rglob('*')])
def main():
 rows=[json.loads(l) for l in (I/'receipts/transfer-files.jsonl').read_text().splitlines()]
 assert len(rows)==2083 and sum(x['bytes'] for x in rows)==186399681
 actual={str(p) for p in (I/'restored').rglob('*') if p.is_file()};assert actual=={x['path'] for x in rows}
 for x in rows:
  p=pathlib.Path(x['path']);assert not p.is_symlink() and p.stat().st_size==x['bytes'] and sha(p)==x['sha256'],str(p)
 accepted=json.loads((I/'receipts/accepted-installed-payload.json').read_text());assert accepted['files']==1959 and accepted['originalPayloadBytes']==100354053
 originals=[]
 for x in accepted['mapping']:
  a=x['installed'];b=x['original'];p=V/a['path'];assert p.stat().st_size==b['size'] and sha(p)==b['sha256'],str(p);originals.append(str(p.relative_to(V)))
 reg=I/'restored/parent-registry.json';assert sha(reg)==sha(I/'registry-preflight.json')==sha(I/'receipts/accepted-parent-registry.json')=='d7143f29d29576cd015ec875264028fa70795d0f18de457e31927048081d9de3'
 runtime=json.loads((I/'receipts/runtime-manifest.json').read_text());assert len(runtime)==158
 for x in runtime:
  p=I/'runtime'/x['path'];assert p.stat().st_size==x['size'] and sha(p)==x['sha256']
 codec=json.loads((I/'receipts/codec-pins.json').read_text())['files'];assert len(codec)==23
 for x in codec:
  p=I/'runtime'/x['path'].removeprefix('runner/');assert p.stat().st_size==x['size'] and sha(p)==x['sha256']
 data=json.loads((I/'receipts/required-data-manifest.json').read_text());assert len(data['files'])==27 and data['totalBytes']==692498
 for x in data['files']:
  p=I/'runtime'/x['path'];assert p.stat().st_size==x['bytes'] and sha(p)==x['sha256']
 ctl=json.loads((I/'receipts/ctl-pin.json').read_text());assert sha(I/'runtime'/ctl['path'])==ctl['sha256']
 mod=I/'runtime/build/wine-assembly.wasm';assert mod.stat().st_size==1879387 and sha(mod)=='ccd5b0a8e4fcb84d06bf539c8a4af28b377472072f3422750122048e9339f553'
 files=[p for p in V.rglob('*') if p.is_file()];page=os.statvfs(V).f_frsize;copy=sum(((p.stat().st_size+page-1)//page)*page for p in files)
 # Complete mutable original clone + CreateProcess input + parent and child exports.
 percopy=copy+8*1024*1024;metadata=4*len(files)*4096+16*1024*1024;growth=64*1024*1024
 projection=4*percopy+metadata+growth
 assert projection<=939524096,('full overlapping-copy projection',projection)
 immutable=alloc(I);fixed=alloc(R/'fixed');free=shutil.disk_usage(R).free
 assert immutable+16777216<2147483648 and fixed+16777216<100663296 and free>=2147483648+939524096
 game=V/'program files/acclaim entertainment/shadowman';extras=[str(p.relative_to(V)) for p in game.rglob('*') if p.is_file() and str(p.relative_to(V)) not in originals]
 result=dict(passAll=True,restoredFiles=len(rows),restoredBytes=sum(x['bytes'] for x in rows),originalManifestCommit='ba485e8a27ad8a0cc25a14d40427e8cbfd38eec3',originalFilesMatched=len(originals),originalBytes=100354053,preservedGameExtras=extras,registrySHA256=sha(reg),registryBytes=reg.stat().st_size,runtimeMain='58e90870a40a541a4083cae5e987ca8de31889e6',runtimePaths=len(runtime),codecFiles=len(codec),requiredDataFiles=27,requiredDataBytes=692498,ctl=ctl,moduleSHA256=sha(mod),moduleBytes=mod.stat().st_size,allocation=dict(immutableAllocated=immutable,fixedAllocated=fixed,freeBytes=free,sourceVfsFiles=len(files),sourceVfsAllocated=alloc(V),pageRoundedCopyBytes=copy,perCopyExtra=8*1024*1024,copyRoutes=['mutable-original-clone','CreateProcess-input','parent-export','child-export'],copyCount=4,metadataAllowance=metadata,growthAllowance=growth,projectedTmpfs=projection,tmpfsCap=939524096,fixedCap=100663296,reserve=33554432,totalMutableCap=1073741824))
 (R/'fixed/hash-gate.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
if __name__=='__main__':main()
