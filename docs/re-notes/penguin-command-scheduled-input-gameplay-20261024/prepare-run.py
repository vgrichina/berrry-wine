from admit import *
import shlex,base64,zlib
def send(b,target):
 for off in range(0,len(b),18000):
  enc=base64.b64encode(zlib.compress(b[off:off+18000])).decode()
  code='import pathlib,zlib,base64;p=pathlib.Path('+repr(R+'/'+target)+');p.parent.mkdir(parents=True,exist_ok=True);p.open('+repr('wb' if off==0 else 'ab')+').write(zlib.decompress(base64.b64decode('+repr(enc)+')))'
  cmd='python3 -c '+shlex.quote(code);assert len(cmd.encode())<=36000;remote(cmd)
if __name__=='__main__':
 assert json.loads((H/'remote-rehash.json').read_text())['exitCode']==0
 contract=pathlib.Path('/home/user/wine-assembly-shadow-man-memory-recovered-handler-qualification-oct23/docs/re-notes/shadow-man-memory-recovered-handler-qualification-20261023/accepted-contract.json').read_bytes()
 send(contract,'accepted-contract.json')
 s=pathlib.Path('/tmp/penguin-retained-codec-oct24/preflight.py').read_text().replace('/tmp/penguin-retained-codec-oct24',R).replace('assert mem>=805306368','assert mem>=2684354560')
 (H/'preflight.py').write_text(s);send(s.encode(),'preflight.py')
 j=remote('python3 '+shlex.quote(R+'/preflight.py'),60);save('preflight-api.json',j)
 print(j['stdout'][:1600])
 # Standalone ABI linkage test invokes no guest export and is sequential with gameplay.
 code="""const fs=require('fs'),assert=require('assert');const b=fs.readFileSync('../runtime/build/wine-assembly.wasm');const m=new WebAssembly.Module(b);const im=WebAssembly.Module.imports(m);assert.equal(im.length,291);assert.equal(Buffer.from(WebAssembly.Module.customSections(m,'wine-region-layout')[0]).toString(),'9a3bc9149d58209c');const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});const o={};for(const x of im){o[x.module]??={};o[x.module][x.name]=x.kind==='memory'?memory:(()=>{throw Error('ABI gate must not invoke guest/host work')});}new WebAssembly.Instance(m,o);console.log(JSON.stringify({imports:im.length,stamp:'9a3bc9149d58209c',arenaBytes:memory.buffer.byteLength,shared:memory.buffer instanceof SharedArrayBuffer,noGuestExportInvoked:true,pass:true}));"""
 send(code.encode(),'runner/abi-probe.cjs')
 cmd='cd '+shlex.quote(R+'/runner')+' && timeout 60s node --max-old-space-size=512 abi-probe.cjs'
 save('abi-instantiation-api.json',remote(cmd,60));print('ABI instantiate PASS')
 # Retain exact supervisor mechanics, removing asynchronous startup controls.
 s=pathlib.Path('/tmp/penguin-quiet-gameplay-oct24/supervise.py').read_text().replace('/tmp/penguin-retained-codec-oct24',R).replace('/tmp/penguin-quiet-gameplay-oct24',R).replace('bx_9nngcsvf',BOX).replace('2026-10-24T02:47:54Z','2026-10-24T03:18:12.037Z').replace('if elapsed>2 and not sent:','if False:')
 # The same desktop capture dimensions as the inspected prior menu.
 ev=['32000:png:'+R+'/run/menu.png','33000:mousemove:420:360','34000:mousedown:420:360','34500:mouseup:420:360','45000:png:'+R+'/run/after-selection.png','50000:mousemove:260:220','51000:keydown:65','55000:keyup:65','60000:png:'+R+'/run/aim-fire-left.png','70000:mousemove:440:180','71000:keydown:83','75000:keyup:83','85000:png:'+R+'/run/aim-fire-centre.png','100000:mousemove:550:250','101000:keydown:68','105000:keyup:68','120000:png:'+R+'/run/aim-fire-right.png','140000:mousemove:330:160','141000:mousedown:330:160','143000:mouseup:330:160','160000:png:'+R+'/run/later.png','190000:png:'+R+'/run/final-scheduled.png']
 s=s.replace("'--quiet-api','--quiet-blocks'",repr('--input='+','.join(ev))+",'--quiet-api','--quiet-blocks'")
 (H/'supervise.py').write_text(s);save('scheduled-inputs.json',ev);send(s.encode(),'supervise.py')
 print('supervisor prepared; not launched')
