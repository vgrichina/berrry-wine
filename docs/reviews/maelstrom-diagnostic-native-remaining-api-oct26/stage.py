import pathlib,json,shutil,os,subprocess,hashlib
from api import put,py,REMOTE
O=pathlib.Path(__file__).resolve().parent;R=O.parent/'repo';D=pathlib.Path('/tmp/maelstrom-diagnostic-changed-module-native-oct26/ops')
def admit(label):
 subprocess.run(['python3',str(O/'account.py')],env=dict(os.environ,CASE_ID=label),stdout=subprocess.DEVNULL,check=True)
 shutil.copyfile(O/('admission-'+label+'.json'),O/'local-stage-admission.json')
admit('stage-inputs')
r=py('import json,shutil; m=int(next(l.split()[1] for l in open("/proc/meminfo") if l.startswith("MemAvailable")))*1024; f=shutil.disk_usage("/home/user").free; print(json.dumps(dict(memAvailable=m,free=f))); assert m>=2684354560; assert f-67108864>=2982150144','fresh-remote-stage-admission')
(O/'remote-stage-admission.json').write_text(json.dumps(r,indent=2))
rows=[]
def stage(p,r):rows.append(put(p,REMOTE+'/'+r))
for n in ['errno-latch.wasm','errno-latch.compat.wasm','static-abi.json']:stage(D/n,'ops/'+n)
for n in ['maelstrom-native-errno-latch.cjs','maelstrom-select-completion-hook.cjs']:stage(R/'tools'/n,'repo/tools/'+n)
stage(R/'test/maelstrom-diagnostic-canonical-native.cjs','repo/test/maelstrom-diagnostic-canonical-native.cjs')
for n,p in dict(net='/tmp/maelstrom-original-win32-closure-oct24/extracted/Maelstrom-3.0.6/SDL_net.dll',exe='/tmp/maelstrom-original-win32-closure-oct24/extracted/Maelstrom-3.0.6/Maelstrom.exe',crt='/home/user/wine-assembly/test/binaries/dlls/msvcrt.dll').items():stage(p,'ops/anchors/'+n)
stage('/home/user/wine-assembly-shadow-man-native-bound-canonical-oct23/docs/re-notes/shadow-man-native-bound-canonical-20261023/native-module-bound.cjs','ops/native-module-bound.cjs')
for n in ['supervise.py','runtime.json','remote-account.py','anchor-paths.cjs','local-stage-admission.json']:stage(O/n,'ops/'+n)
(O/'transfers-inputs.json').write_text(json.dumps(rows,indent=2));print(json.dumps(dict(files=len(rows),bytes=sum(r['bytes'] for r in rows))))
