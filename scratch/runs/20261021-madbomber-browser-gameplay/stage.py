import pathlib,subprocess,json,hashlib,tarfile,io
from transport import run,put,put_bytes,guard,ROOT
base='0c0fa3ebd7a84b6254a160c6cdfa6774c556d4cb'
remote='/home/user/madbomber-browser'
def git(*a):return subprocess.check_output(['git',*a])
def sha(b):return hashlib.sha256(b).hexdigest()
guard(64*1024**2)
prior=json.load(open('scratch/runs/20261021-madbomber-current-main-gameplay/preflight.json'))
changed=git('diff','--name-only',prior['buildSource'],base).decode().splitlines()
unexpected=[p for p in changed if not (p.startswith(('docs/','scratch/runs/')) or p=='ops/STATUS.md' or p=='TODOS.md' or p in ['lib/army-men-render-observer.js','test/test-army-men-render-observer.js'])]
print('Non-doc differences',unexpected,flush=True)
# Two unrelated observer/test files are explicitly identified, never imported by Mad Bomber.
assert set(unexpected)=={'tools/army-bltfast-observer.js','tools/army-bltfast-preload.test.js'},unexpected
module=pathlib.Path('scratch/runs/20261021-army-integrated-gameplay-scroll/provenance/wine-assembly.wasm')
assert sha(module.read_bytes())==prior['moduleSha256'] and module.stat().st_size==1878508
original=pathlib.Path('scratch/runs/20261020-madbomber-native-qualification/original-assets.tar.gz')
assert sha(original.read_bytes())=='b5353b73674a1af6109cb9bf3af5f7d0383308b7ef0b47d52139813ba3ee98ef'
tree=[]
for line in git('ls-tree','-rl',base).decode().splitlines():
    meta,p=line.split('\t'); mode,kind,oid,size=meta.split()
    if kind=='blob':tree.append(dict(path=p,oid=oid,size=int(size)))
# Full exact tracked source, including browser, tests and build inputs; large archival documentation excluded.
files=[f for f in tree if not f['path'].startswith(('docs/reviews/','scratch/','packages/'))]
manifest={'revision':base,'files':files}
record={'revision':base,'buildSource':prior['buildSource'],'reused':True,'moduleSha256':prior['moduleSha256'],'moduleBytes':1878508,'changedPaths':changed,'unrelatedObserverFiles':unexpected,'originalSha256':sha(original.read_bytes()),'originalBytes':original.stat().st_size,'closure':prior['closure']}
guard(); ROOT.joinpath('preflight.json').write_text(json.dumps(record,indent=2));ROOT.joinpath('source-manifest.json').write_text(json.dumps(manifest,indent=2))
print('source files/bytes',len(files),sum(f['size'] for f in files),flush=True)
archive=git('archive','--format=tar.gz',base,*[f['path'] for f in files])
put_bytes(archive,remote+'/source.tar.gz'); print('source transferred',len(archive),flush=True)
put(ROOT/'source-manifest.json',remote+'/evidence/source-manifest.json');put(ROOT/'preflight.json',remote+'/evidence/preflight.json')
print(run("import pathlib,tarfile; p=pathlib.Path('"+remote+"/repo');p.mkdir(parents=True,exist_ok=True);tarfile.open('"+remote+"/source.tar.gz').extractall(p,filter='data');print('extracted')"),flush=True)
put(module,remote+'/repo/build/wine-assembly.wasm');put(original,remote+'/original-assets.tar.gz')
print(run("import tarfile,pathlib; p=pathlib.Path('"+remote+"/repo/test/binaries/candidates/madbomber');p.mkdir(parents=True,exist_ok=True);tarfile.open('"+remote+"/original-assets.tar.gz').extractall(p,filter='data');print('originals restored')"),flush=True)
for f in prior['closure']:
    if not f['path'].startswith('test/binaries/candidates/madbomber/'):
        data=pathlib.Path(f['path']).read_bytes();assert sha(data)==f['sha256'];put_bytes(data,remote+'/repo/'+f['path'])
print('stage complete',flush=True)
