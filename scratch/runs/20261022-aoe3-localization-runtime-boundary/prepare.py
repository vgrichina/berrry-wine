"""Stage only a diagnostic harness copy; retained runtime/originals are read only."""
import base64,datetime,hashlib,json,pathlib,subprocess,sys
E=pathlib.Path(__file__).resolve().parent
R='/home/user/aoe3-original-oct22'
D=R+'/diagnostics-localization-boundary-20261022T0950Z'
def run(code,name):
 p=subprocess.run(['boat','exec','--json','bx_5mu9dnhg','--','python3','-c',code],capture_output=True,text=True)
 r=json.loads(p.stdout);(E/(name+'.json')).write_text(json.dumps(r,indent=2)+'\n')
 assert p.returncode==0 and r.get('exitCode')==0,r
 return r
def main():
 original=(E/'historical-run.js').read_text();assert hashlib.sha256(original.encode()).hexdigest()=='1b4d1a43fc6167ed51328b1cb13c66d5114e35955f505d935279f1ec8cf49799'
 modified=original.replace("const ROOT = path.join(__dirname, '..');",'const ROOT = '+json.dumps(R+'/runtime')+';')
 # Resolve every existing relative require and test fixture lookup to its exact
 # retained original location. This is a path relocation, not a runtime change.
 import re
 modified=re.sub(r"require\('((?:\.\.?/)[^']+)'\)",lambda m:'require('+json.dumps(str(pathlib.PurePosixPath(R+'/runtime/test')/m[1]))+')',modified)
 modified=modified.replace("path.join(__dirname, 'binaries', 'dlls')",'path.join(ROOT, "test", "binaries", "dlls")')
 modified=modified.replace('__dirname',json.dumps(R+'/runtime/test'))
 anchor='  const apiNameCache = new Map();'
 assert modified.count(anchor)==1
 modified=modified.replace(anchor,anchor+'\n  const boundaryObserver = require('+json.dumps(D+'/observer.js')+')(x => console.log("[BOUNDARY] " + JSON.stringify(x)), RegionMap);')
 anchor='    apiCount++;';assert modified.count(anchor)==1
 modified=modified.replace(anchor,'    boundaryObserver.api(t, instance.exports, memory, translateGuest, "entry");\n'+anchor)
 anchor='    h.log_api_exit = () => {';assert modified.count(anchor)==1
 modified=modified.replace(anchor,anchor+'\n      if (lastApiName) boundaryObserver.api(lastApiName, instance.exports, memory, translateGuest, "exit");')
 start=modified.index('    h.log_eip = (eip) => {',modified.index('  if (traceEipOn) {'))
 end=modified.index('\n    };',start)+len('\n    };')
 modified=modified[:start]+'    h.log_eip = eip => boundaryObserver.block(eip, instance.exports, memory, translateGuest);'+modified[end:]
 (E/'diagnostic-run.js').write_text(modified)
 import difflib
 (E/'harness.patch').write_text(''.join(difflib.unified_diff(original.splitlines(True),modified.splitlines(True),fromfile='historical/test/run.js',tofile='diagnostics/diagnostic-run.js')))
 for f in ['observer.js','diagnostic-run.js']:
  subprocess.run(['node','--check',str(E/f)],check=True)
 subprocess.run(['node',str(E/'control-test.js')],check=True)
 code='''import pathlib,base64,json,hashlib,datetime,os
r=pathlib.Path(%r);d=pathlib.Path(%r);assert not d.exists();assert datetime.datetime.now(datetime.timezone.utc)<datetime.datetime.fromisoformat("2026-10-22T10:15:00+00:00")
pins=json.loads((r/"runtime-pins.json").read_text())
pins += [dict(x,path="../installed/"+x["path"]) for x in json.loads((r/"installed-audit/installed-manifest.json").read_text())["files"]]
for x in pins:
 p=r/"runtime"/x["path"];assert p.stat().st_size==x["size"] and hashlib.file_digest(p.open("rb"),"sha256").hexdigest()==x["sha256"],str(p)
d.mkdir()
(d/"package.json").write_text('{"type":"commonjs"}')
(d/"preflight.json").write_text(json.dumps(dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),pins=len(pins),passAll=True,free=os.statvfs(r).f_bavail*os.statvfs(r).f_frsize),indent=2))
print((d/"preflight.json").read_text())
'''%(R,D)
 if '--refresh' not in sys.argv:print(run(code,'stage')['stdout'])
 else:run('import pathlib; d=pathlib.Path(%r); assert not (d/"launch.json").exists() or ((d/"exit.json").exists() and "Cannot find module" in (d/"output.log").read_text() and "WASM" not in (d/"output.log").read_text())'%D,'refresh-prelaunch-guard')
 for f in ['observer.js','diagnostic-run.js','driver.py']:
  b=(E/f).read_bytes()
  for offset in range(0,len(b),50000):
   chunk=base64.b64encode(b[offset:offset+50000]).decode()
   run('import pathlib,base64; p=pathlib.Path(%r); f=p.open(%r); f.write(base64.b64decode(%r));f.close()'%(D+'/'+f,'wb' if offset==0 else 'ab',chunk),'transfer-'+f+'-'+str(offset))
  receipt=run('import pathlib,hashlib; p=pathlib.Path(%r);assert hashlib.sha256(p.read_bytes()).hexdigest()==%r;print(p.stat().st_size)'%(D+'/'+f,hashlib.sha256(b).hexdigest()),'verify-'+f)
  print(f,receipt['stdout'].strip())
if __name__=='__main__':main()
