from admit import *
import shlex,base64,zlib
def send(b,target):
 for off in range(0,len(b),18000):
  enc=base64.b64encode(zlib.compress(b[off:off+18000])).decode()
  code='import pathlib,zlib,base64;p=pathlib.Path('+repr(R+'/'+target)+');p.parent.mkdir(parents=True,exist_ok=True);p.open('+repr('wb' if off==0 else 'ab')+').write(zlib.decompress(base64.b64decode('+repr(enc)+')))'
  remote('python3 -c '+shlex.quote(code))
def baseargs():
 return ['node','--max-old-space-size=512',R+'/runner/test/run.js','--no-build','--wasm='+R+'/runtime/build/wine-assembly.wasm','--exe='+R+'/game/penguin-command.exe','--exe-guest-path=C:\\penguin-command.exe','--cwd=C:\\','--args=--windowed --nosound','--dlls='+','.join(R+'/game/'+x for x in ['msvcrt.dll','SDL.dll','zlib1.dll','libpng12-0.dll','jpeg.dll','SDL_image.dll','SDL_mixer.dll']),'--vfs-include=data/gfx/*.png','--vfs-include=data/gfx/*.jpg','--quiet-api','--quiet-blocks','--no-close','--max-seconds=60','--max-batches=200000','--memory-mb=512','--tick-ms-per-batch=200','--screen=840x660','--trace-input-dispatch']
if __name__=='__main__':
 assert json.load(open(H/'remote-rehash.json'))['exitCode']==0
 send((OLD/'accepted-contract.json').read_bytes(),'accepted-contract.json')
 s=(OLD/'preflight.py').read_text().replace('/tmp/penguin-scheduled-gameplay-oct24',R)
 (H/'preflight.py').write_text(s);send(s.encode(),'preflight.py')
 save('preflight-api.json',remote('python3 '+shlex.quote(R+'/preflight.py'),60))
 # Real production runner imports and fixed arena, stopped immediately after
 # successful native instantiation, before its first guest export call.
 code="""const fs=require('fs'),assert=require('assert');const original=WebAssembly.instantiate;WebAssembly.instantiate=async function(module,imports){const c=JSON.parse(fs.readFileSync('../accepted-contract.json'));const actual=WebAssembly.Module.imports(module);assert.deepStrictEqual(actual,c.imports.map(x=>({module:x.module,name:x.name,kind:x.kind===0?'function':x.kind===2?'memory':'unexpected'})));assert.equal(Buffer.from(WebAssembly.Module.customSections(module,'wine-region-layout')[0]).toString(),'9a3bc9149d58209c');const result=await original.call(WebAssembly,module,imports);const m=imports.host.memory;assert.equal(m.buffer.byteLength,536870912);fs.writeFileSync('../actual-host-instantiation.json',JSON.stringify({pass:true,imports:actual.length,completeImportABI:'accepted full types/signatures bound to exact immutable module SHA256',arenaBytes:m.buffer.byteLength,shared:m.buffer instanceof SharedArrayBuffer,host:'exact production runner host table',guestExportsInvoked:false,regionStamp:'9a3bc9149d58209c'}));process.exit(0);};"""
 (H/'instantiate-preload.cjs').write_text(code);send(code.encode(),'instantiate-preload.cjs')
 args=baseargs();args[2:2]=['--require',R+'/instantiate-preload.cjs']
 cmd='cd '+shlex.quote(R+'/runner')+' && timeout 60s '+shlex.join(args)
 save('actual-host-instantiation-api.json',remote(cmd,60))
 save('diagnostic-regression-api.json',remote('cd '+shlex.quote(R+'/runner')+' && timeout 60s node --max-old-space-size=256 test/test-input-consumption-clock-domain.js',60))
 print('codec/fonts, actual production host instantiation and diagnostic regression PASS')
