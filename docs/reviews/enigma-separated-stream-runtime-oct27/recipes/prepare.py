from work import *
M=ROOT/'scratch/usage-watch/enigma-exact-production-runtime-map-oct27.json';rows=json.loads(M.read_text())['rows']
dll=['system/msvcrt.dll']+['vfs/Enigma-1.01/'+s for s in ['zlib1.dll','libpng12-0.dll','SDL.dll','SDL_image.dll','SDL_mixer.dll','libfreetype-6.dll','SDL_ttf.dll']]
args=[NODE,'--max-old-space-size=2048',R+'/runner/test/run.js','--no-build','--wasm='+R+'/modules/wine-assembly.wasm','--exe='+R+'/vfs/Enigma-1.01/enigma.exe','--exe-guest-path=C:\\Enigma-1.01\\enigma.exe','--cwd=C:\\Enigma-1.01','--dlls='+','.join(R+'/'+p for p in dll),'--quiet-api','--quiet-blocks','--no-close','--memory-mb=512','--screen=640x480','--vfs-tree='+R+'/vfs','--quiet-fs','--control=18127','--trace-input','--frozen','--max-seconds=110','--max-batches=2000000']
c=dict(command=args,cwd=R+'/runner',url='http://127.0.0.1:18127/ctl',launch_dir=R+'/ops/launch',cutoff_at=1793076000,duration_seconds=110,ready_seconds=8,limits=dict(cpu=90,wall=120,physical=3221225472,file=25165824,output=2097152),controller=dict(max_batches=2000000,checkpoint_batches=1000000,after_action_batches=500000,cleanup_batches=256,max_captures=4,capture_bytes=2097152,width=640,height=480,checkpoint_seconds=35,after_action_seconds=20,review_seconds=25,request_timeout=3,cleanup_seconds=10,decision_path=R+'/ops/decision.json'))
save('launch-config.json',c)
env=dict(HOME='/home/user',PATH='/home/user/.nvm/versions/node/v24.22.1/bin:/usr/local/bin:/usr/bin:/bin',LANG='C.UTF-8',TZ='UTC',PYTHONDONTWRITEBYTECODE='1')
save('environment.json',dict(environment=env,sha256=sha(json.dumps(env,sort_keys=True).encode()),sanitized=True))
for p in ['/home/user/.ssh/wine_github_ed25519','/home/user/.ssh/wine_github_known_hosts']:
 assert pathlib.Path(p).is_file()
save('trusted-ssh.json',dict(command=SSH,keyPresent=True,knownHostsSHA256=sha(pathlib.Path('/home/user/.ssh/wine_github_known_hosts').read_bytes()),rootRefReceipt=json.loads((ROOT/'scratch/usage-watch'/TAG/'root-ref-digest.json').read_text())))
runner=next(pathlib.Path(r['path']) for r in rows if r['target']=='runner/test/run.js');src=runner.read_text();assert sha(runner.read_bytes())=='55be42cbcaedee9d7f56f578cd7d36841bba86861b38bf5d61a7a0415a880c2e'
parser=src[src.index('const getArg ='):src.index('// Was `--name=')]
code='const assert=require("assert"),fs=require("fs"),path=require("path"),crypto=require("crypto");const args='+json.dumps(args[3:])+';\n'+parser+'\n'
code+='const {expandIncludePatterns,guestPathInTree}=require('+json.dumps(R+'/runner/lib/vfs-host-files.js')+');const trees=getArgs("vfs-tree");assert.deepEqual(trees,['+json.dumps(R+'/vfs')+']);assert.equal(getArgs("dlls").length,8);assert.equal(getArgs("vfs-mount").length,0);assert(hasFlag("no-build")&&hasFlag("frozen"));const files=expandIncludePatterns(trees[0],["**/*"]);assert.equal(guestPathInTree(trees[0],getArg("exe")),getArg("exe-guest-path"));for(const p of getArgs("dlls"))assert(fs.statSync(p).isFile());const v={argv:args,dlls:getArgs("dlls"),files,commaBearingFiles:files.filter(f=>f.hostPath.includes(",")),parserSHA256:'+json.dumps(sha(parser.encode()))+'};fs.writeFileSync('+json.dumps(R+'/ops/mount-enumeration.json')+',JSON.stringify(v,null,2));console.log(JSON.stringify({PASS:true,fileCount:files.length,commaBearingCount:v.commaBearingFiles.length,enumerationSHA256:crypto.createHash("sha256").update(fs.readFileSync('+json.dumps(R+'/ops/mount-enumeration.json')+')).digest("hex"),parserSHA256:v.parserSHA256}));'
(O/'parser-check.cjs').write_text(code)
mode=[dict(target=r['target'],mode=pathlib.Path(r['path']).stat().st_mode&0o777) for r in rows];save('expected-modes.json',mode)
wrapper='''import os,sys,json,pathlib,subprocess,time,hashlib,resource
h=pathlib.Path(ROOT)
env=ENV
c=json.loads((h/'ops/launch-config.json').read_text())
assert time.time()+120 < c['cutoff_at']
assert int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024 >= 3758096384
assert (h/'ops/mount-check.json').is_file()
receipt=dict(at=time.time(),environment=env,environmentSHA256=hashlib.sha256(json.dumps(env,sort_keys=True).encode()).hexdigest(),inheritedLimits=pathlib.Path('/proc/self/limits').read_text(),configSHA256=hashlib.sha256((h/'ops/launch-config.json').read_bytes()).hexdigest(),identities={p:hashlib.sha256((h/p).read_bytes()).hexdigest() for p in ['runner/test/run.js','runner/lib/host-imports.js','modules/wine-assembly.wasm','runner/tools/enigma-supervised-gameplay.py','runner/tools/enigma-frozen-gameplay-controller.py','vfs/Enigma-1.01/enigma.exe']})
(h/'ops/startup-environment.json').write_text(json.dumps(receipt,indent=2))
with (h/'ops/supervisor-stdout.log').open('xb') as out,(h/'ops/supervisor-stderr.log').open('xb') as err:
 p=subprocess.Popen(['/usr/bin/python3',str(h/'runner/tools/enigma-supervised-gameplay.py'),'--launch-config',str(h/'ops/launch-config.json')],cwd=h/'runner',env=env,stdout=out,stderr=err,start_new_session=True)
 (h/'ops/supervisor-pid.json').write_text(json.dumps(dict(pid=p.pid,start=pathlib.Path('/proc/'+str(p.pid)+'/stat').read_text().split(') ')[1].split()[19])))
 try:r=p.wait(timeout=118)
 except subprocess.TimeoutExpired:
  p.terminate();r=p.wait(timeout=1)
 (h/'ops/cli-exit.json').write_text(json.dumps(dict(exit=r,at=time.time())))
print(json.dumps(dict(supervisorExit=r)))
'''.replace('ROOT',repr(R)).replace('ENV',repr(env))
(O/'launch.py').write_text(wrapper)
transfer([('ops/'+n,O/n) for n in ['launch-config.json','environment.json','parser-check.cjs','expected-modes.json','launch.py']]);print('configuration prepared; guest not started')
