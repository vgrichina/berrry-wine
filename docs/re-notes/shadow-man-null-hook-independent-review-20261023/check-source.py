import pathlib,json,hashlib,subprocess,os,re
r=pathlib.Path(__file__).resolve().parents[3];d=pathlib.Path('/home/user/wine-assembly-shadow-man-null-capture-mechanism-oct23');o=pathlib.Path(__file__).resolve().parent
E={**os.environ,'GIT_NO_LAZY_FETCH':'1'}
def pin(p):return subprocess.check_output(['git','-C',str(d),'ls-tree','6d145e98589caeab2d43c4bb54297d90c248b9de','--',p],env=E,text=True).split()[2]
checks={'sourceToolIdentities':{},'threeEditedFragments':{},'exportDeclarationInventory':{},'canonicalLocalProbes':{}}
for p in ['tools/build.sh','tools/test-tiers.js','tools/check-test-manifest.sh','tools/check-wat-fragments.js']:
 b=(o/('pinned-'+pathlib.Path(p).name)).read_bytes();h=hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest();assert h==pin(p);checks['sourceToolIdentities'][p]={'candidateBlob':h,'origin':'existing root Git object read-only; current root working build.sh differs'}
for p in ['src/13-exports.wat','src/09c3a-dialog-runtime.wat','src/09b-dispatch.wat']:
 b=(r/p).read_bytes();assert b==(d/p).read_bytes();assert hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==pin(p)
 checks['threeEditedFragments'][p]={'blob':pin(p),'sha256':hashlib.sha256(b).hexdigest()}
s=(r/'src/13-exports.wat').read_text();names=re.findall(r'\(export "([^"]+)"',s);dups=[x for x in set(names) if names.count(x)>1];assert not dups
checks['exportDeclarationInventory']={'scope':'src/13-exports.wat only, NOT module/whole closure','count':len(names),'duplicates':dups,'diagnostic':[x for x in names if x.startswith('null_diag') or x=='set_null_diag']}
for p in [pathlib.Path('/home/user/wine-assembly/build/wine-assembly.wasm'),d/'build/wine-assembly.wasm']:checks['canonicalLocalProbes'][str(p)]={'exists':p.exists()}
checks['canonicalInventory']='NOT AVAILABLE at expected existing local paths; no recovery/remote/search'
checks['testDiscovery']={'candidateCjsDiscovered':False,'reason':'pinned test-tiers.js TEST_NAME admits .js only','reviewCjs':'explicit offline invocation only'}
checks['runner']={'blob':pin('test/run.js'),'instantiateLine':4850,'dlgCmdSendLine':8461,'receiptAfterSend':True,'arming':'preload immediate; no deferred-arm interface/input boundary'}
p=subprocess.run(['node',str(o/'pinned-check-wat-fragments.js'),'--verbose','src/13-exports.wat','src/09c3a-dialog-runtime.wat','src/09b-dispatch.wat'],cwd=r,text=True,capture_output=True);checks['fragmentGate']={'argv':p.args,'exit':p.returncode,'stdout':p.stdout,'stderr':p.stderr};assert p.returncode==0
(o/'source-checks.json').write_text(json.dumps(checks,indent=2)+'\n');print(json.dumps(checks,indent=2))
