from control import *
PIN='1e4fdb06f64e5f14ddec582111dfe7ecb71df6ba';D='/tmp/generally-census-accepted-main-integration-oct27/repo'
assert os.environ['GIT_SSH_COMMAND']==SSH
save('launch-identity.json',dict(ssh=SSH,rootRefReceipt=str(ROOT/'scratch/usage-watch'/H.name/'root-ref-digest.json'),source=PIN,box='bx_cqss3x42',guestCutoff='2026-10-27T14:08:00Z',handback='2026-10-27T14:12:00Z',shutdown='2026-10-27T14:15:00Z',expiry='2026-10-27T14:27:50.265Z'))
run('runner-blob',['git','-C',D,'show',PIN+':test/run.js'],'git')
b=(O/'runner-blob.stdout').read_bytes();assert b==pathlib.Path('/tmp/gta2-fullscreen-mode-cause-repair-oct27/ops/canonical-runner.txt').read_bytes()
save('runner-pin.json',dict(sha256=sha(b),bytes=len(b),source=PIN))
parser=b.decode();start=parser.index('const getArg = ');end=parser.index('const hasFlag = ',start)
code='const fs=require("fs");const args=["--app=gta2_demo"];'+parser[start:end]+';if(getArg("app",null)!=="gta2_demo")throw Error("parser");console.log(JSON.stringify({actualFilenameMountArgv:[],app:getArg("app",null),reason:"registered requiredFiles route; no extra filename-bearing mounts",limits:fs.readFileSync("/proc/self/limits","utf8"),version:process.version}));'
(O/'parser-check.cjs').write_text(code)
run('parser-check',['/usr/bin/env','-u','NODE_OPTIONS','node',str(O/'parser-check.cjs')],'node')
def git(label,args):run(label,['git','-c','gc.auto=0','-c','pack.threads=1','-c','pack.window=0',*args],'git')
git('init',['init',str(R)]);(R/'.git/objects/info/alternates').write_text(D+'/.git/objects\n')
git('sparse',['-C',str(R),'config','core.sparseCheckout','true']);(R/'.git/info/sparse-checkout').write_text('/reports/'+H.name+'/\n')
git('checkout',['-C',str(R),'checkout','-b','task/'+H.name,PIN]);git('remote',['-C',str(R),'remote','add','origin','git@github.com:vgrichina/wine-assembly.git']);git('name',['-C',str(R),'config','user.name','Wine Ops Worker']);git('email',['-C',str(R),'config','user.email','wine-ops@local'])
print('PASS sparse report checkout only')
