from work import *
import resource
def send(b,target):
 for off in range(0,len(b),18000):
  code='import pathlib,base64,zlib;p=pathlib.Path('+repr(str(H/target))+');p.parent.mkdir(parents=True,exist_ok=True);p.open('+repr('wb' if off==0 else 'ab')+').write(zlib.decompress(base64.b64decode('+repr(base64.b64encode(zlib.compress(b[off:off+18000])).decode())+')));print("sent")'
  remote('python3 -c '+shlex.quote(code))
for n in ['capture.cjs','preflight.py','validate-tree.cjs','supervise.py','guest-args.json']:
 send((H/n).read_bytes(),n)
tool=H/'repo/tools/maelstrom-breakpoint-boundary-audit.cjs';assert sha(tool.read_bytes())=='06a54af6c2150589b1848c1a5223682b793ead57c34258142bf83acaa6961c80'
wat=pathlib.Path('/tmp/maelstrom-native-errno-capture-oct24/closeout-13-exports.wat');assert sha(wat.read_bytes())=='739397dc54a77e93b367334fd4ca96c921180f57a7558913a3301f1de4520b86'
send(tool.read_bytes(),'boundary-audit.cjs');send(wat.read_bytes(),'13-exports.wat')
cmd='ulimit -t 60; cd '+shlex.quote(str(H))+' && python3 -c '+shlex.quote('import pathlib,re;assert int(re.search(r"MemAvailable:\\s+(\\d+)",pathlib.Path("/proc/meminfo").read_text())[1])*1024>=805306368')+' && node --max-old-space-size=256 boundary-audit.cjs --enable runner/test/run.js 13-exports.wat runner/test/run-boundary.js && node --max-old-space-size=256 --check runner/test/run-boundary.js && python3 preflight.py && node --max-old-space-size=256 validate-tree.cjs'
save('final-gates-api.json',remote(cmd,60))
account('preguest')
save('guest-supervisor-api.json',remote('python3 '+shlex.quote(str(H/'supervise.py'))+' guest',70))
print('ONE guest completed; collection pending',flush=True)
