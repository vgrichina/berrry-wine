import sys,json,pathlib,subprocess
B=pathlib.Path(__file__).parent;R=pathlib.Path('/home/user/wine-assembly/scratch/runs')/B.name
for arg in sys.argv[1:]:
 if arg.startswith('step:'):req={'action':'step','n':int(arg.split(':')[1])}
 elif arg.startswith('png:'):
  assert len(list(R.glob('*.png')))<20
  req={'action':'png','path':str(R/(arg.split(':')[1]+'.png'))}
 elif arg in ['snapshot','quit']:req={'action':arg}
 else:req={'cmd':arg}
 p=subprocess.run(['python3',str(B/'control.py'),json.dumps(req)],capture_output=True,text=True)
 print(p.stdout.strip());assert p.returncode==0,p.stderr
 if req.get('action')=='step':
  o=json.loads(p.stdout);assert o.get('ok')
  p=subprocess.run(['python3',str(B/'control.py'),'{"action":"snapshot"}'],capture_output=True,text=True)
  print(p.stdout.strip());assert p.returncode==0
