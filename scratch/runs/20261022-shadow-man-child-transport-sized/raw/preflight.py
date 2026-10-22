import pathlib,sys,json,os,subprocess,hashlib
O=pathlib.Path('/home/user/shadow-man-child-transport-sized-oct22');R=pathlib.Path('/home/user/shadow-man-original-oct22')
import importlib.util
_spec=importlib.util.spec_from_file_location('accepted_preflight','/home/user/shadow-man-real-clock-extraction-oct22/preflight.py');old=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(old)
def sha(p):return hashlib.file_digest(p.open('rb'),'sha256').hexdigest()
def previous():
 rows=old.previous_capture_seals()
 for base in ['shadow-man-real-clock-extraction-oct22','shadow-man-child-installer-handoff-oct22']:
  for p in sorted(pathlib.Path('/home/user',base).rglob('*')):
   if p.is_file():rows.append(dict(path=str(p),size=p.stat().st_size,sha256=sha(p)))
 return rows
if __name__=='__main__':
 assert not (O/'attempt.json').exists()
 assert os.statvfs(O).f_bavail*os.statvfs(O).f_frsize>=4*1024**3+272*1024**2
 prior=json.loads(pathlib.Path('/home/user/shadow-man-child-installer-handoff-oct22/preflight.json').read_text())
 assert old.seals()==prior['seals'];old.conflicts()
 for r in prior['previous']:
  p=pathlib.Path(r['path']);assert p.stat().st_size==r['size'] and sha(p)==r['sha256']
 src=(R/'runtime/test/run.js').read_text();assert hashlib.sha256(src.encode()).hexdigest()=='1b4d1a43fc6167ed51328b1cb13c66d5114e35955f505d935279f1ec8cf49799'
 assert "(getArg('pipe-child-args', '') || '').split(' ').filter(Boolean)" in src
 assert 'const written = saveVfsToHost(vfs, inDir);' in src
 assert json.loads(pathlib.Path('/home/user/shadow-man-child-installer-handoff-oct22/transport-check.stdout').read_text())['passAll']
 p=subprocess.run(['node',str(O/'observer-fixture.cjs')],cwd=R/'runtime',env=dict(os.environ,NODE_PATH=str(R/'runner/node_modules')),capture_output=True,text=True)
 (O/'observer-fixture.json').write_text(json.dumps(dict(exitCode=p.returncode,stdout=p.stdout,stderr=p.stderr),indent=2));assert p.returncode==0,p.stderr
 out=dict(passAll=True,seals=old.seals(),previous=previous(),freeBytes=os.statvfs(O).f_bavail*os.statvfs(O).f_frsize,projectedSnapshots=147993212,cap=256*1024**2,reserve=16*1024**2,transport='unchanged spawnVfsChild, full source input and output authorized',realTicks='parent --real-ticks plus --pipe-child-args=--real-ticks',**old.conflicts())
 (O/'preflight.json').write_text(json.dumps(out,indent=2));print(json.dumps({k:v for k,v in out.items() if k not in ['seals','previous']}))
