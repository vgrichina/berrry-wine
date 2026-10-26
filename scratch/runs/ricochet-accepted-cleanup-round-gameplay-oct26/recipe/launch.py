from prepare import *
gate('before-startup')
assert time.time()+150<1793058540
argv=json.loads((O/'guest-args.json').read_text())
source=next(pathlib.Path(x['source']) for x in json.loads((O/'inputs.json').read_text())['files'] if x['target']=='runner/test/run.js').read_text()
part=source[source.index('const getArg ='):source.index('// Was `--name=...`')]
js="const fs=require('fs'),args="+json.dumps(argv[3:])+";"+part+";if(getArg('app')!=='ricochet_xtreme'||getArg('wasm')!=="+json.dumps(R+'/current.wasm')+"||getArg('d3d9-renderer')!=='software'||!hasFlag('frozen')||!hasFlag('no-build')||getArgs('vfs-mount').length)throw Error('canonical parser mismatch');console.log(JSON.stringify({exec:process.execPath,flags:process.execArgv.slice(0,1),limits:fs.readFileSync('/proc/self/limits','utf8'),environment:process.env,parser:'PASS',memory:process.memoryUsage(),versions:process.versions}));"
save('startup-args.json',argv[:2]+['-e',js])
transfer([(n,O/n) for n in ['guest-args.json','startup-args.json','supervisor.py','serial.py']])
save('startup-api.json',remote('python3 -S '+R+'/supervisor.py startup',timeout=15))
j=py('import pathlib,json;h=pathlib.Path('+repr(R)+');print(json.dumps(dict(terminal=json.loads((h/"startup/terminal.json").read_text()),output=(h/"startup/output.log").read_text())))')
save('node-startup.json',j);v=json.loads(j['stdout']);assert v['terminal']['returncode']==0 and v['terminal']['reason']=='natural';assert '"parser":"PASS"' in v['output']
gate('before-guest')
rm=py('import pathlib,json,shutil;h=pathlib.Path('+repr(R)+');print(json.dumps(dict(mem=int(pathlib.Path("/proc/meminfo").read_text().split("MemAvailable:")[1].split()[0])*1024,free=shutil.disk_usage("/tmp").free,allocated=sum(p.lstat().st_blocks*512 for p in [h,*h.rglob("*")]))))')
v=json.loads(rm['stdout']);assert v['mem']>=3758096384 and v['allocated']+201326592<=268435456 and v['free']-max(0,268435456-v['allocated'])>=2982150144;save('remote-before-guest.json',v)
save('production-launch.json',remote('python3 -S '+R+'/supervisor.py guest',detach=True))
save('checkpoint.json',dict(phase='ONE ACTUAL GUEST STARTED; no replay/relaunch',at=time.time(),box=BOX))
print('ONE GUEST STARTED',flush=True)
