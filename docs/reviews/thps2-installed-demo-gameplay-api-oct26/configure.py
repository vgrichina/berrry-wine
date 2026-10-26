from common import *
R=str(H); node='/home/user/.nvm/versions/node/v24.22.1/bin/node'
timeline=[]
def step(ms,actions,label):timeline.append(dict(ms=ms,actions=actions,label=label))
for ms,label in [(20000,'main-menu to single-session'),(28000,'single-session to skater'),(36000,'Tony Hawk to level'),(44000,'Marseille to loading/Play')]:
 step(ms,['keydown:13'],label);step(ms+400,['keyup:13'],'release Enter')
step(19000,['png:'+R+'/guest/menu.png'],'menu checkpoint')
step(64000,['keydown:38','keydown:32'],'Up+Space; Space may dismiss Play')
step(65800,['keyup:38','keyup:32'],'release Up+Space')
step(68300,['png:'+R+'/guest/after-up-space.png','keydown:37'],'movement checkpoint; begin Left')
step(70100,['keyup:37'],'release Left')
timeline.sort(key=lambda e:e['ms']);save('input-timeline.json',timeline)
entries=[]
for i,e in enumerate(timeline):entries += [f'{2*i}:wait-go']+[f'{2*i+1}:{action}' for action in e['actions']]
args=[node,'--max-old-space-size=512',R+'/runner/test/run.js','--no-build','--wasm='+R+'/runtime/build/wine-assembly.wasm','--exe='+R+'/vfs/THPS2/thawk2.exe','--exe-guest-path=C:\\THPS2\\thawk2.exe','--cwd=C:\\THPS2','--dlls='+R+'/vfs/THPS2/binkw32.dll','--vfs-tree='+R+'/vfs','--quiet-api','--quiet-blocks','--no-close','--real-ticks','--memory-mb=512','--screen=640x480','--max-seconds=76','--max-batches=10000000','--trace-api=LoadLibraryA,GetProcAddress,ExitProcess,MessageBoxA,MessageBoxW','--trace-api-dedup','--png='+R+'/guest/final.png','--input='+','.join(entries)]
save('guest-args.json',args)
s=pathlib.Path('/tmp/maelstrom-head-yield-observer-oct24/ops/run.js').read_text();assert hashlib.sha256(s.encode()).hexdigest()=='4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809'
parser=s[s.index('const getArg ='):s.index('// Was `--name=...`')]
code='const assert=require("assert"),args='+json.dumps(args[3:])+';'+parser+';assert.deepEqual(getArgs("vfs-tree"),['+json.dumps(R+'/vfs')+']);assert.deepEqual(getArgs("dlls"),['+json.dumps(R+'/vfs/THPS2/binkw32.dll')+']);assert.equal(getArg("input").split(",").filter(x=>x.endsWith(":wait-go")).length,13); console.log(JSON.stringify({tree:getArgs("vfs-tree"),dlls:getArgs("dlls"),waitGo:13}));'
p=subprocess.run(['/home/user/.nvm/versions/node/v24.18.1/bin/node','--max-old-space-size=192','-e',code],capture_output=True,text=True,timeout=20)
assert p.returncode==0,p.stderr
save('mount-parser.json',dict(passGate=True,canonicalRunnerSHA256=hashlib.sha256(s.encode()).hexdigest(),actualArgv=args,parser=json.loads(p.stdout),intendedFiles=[dict(name=pathlib.Path(e['path']).name,guest='C:\\THPS2\\'+pathlib.Path(e['path']).name,sha256=e['sha256']) for e in json.load(open(O/'manifest.json')) if e['target'].startswith('vfs/')],commaFiles=[],spaceFilename='demo readme.rtf',treePreservesNames=True))
print('PASS canonical mount argv/input schedule')
