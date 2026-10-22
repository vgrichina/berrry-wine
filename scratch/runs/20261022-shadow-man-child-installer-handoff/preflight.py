import sys,pathlib,json,hashlib,os,subprocess
R=pathlib.Path('/home/user/shadow-man-original-oct22'); O=pathlib.Path('/home/user/shadow-man-child-installer-handoff-oct22');O.mkdir(exist_ok=True)
sys.path.insert(0,'/home/user/shadow-man-real-clock-extraction-oct22')
import preflight as old
rows=old.seals(); previous=old.previous_capture_seals()
for p in sorted(pathlib.Path('/home/user/shadow-man-real-clock-extraction-oct22').rglob('*')):
 if p.is_file():previous.append(dict(path=str(p),size=p.stat().st_size,sha256=old.sha(p)))
assert os.statvfs(O).f_bavail*os.statvfs(O).f_frsize>=4*1024**3+144*1024**2
runner=(R/'runtime/test/run.js').read_text(); assert hashlib.sha256(runner.encode()).hexdigest()=='1b4d1a43fc6167ed51328b1cb13c66d5114e35955f505d935279f1ec8cf49799'
assert '...PIPE_CHILD_ARGS' in runner and "getArg('pipe-child-args'" in runner
assert '`--wasm=${WASM_PATH}`' in runner and '`--max-seconds=${MAX_SECONDS || 600}`' in runner
assert 'forceSpawn || SPAWN_PROCESSES_FLAG' in runner
files=['test/run.js','lib/vfs-export.js','lib/guest-clock.js','lib/host-imports.js','lib/process-boot.js','host.js']
for f in files:
 p=R/'runtime'/f;(O/('source-'+f.replace('/','_'))).write_bytes(p.read_bytes())
code="const{createRequire}=require('module');const r=createRequire(process.cwd()+'/test/run.js');for(const f of ['../lib/vfs-export','../lib/guest-clock','../lib/host-imports','../lib/process-boot','../host','pngjs'])r(f);console.log('closure require PASS');"
p=subprocess.run(['node','-e',code],cwd=R/'runtime',env=dict(os.environ,NODE_PATH=str(R/'runner/node_modules')),capture_output=True,text=True);assert p.returncode==0,p.stderr
out=dict(passAll=True,seals=rows,previous=previous,conflicts=old.conflicts(),requireCheck=dict(exit=p.returncode,stdout=p.stdout,stderr=p.stderr),transport='spawnVfsChild from genuine WinExec process_spawn; fork same runner/module; explicit pipe-child-args real ticks',reuse='saved partial VFS lacks complete original mounted source closure and original WinExec command; use one original parent run',remoteFree=os.statvfs(O).f_bavail*os.statvfs(O).f_frsize)
(O/'preflight.json').write_text(json.dumps(out,indent=2)); print(json.dumps({k:v for k,v in out.items() if k not in ['seals','previous']}))
