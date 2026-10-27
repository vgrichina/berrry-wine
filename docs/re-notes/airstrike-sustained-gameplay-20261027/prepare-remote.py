import sys,pathlib,json
H=pathlib.Path(__file__).parent;sys.path.insert(0,str(H));from transport import put,remote,R,save
p=pathlib.Path('/tmp/airstrike-retained-codec-gameplay-oct24/gameplay/abi-preload.cjs');b=p.read_text().replace('/home/user/airstrike-retained-oct24',R).encode();(H/'abi-preload.cjs').write_bytes(b);put('evidence/abi-preload.cjs',b);put('evidence/remote-supervisor.py',(H/'remote-supervisor.py').read_bytes())
r=remote('import subprocess,sys; p=subprocess.run([sys.executable,"'+R+'/evidence/remote-supervisor.py","startup"],capture_output=True,text=True,timeout=25);print(p.stdout);print(p.stderr);sys.exit(p.returncode)');save('remote-startup-api.json',r);print(r['stdout'])
