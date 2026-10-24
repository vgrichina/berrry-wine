from work import *
old=H
save("remote-admission.json",py('import os,json,pathlib,shutil;print(json.dumps(dict(uid=os.getuid(),free=shutil.disk_usage("/tmp").free,memAvailable=int(pathlib.Path("/proc/meminfo").read_text().split("MemAvailable:")[1].split()[0])*1024)))'))
measure('pretransfer')
code=(H/'stage.py').read_text()
ns={'__name__':'stage','__file__':str(H/'stage.py')};exec(compile(code,str(H/'stage.py'),'exec'),ns)
for name in ['capture.cjs','supervise.py','preflight.py','validate-tree.cjs','guest-args.json','next-env.json']:
 ns['send']((H/name).read_bytes(),name)
for name in ['tools/enigma-findfirst-compat.cjs','tools/enigma-terminal-capture-guard.cjs','tools/enigma-quiet-filesystem.cjs','lib/filesystem.js','tools/lossless-capture-png.cjs','tools/enigma-supervisor-output.py']:
 ns['send']((H/'repo'/name).read_bytes(),'accepted/'+name)
# The unchanged preamble/real dependency probe is cheap, no guest or WASM instantiation.
save('preflight-api.json',remote('python3 '+shlex.quote(R+'/preflight.py'),65))
save('tree-validation-api.json',remote('node --max-old-space-size=256 '+shlex.quote(R+'/validate-tree.cjs'),60))
code='''const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto');
const base=ROOT, adapter=path.join(base,'accepted/tools/enigma-terminal-capture-guard.cjs');
const sibling=require.resolve('./lossless-capture-png.cjs',{paths:[path.dirname(adapter)]});
assert.strictEqual(sibling,path.join(base,'accepted/tools/lossless-capture-png.cjs'));
const sh=x=>crypto.createHash('sha256').update(fs.readFileSync(x)).digest('hex');
assert.strictEqual(sh(sibling),'9dae92170fbf4ef5acf0a2b0be43b93d3b3a7c8ec86f227df708d3b65d67cb4b');
assert.strictEqual(sh(adapter),'56399047e54417b7968944639831b2a5268ebb87ea57a64833d8dd1f0fb4384c');
const t=require(adapter),capture=path.join(base,'capture.cjs');
assert.strictEqual(sh(capture),'6d64a146f2daf8b598dbf13e3c13f890dbc783d8f5286aacba6d343758d22079');
const transformed=t.transformLosslessCapture(fs.readFileSync(capture,'utf8'));
assert(transformed.includes(JSON.stringify(sibling)));
const p=path.join(base,'ordinary-write-probe');fs.writeFileSync(p,'ordinary-user');assert.equal(fs.readFileSync(p,'utf8'),'ordinary-user');
console.log(JSON.stringify({sibling,adapter,originalCaptureSHA256:sh(capture),absoluteSiblingBound:true,ordinaryUserWrite:true}));'''.replace('ROOT',json.dumps(R))
save('sibling-resolution-api.json',remote('node --max-old-space-size=256 -e '+shlex.quote(code),60))
measure('ready');print('READY full streamed closure, accepted siblings, unchanged original capture, exact tree mounts',flush=True)
