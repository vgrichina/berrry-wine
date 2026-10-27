from work import *
assert (O/'closure-readback.json').exists()
transfer([(n,O/n) for n in ['supervisor.py','capture-wrapper.cjs','config-stop.cjs','config-args.json','guest-args.json','startup-args.json']])
for name in ['startup']:
 j=remote('python3 '+shlex.quote(R+'/supervisor.py')+' '+name,timeout=30);save(name+'-api.json',j)
 j=py('import pathlib,json;h=pathlib.Path('+repr(R+'/'+name)+');print(json.dumps(dict(terminal=json.loads((h/"terminal.json").read_text()),output=(h/"output.log").read_text()[:6000])))');save(name+'-qualification.json',j);v=json.loads(j['stdout']);assert v['terminal']['returncode']==0 and not v['terminal']['remainingOwnedLive'],v
 if name=='config':assert 'CONFIG_ONLY_REACHED_NO_BUILD_MODULE_READ' in v['output']
 print(name+' PASS',flush=True)
# Pin actual production parser, registry and complete filename-bearing registered closure.
src=next(x for x in json.loads((ROOT/'scratch/usage-watch/alien-accepted-dispatch-runtime-inputs-oct27.json').read_text())['files'] if x['target']=='runner/test/run.js');s=pathlib.Path(src['source']).read_text();parser=s[s.index('const getArg ='):s.index('// Was `--name=...`')]
a=json.loads((O/'guest-args.json').read_text())
code='const fs=require("fs"),assert=require("assert"),path=require("path"),crypto=require("crypto"),args='+json.dumps(a[4:])+';'+parser+''';assert.equal(getArg('app'),'alien_shooter');assert(hasFlag('no-build')&&hasFlag('trace-render-wait')&&hasFlag('frozen'));assert.equal(getArgs('vfs-tree').length,0);assert.equal(getArgs('vfs-mount').length,0);const {APPS}=require('./lib/apps'),e=APPS.alien_shooter;fs.accessSync(e.exe);const m=JSON.parse(fs.readFileSync(e.localFileManifest));let dir=path.dirname(e.localFileManifest),files=m.files.map(x=>({...x,host:path.join(dir,x.url)}));for(let x of files)fs.accessSync(x.host);fs.writeFileSync('''+json.dumps(R+'/filename-enumeration.json')+''',JSON.stringify({exe:e.exe,manifest:e.localFileManifest,files,commaNames:files.filter(x=>x.url.includes(','))},null,2));console.log(JSON.stringify({count:files.length,exe:e.exe,manifest:e.localFileManifest,commaNames:files.filter(x=>x.url.includes(',')),noCommaSplitForRegisteredManifest:true}));'''
(O/'parser.cjs').write_text(code);transfer([('runner/parser.cjs',O/'parser.cjs')])
j=py('''import pathlib,json,subprocess,os,resource
h=pathlib.Path('''+repr(R)+''');a=json.loads((h/'guest-args.json').read_text());env=dict(os.environ)
for k in ['WINE_RUN_EXTRA_ARGS','WINE_REGION_MAP','NODE_OPTIONS','NODE_PATH']:env.pop(k,None)
def limits():
 resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
p=subprocess.run(a[:3]+[str(h/'runner/parser.cjs')],cwd=h/'runner',env=env,preexec_fn=limits,capture_output=True,text=True,timeout=20)
(h/'parser-result.json').write_text(json.dumps(dict(exit=p.returncode,stdout=p.stdout,stderr=p.stderr)));print(json.dumps(dict(exit=p.returncode,stdout=p.stdout,stderr=p.stderr)));assert p.returncode==0
''');save('canonical-parser.json',dict(argv=a,parserSHA256=sha(parser.encode()),receipt=j));print(j['stdout'],flush=True)
for name in ['config']:
 j=remote('python3 '+shlex.quote(R+'/supervisor.py')+' '+name,timeout=30);save(name+'-api.json',j)
 j=py('import pathlib,json;h=pathlib.Path('+repr(R+'/'+name)+');print(json.dumps(dict(terminal=json.loads((h/"terminal.json").read_text()),output=(h/"output.log").read_text()[:6000])))');save(name+'-qualification.json',j);v=json.loads(j['stdout']);assert v['terminal']['returncode']==0 and not v['terminal']['remainingOwnedLive'],v
 if name=='config':assert 'CONFIG_ONLY_REACHED_NO_BUILD_MODULE_READ' in v['output']
 print(name+' PASS',flush=True)
save('checkpoint.json',dict(phase='pre-guest CLI qualification',closureVerified610=True,parserVerified=True,startupExactConfiguration=True,unchangedFullCLIStoppedAtNoBuildModuleRead=True,guestInvocations=0,reusedAcceptedIntegration='a9d65e0459445616d16b7a85fd99c1c93ec992ac',next='fresh admission then ONE production guest'))
