import pathlib,json,hashlib,subprocess,importlib.util,os,re
H=pathlib.Path(__file__).resolve().parent.parent;O=H/'ops';OLD=pathlib.Path('/tmp/maelstrom-frozen-original-recovered-capture-oct25');sha=lambda b:hashlib.sha256(b).hexdigest()
def save(n,j):(O/n).write_text(json.dumps(j,indent=2)+'\n')
M=json.loads((OLD/'manifest.json').read_text())
for x in M:assert sha(pathlib.Path(x['path']).read_bytes())==x['sha256'],x['target']
# Recover exact original source from the independently pinned old adapter.
helper=OLD/'repo/tools/maelstrom-select-frozen-runner.cjs'
js='const fs=require("fs"),h=require(process.argv[1]);const frozen=fs.readFileSync(process.argv[2],"utf8"),original=fs.readFileSync(process.argv[3],"utf8");if(h.restore(frozen)!==original||h.transform(original,{enabled:true})!==frozen)throw Error("old exact runner mismatch");console.log("pass")'
p=subprocess.run(['node','--max-old-space-size=128','-e',js,str(helper),str(OLD/'runner/test/run.js'),'/tmp/maelstrom-head-yield-observer-oct24/ops/run.js'],capture_output=True,text=True,timeout=60);assert p.returncode==0,p.stderr
source=(OLD/'runner/test/run.js').read_text();start=source.index('  // Historical completion is latched inside select; host state is later.');end=source.index('\n  ctx.exports = instance.exports;',start)
setup='''  let mscFrozenAdapter = null;
  const mscFrozenFile = getArg('maelstrom-select-frozen-record', null);
  function mscFrozenObserve(batch) {
    if (!mscFrozenAdapter) throw Error('native adapter absent');
    try {
      const row = mscFrozenAdapter.observe(batch);
      if (row?.kind === 'captured') { console.log('[native-errno] captured'); process.exit(0); }
    } catch (err) { console.error('[native-errno] first rejection', err); process.exit(3); }
  }
'''
source=source[:start]+setup+source[end:]
anchor='  // Resolve any module-relative address specs now that all module bases are known.'
assert source.count(anchor)==1
inject='''  {
    const {verifyLoaded, createAdapter} = require('../tools/maelstrom-original-errno-adapter.cjs');
    const {verifyBinaries} = require('../tools/maelstrom-native-errno-latch.cjs');
    verifyBinaries({exe:fs.readFileSync(EXE_PATH),net:fs.readFileSync(DLL_NET_PATH),crt:fs.readFileSync(DLL_CRT_PATH)});
    const mapping=verifyLoaded(instance.exports,memory.buffer,moduleBases);
    fs.appendFileSync(mscFrozenFile,JSON.stringify({kind:'authentic-loader-verified',mapping,moduleBases})+'\\n');
    mscFrozenAdapter=createAdapter(instance,{
      persist:row=>fs.appendFileSync(mscFrozenFile,JSON.stringify(row)+'\\n'),
      readLive:()=>({eax:instance.exports.get_eax()>>>0,esp:instance.exports.get_esp()>>>0,eip:instance.exports.get_eip()>>>0,yield:instance.exports.get_yield_reason()>>>0})
    });
    mscFrozenAdapter.start();
  }
'''.replace('DLL_NET_PATH',json.dumps(str(H/'vfs/maelstrom/SDL_net.dll'))).replace('DLL_CRT_PATH',json.dumps(str(H/'runtime/system/msvcrt.dll')))
source=source.replace(anchor,inject+anchor)
(O/'run.js').write_text(source)
args=json.loads((OLD/'guest-args.json').read_text());args=[a.replace(str(OLD),str(H)) for a in args];args[0]='/home/user/.nvm/versions/node/v24.22.1/bin/node'
args=[a if not a.startswith('--wasm=') else '--wasm=/home/user/maelstrom-errno-api-canonical-native-oct25/ops/errno-latch.wasm' for a in args]
(H/'guest-args.json').write_text(json.dumps(args,indent=2)+'\n')
canonical=pathlib.Path('/tmp/maelstrom-startup-divergence-cause-oct24/repo/tools/maelstrom-startup-divergence.py');assert sha(canonical.read_bytes())=='0ffbfdee6d64f66613731e8a4fbc00883320ee623cdd9bc45c66362b81067394'
spec=importlib.util.spec_from_file_location('canonical',canonical);mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
effective=mod.effective_sizes(source,[args[:2]+['inert-placeholder']+args[2:]]);assert effective[0]['size']==1000
rows=[]
for x in M:
 if x['target'].startswith('runtime/build/'):continue
 p=O/'run.js' if x['target']=='runner/test/run.js' else pathlib.Path(x['path'])
 rows.append(dict(target=x['target'],path=str(p),bytes=p.stat().st_size,sha256=sha(p.read_bytes()),oldSHA256=x['sha256']))
for name in ['maelstrom-original-errno-adapter.cjs','maelstrom-native-errno-latch.cjs','maelstrom-select-completion-hook.cjs']:
 p=H/'repo/tools'/name
 rows=[r for r in rows if r['target']!='runner/tools/'+name]
 rows.append(dict(target='runner/tools/'+name,path=str(p),bytes=p.stat().st_size,sha256=sha(p.read_bytes())))
for target,p in [('guest-args.json',H/'guest-args.json'),('validate-tree.cjs',OLD/'validate-tree.cjs')]:
 rows.append(dict(target=target,path=str(p),bytes=p.stat().st_size,sha256=sha(p.read_bytes())))
(H/'manifest.json').write_text(json.dumps(rows,indent=2)+'\n')
save('prepare.json',dict(oldRunnerRoundtrip=True,originalSHA256=sha(pathlib.Path('/tmp/maelstrom-head-yield-observer-oct24/ops/run.js').read_bytes()),oldRunnerSHA256=sha((OLD/'runner/test/run.js').read_bytes()),runnerSHA256=sha(source.encode()),helperSHA256=sha(helper.read_bytes()),canonicalSHA256=sha(canonical.read_bytes()),effective=effective,argv=args,files=len(rows),bytes=sum(r['bytes'] for r in rows),guestStarts=0,moduleSHA256='a77709fb784a21e6775771450f54b709373f0cc8ad2d4878012c949eaae88f69'))
print(json.dumps(dict(prepared=True,files=len(rows),bytes=sum(r['bytes'] for r in rows))))
