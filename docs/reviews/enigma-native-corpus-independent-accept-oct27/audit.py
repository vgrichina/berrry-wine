import json,hashlib,tarfile,base64,pathlib,sys
sys.dont_write_bytecode=True
H=pathlib.Path('/tmp/enigma-native-corpus-independent-accept-oct27');O=H/'ops'
D=pathlib.Path('/tmp/enigma-retained-canonical-native-msg-qualification-oct26');E=D/'repo/docs/reviews'/D.name
SRC=pathlib.Path('/tmp/enigma-accepted-msg-current-tree-reconcile-oct26/repo')
A=pathlib.Path('/tmp/enigma-reconciled-msg-independent-source-accept-oct26');AE=A/'repo/docs/reviews'/A.name
sha=lambda b:hashlib.sha256(b).hexdigest()
manifest=json.loads((E/'evidence-manifest.json').read_text());consumed={}
def read(p):
 b=p.read_bytes()
 if p.is_relative_to(D/'repo'):
  key=str(p.relative_to(D/'repo'));pin=manifest[key];assert len(b)==pin['bytes'] and sha(b)==pin['sha256'],key
 consumed[str(p)]=dict(bytes=len(b),sha256=sha(b));return b
def j(p):return json.loads(read(p))
runner=read(SRC/'test/run.js').decode();assert sha(runner.encode())=='55be42cbcaedee9d7f56f578cd7d36841bba86861b38bf5d61a7a0415a880c2e'
wires=j(E/'runner-wires.json');assert wires['install'] in runner and wires['qualify'] in runner
timing={s:runner.index(s) for s in [wires['install'], 'const instance = await WebAssembly.instantiate(wasmModule, imports);',wires['qualify'],'stageAndLoadPe(instance.exports', 'instance.exports.init_dx_com_thunks();']}
assert list(timing.values())==sorted(timing.values())
pub=json.loads((A/'ops/publication.json').read_text());assert pub['commit']=='facebcb2e6d04b84e80211a7814654e528566b0f' and pub['parent']=='425755ee5ee9be0734c7aca187521100f5487674'
first=j(AE/'first-reproducer.json');assert sha(read(pathlib.Path(first['path'])))==first['sha256']
source_receipts={}
for name in ['production-boundary-result.json','independent-runner-result.json','source-review-result.json','reuse-verified.json']:
 p=AE/name
 if p.exists():source_receipts[name]=dict(bytes=len(read(p)),sha256=sha(p.read_bytes()))
summary=j(E/'remote-final-summary.json');checkpoint=j(E/'remote/final-checkpoint.json')
assert summary['candidate']==checkpoint['candidate']=='425755ee5ee9be0734c7aca187521100f5487674'
rootad=json.loads(pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/enigma-native-corpus-independent-accept-oct27-admission.json').read_text())
assert rootad['hashFailures']==[] and rootad['verifiedFiles']==276 and rootad['pass']
assert j(D/'ops/publication.json')['commit']=='291e4b03f77c3957c0e14fe0077fe5d301882964'
j(D/'ops/result.json')
archive=D/'ops/harness.tar.gz';archivebytes=read(archive)
join=j(E/'api-harness.tar.gz-join.json');joined=json.loads(join['stdout']);assert joined['exitCode']==0
assert sha(archivebytes)==joined['stdout'].replace('\\n','').strip()
with tarfile.open(archive) as t:core=t.extractfile('harness.js').read()
assert sha(core)=='0f45d951978a59e9923a116459d5ac00a38c807f3d999fe7c5fc1b821fb27f54'
versions={'core':core,'hooks-thread':read(E/'versions/harness-hooks-thread.js'),'hardware':read(E/'versions/harness-hardware.js'),'unrelated':read(E/'versions/harness-unrelated.js')}
assert sha(read(D/'repo/test/enigma-retained-canonical-native-msg.js'))=='b62c76f898a8148c8f5a30d3fca774e2942cb3d7d64aa5bc6fdb2011b8f016c8'
version_audit=[];input_pins={};groups=[]
for group,b in versions.items():
 s=b.decode()
 # Identity/structure audit, never a substitute for dynamic production wiring.
 for term in ['const mod = new WebAssembly.Module(bytes);','new WebAssembly.Instance(mod',
              'e.load_pe(image.length)','e.init_dx_com_thunks()',"wires.install.replaceAll('instance.exports','instanceProxy.exports')",
              "wires.qualify)(ctx,instance,on,trace)","e.guest_to_wasm", "edge==='CALL'?0xd0:0xe0",
              "e.run(budget)","calls.push([n,...a])"]:
  assert term in s,(group,term)
 assert s.index('wires.qualify)(ctx,instance,on,trace)')<s.index('e.load_pe(image.length)')<s.index('e.init_dx_com_thunks()')
 assert not any(x in s for x in ['h.message_complete(', 'owner.imports.message_complete(', '.completed({'])
 version_audit.append(dict(group=group,bytes=len(b),sha256=sha(b),proxyOnly=True,productionRunnerExecuted=False))
 for backend in ['tail','compat']:
  label=backend+('' if group=='core' else '-'+group)
  config=j(E/'remote'/('config-'+label+'.json'));execution=j(E/'remote'/(label+'-execution.json'))
  assert execution['argv']==config['argv'] and execution['exit']==0 and execution['reason']=='natural'
  assert execution['inputHashesUnchanged'] and execution['ownedGroupCleanup']
  expected='harness.js' if group=='core' else 'harness-'+group+'.js'
  assert pathlib.Path(execution['argv'][2]).name==expected
  assert config['limits']['2']==config['limits']['9']==[-1,-1]
  result=j(E/'remote'/(label+'-result.json'));input_pins[label+'-result.json']=sha((E/'remote'/(label+'-result.json')).read_bytes())
  assert len(result['cases'])==dict(core=20,**{'hooks-thread':16,'hardware':20,'unrelated':4})[group]
  groups.append(dict(backend=backend,group=group,resultSHA=input_pins[label+'-result.json'],harnessSHA=sha(b),argv=execution['argv'],receiptSHA=sha((E/'remote'/(label+'-execution.json')).read_bytes())))
for p in E.rglob('*.raw.json'):
 e=json.loads(p.read_text())
 if 'base64' not in e:continue
 b=base64.b64decode(e['base64'],validate=True);assert len(b)==e['bytes'] and sha(b)==e['sha256']
 # Record only metadata, preserving original bytes in immutable donor package.
 consumed[str(p)]=dict(bytes=len(p.read_bytes()),sha256=sha(p.read_bytes()),decodedBytes=len(b),decodedSHA=sha(b),originalFilename=e['originalFilename'])
for file,pin in j(E/'pins.json').items():
 assert sha(read(SRC/file))==pin,file
audit=dict(candidate='425755ee5ee9be0734c7aca187521100f5487674',candidateTree='fb1ef0832eb9e0229cd272c67b8465c4fcbf4396',
 donor='291e4b03f77c3957c0e14fe0077fe5d301882964',donorTree='f00667622b73b2d52f7ae1f7bf5309514db0c111',
 sourceAcceptance=pub['commit'],sourceTimingReceipts=source_receipts,productionRunnerSHA=sha(runner.encode()),
 runnerSourceOffsets={('installation' if k==wires['install'] else 'qualification' if k==wires['qualify'] else k):v for k,v in timing.items()},
 productionRunnerExecuted=False,sourceOnlyHostLoaderSubstitution=True,syntheticHarnessInstanceProxy=True,
 versions=version_audit,reusedNativeGroups=groups,rootManifestAdmissionReused=rootad,
 scope='synthetic canonical native corpus only; new execution OFFLINE',modules=rootad['modules'],
 limitations=['full production runner/native game initializers unqualified','generic unrelated signature-correct zero stubs',
 'synthetic unrelated callback scheduling','records/calls lack unified phase timestamps and begin return values; matching owner oracle and unchanged harness assertions reused',
 'no proof of arbitrary host scheduling or concurrency','step ACK all batches then frozen zero before input and original game remain open'])
for name,value in [('provenance-audit.json',audit),('consumed-inputs.json',consumed),('corpus-pins.json',input_pins)]:
 (O/name).write_text(json.dumps(value,indent=2)+'\n')
print(json.dumps(dict(versions=len(versions),nativeGroupsReused=len(groups),corpusPins=len(input_pins),consumedInputs=len(consumed),productionRunnerExecuted=False)))
