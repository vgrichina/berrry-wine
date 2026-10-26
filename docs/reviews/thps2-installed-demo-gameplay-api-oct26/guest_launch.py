import os,pathlib,resource,subprocess,json,time,re,shutil
H=pathlib.Path('/tmp/thps2-installed-demo-gameplay-api-oct26')
mem=int(re.search(r'MemAvailable:\s+(\d+)',pathlib.Path('/proc/meminfo').read_text())[1])*1024
assert mem>=3758096384;assert time.time()+90<1793041800
assert shutil.disk_usage('/tmp').free-2000000>=2982150144
assert not (H/'guest/attempt-started.json').exists(),'one guest maximum'
(H/'guest/attempt-started.json').write_text(json.dumps(dict(at=time.time(),memAvailable=mem,physicalFloor=2684354560,remainingHeadroom=805306368,helpersTransient=268435456,liveGuestArenasBefore=0,prospectiveArena=536870912,oldSpace=536870912,supervisorOldSpace=201326592,cpu=90,wall=88,fsize=2097152,profile='single-frame',hardCombinedOutput=2097152)))
def limits():
 resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(2097152,2097152))
env={k:v for k,v in os.environ.items() if k not in ['NODE_OPTIONS','WINE_RUN_EXTRA_ARGS','WINE_REGION_MAP','WINE_ASSEMBLY_WASM','MAELSTROM_CAPTURE_INSTALL','ENIGMA_TERMINAL_CAPTURE_INSTALL']}
r=subprocess.run(['/home/user/.nvm/versions/node/v24.22.1/bin/node','--max-old-space-size=192',str(H/'ops/supervise.cjs')],env=env,cwd=H,preexec_fn=limits,timeout=100)
print(json.dumps(dict(supervisorExit=r.returncode)))
