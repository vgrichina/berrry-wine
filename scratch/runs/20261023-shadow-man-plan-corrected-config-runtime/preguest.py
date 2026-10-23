"""Complete exact-command and consumption gate; no guest invocation."""
import pathlib,json,os,hashlib,subprocess,socket,shutil,datetime
R=pathlib.Path('/home/user/shadow-man-launcher-configuration-capture-oct23');F=R/'fixed';I=R/'immutable';M=R/'mutable';RT=I/'runtime'
def sha(p):
 with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def alloc(p):return sum(x.lstat().st_blocks*512 for x in [p,*p.rglob('*')])
def main():
 g=json.loads((F/'hash-gate.json').read_text());assert g['passAll']
 assert datetime.datetime.now(datetime.timezone.utc)<datetime.datetime(2026,10,23,1,10,tzinfo=datetime.timezone.utc)
 assert os.getuid()==1000 and M.stat().st_uid==1000
 assert all(not p.is_symlink() and not p.stat().st_mode&0o222 for p in [I,*I.rglob('*')])
 files=[p for p in (I/'restored/parent-vfs').rglob('*') if p.is_file()];assert len(files)==2045
 for p in files:assert sha(p)==sha(M/'vfs'/p.relative_to(I/'restored/parent-vfs'))
 assert sha(M/'registry.json')==g['registrySHA256']=='d7143f29d29576cd015ec875264028fa70795d0f18de457e31927048081d9de3'
 game=M/'vfs/program files/acclaim entertainment/shadowman'
 native={n:sha(game/n) for n in ['d3dconfigutility.exe','mss32.dll','dsetup.dll']}
 assert native=={'d3dconfigutility.exe':'850c69cfa4a0d610072a67763d54179bc4cdc58875560ce5ede33bfa44d19fe0','mss32.dll':'09e2dec3d1e996571fb2c95e5de393410d486f1728c86473b550282edd83588c','dsetup.dll':'5112c736fa664cfd658c465fad781fe7ffd2753470cbcf7019b5a6ab08c4800f'}
 dep=json.loads((F/'dependency-preflight.json').read_text());assert dep['png']['roundTrip'] and 'tools/ctl.js' in dep['visited']
 expected={'@node-3d/glfw','@node-3d/webgl','skia-canvas','../tools/watx-closure.js','./region-layout.js','../tools/diablo-gameplay-bench','../tools/build-page-translation-stats.js','./tools/disasm','../tools/dump_sprites'}
 assert {x['spec'] for x in dep['missing']}==expected
 # These are accepted conditional paths; planned command selects raster/default,
 # no-build/canonical, and none of the named experiment/dump/report flags.
 env=dict(PATH='/bin:/usr/bin',HOME='/home/user',LANG='C.UTF-8',NODE_PATH=str(RT/'node_modules'),TMPDIR=str(M/'output/tmp'),TMP=str(M/'output/tmp'),TEMP=str(M/'output/tmp'))
 code="const fs=require('fs'),crypto=require('crypto');const b=fs.readFileSync('"+str(RT/'build/wine-assembly.wasm')+"');WebAssembly.compile(b).then(m=>console.log(JSON.stringify({pass:true,bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex'),module:m instanceof WebAssembly.Module,sourceCompilation:false,guestInstances:0}))).catch(e=>{console.error(e);process.exitCode=1})"
 cmd=['node','--require',str(F/'compile-guard.cjs'),'-e',code,'--','--guard-selftest']
 p=subprocess.run(cmd,env=env,capture_output=True,text=True,timeout=10);out=dict(command=cmd,exit=p.returncode,stdout=p.stdout,stderr=p.stderr);(F/'canonical-consumption-fixture.json').write_text(json.dumps(out,indent=2)+'\n');assert p.returncode==0 and json.loads(p.stdout)['module']
 with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
 output=M/'output/session';assert not output.exists();output.mkdir()
 recipe=json.loads((F/'next-runtime-recipe.json').read_text());command=[x.replace('/home/user/shadow-man-streamed-installed-runtime-oct22',str(R)).replace('NEXT-RUN','session').replace('PORT',str(port)) for x in recipe['argvTemplate']]
 # Keep the recipe's exact ordinary CLI input modes, without selecting game.
 assert '--no-build' in command and '--wasm='+str(RT/'build/wine-assembly.wasm') in command
 st=os.statvfs(M);assert st.f_blocks*st.f_frsize==939524096
 used=(st.f_blocks-st.f_bfree)*st.f_frsize
 projection=used+3*(g['allocation']['pageRoundedCopyBytes']+8388608)+g['allocation']['metadataAllowance']+67108864
 assert projection<=939524096 and alloc(F)+16777216<100663296 and alloc(I)<2147483648 and shutil.disk_usage(R).free>=2147483648
 g.update(command=command,environment=env,controlPort=port,nativeSHA256=native,cloneFiles=2045,canonicalInputConsumed=True,compileRejectionControls=5,forwardingAssertions=10,dependencyClosure=dict(files=dep['files'],plannedCtlDependencies='builtins fs/path/http',missingConditionalExcluded=dep['missing'],scope=dep['scope']),allocationBeforeSession=dict(immutable=alloc(I),fixed=alloc(F),tmpfsUsed=used,tmpfsProjected=projection,tmpfsCap=939524096,freeBytes=shutil.disk_usage(R).free),guestAttempts=0)
 (F/'preguest-gate.json').write_text(json.dumps(g,indent=2)+'\n');print(json.dumps(g))
if __name__=='__main__':main()
