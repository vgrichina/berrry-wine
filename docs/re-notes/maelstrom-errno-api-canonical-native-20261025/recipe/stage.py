import pathlib,json,shutil,sys,hashlib
from api import put,py,REMOTE
O=pathlib.Path(__file__).resolve().parent;R=O.parent/'repo';C=pathlib.Path('/home/user/wine-assembly-shadow-man-span-static-canonical-oct23')
def stage(p,r):
 row=put(p,REMOTE+'/'+r);rows.append(row)
rows=[]
if sys.argv[1]=='inputs':
 m=json.load(open(C/'docs/re-notes/shadow-man-span-static-canonical-20261023/manifest.json'))
 shutil.copyfile(C/'docs/re-notes/shadow-man-span-static-canonical-20261023/manifest.json',O/'manifest.json')
 stage(O/'sources.json.gz','ops/sources.json.gz')
 for row in m['files']:
  if not row['path'].startswith('src/'):stage(C/row['path'],'canonical/'+row['path'])
 for name,p in dict(net='/tmp/maelstrom-original-win32-closure-oct24/extracted/Maelstrom-3.0.6/SDL_net.dll',exe='/tmp/maelstrom-original-win32-closure-oct24/extracted/Maelstrom-3.0.6/Maelstrom.exe',crt='/home/user/wine-assembly/test/binaries/dlls/msvcrt.dll').items():stage(p,'ops/anchors/'+name)
 for name in ['manifest.json','compressed-projection.json','pinned-inputs.json','configuration.json']:stage(O/name,'ops/'+name)
 guard=pathlib.Path('/home/user/wine-assembly-shadow-man-native-bound-canonical-oct23/docs/re-notes/shadow-man-native-bound-canonical-20261023/native-module-bound.cjs')
 assert hashlib.sha256(guard.read_bytes()).hexdigest()=='47ce2e2b835be33eab6b2b24f027ecaab8ceb61c559890e51548c78199beb197'
 stage(guard,'ops/native-module-bound.cjs')
 for name in ['maelstrom-select-completion-hook.cjs','maelstrom-native-errno-latch.cjs','maelstrom-errno-canonical-build.cjs']:stage(R/'tools'/name,'repo/tools/'+name)
 for name in ['supervise.py','runtime.json','remote-account.py']:stage(O/name,'ops/'+name)
elif sys.argv[1]=='file':stage(sys.argv[2],sys.argv[3])
(O/('transfers-'+sys.argv[1]+'.json')).write_text(json.dumps(rows,indent=2));print(json.dumps(dict(transferredFiles=len(rows),bytes=sum(r['bytes'] for r in rows))))
