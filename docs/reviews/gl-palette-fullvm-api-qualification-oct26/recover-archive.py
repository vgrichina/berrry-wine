"""Recreate source/dependency transfer archives from verified standing inputs.

Usage: python3 recover-archive.py EXACT_OBJECT_REPO PNGJS_7_PACKAGE OUTPUT_DIRECTORY
No checkout, fetch, install, runtime execution, or reference enumeration.
"""
import pathlib,sys,json,hashlib,subprocess,resource,tarfile,io,gzip
HERE=pathlib.Path(__file__).resolve().parent
repo,png,out=map(pathlib.Path,sys.argv[1:]);out.mkdir(exist_ok=True,parents=True)
manifest=json.loads((HERE/'source-manifest.json').read_text())
deps=json.loads((HERE/'pngjs-manifest.json').read_text())
def git_limits():
 resource.setrlimit(resource.RLIMIT_DATA,(536870912,536870912))
 resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
def sha(b):return hashlib.sha256(b).hexdigest()
def archive(name,rows,reader):
 with (out/name).open('wb') as f,gzip.GzipFile(fileobj=f,mode='wb',mtime=0) as gz,tarfile.open(fileobj=gz,mode='w|') as t:
  for r in rows:
   b=reader(r);assert len(b)==r['bytes'] and sha(b)==r['sha256'],r
   if 'blob' in r:assert hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==r['blob'],r
   info=tarfile.TarInfo(r['path']);info.size=len(b);info.mode=0o644;info.mtime=0;t.addfile(info,io.BytesIO(b))
 print(name,(out/name).stat().st_size,sha((out/name).read_bytes()))
def source(r):
 if r.get('retained'):return (HERE/'test-d3dim-palette-alpha-page-watch.js').read_bytes()
 p=subprocess.run(['git','-C',str(repo),'cat-file','blob',r['blob']],capture_output=True,timeout=120,preexec_fn=git_limits)
 if p.returncode:raise RuntimeError(f"Missing exact immutable blob {r['blob']} {r['path']}; recover this pinned object before continuing: {p.stderr[:8192]!r}")
 return p.stdout
archive('source.tar.gz',manifest['files'],source)
archive('pngjs.tar.gz',deps['files'],lambda r:(png/pathlib.PurePosixPath(r['path']).relative_to('node_modules/pngjs')).read_bytes())
