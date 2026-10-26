from work import *
OLD='/tmp/alien-shooter-current-gameplay-api-oct26';PREV=pathlib.Path('/tmp/alien-shooter-required-exe-gameplay-api-oct26/ops');SOURCE=pathlib.Path('/tmp/civ2-win16-ordinary-gameplay-oct26/source');s=(SOURCE/'test/run.js').read_text()
a=json.loads((O/'guest-args.json').read_text());parser=s[s.index('const getArg ='):s.index('// Was `--name=...`')];code='const assert=require("assert"),args='+json.dumps(a[4:])+';'+parser+';assert.equal(getArg("app"),"alien_shooter");assert(hasFlag("no-build"));assert.equal(getArgs("vfs-mount").length,0);assert.equal(getArgs("vfs-tree").length,0);console.log("PASS")'
x=subprocess.run([shutil.which('node'),'--max-old-space-size=32','-e',code],capture_output=True,text=True,timeout=20);assert x.returncode==0
save('canonical-parser.json',dict(argv=a,parserSHA256=sha(parser.encode()),stdout=x.stdout,priorEnumerationReceipt=str(PREV/'canonical-parser.json'),priorReceiptSHA256=sha((PREV/'canonical-parser.json').read_bytes()),unchangedFilenameMounts=True))
transfer([(n,O/n) for n in ['supervisor.py','capture-wrapper.cjs','guest-args.json']])
# Node startup under the exact supervisor limits, then read-only ordinary dependency closure probe.
j=py('''import pathlib,json,subprocess,os,resource,hashlib
h=pathlib.Path('''+repr(R)+''');old=pathlib.Path('''+repr(OLD)+''');a=json.loads((h/'guest-args.json').read_text());env=dict(os.environ)
for k in ['WINE_RUN_EXTRA_ARGS','WINE_REGION_MAP','NODE_OPTIONS','NODE_PATH']:env.pop(k,None)
def limits():
 resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
code="const fs=require('fs'),path=require('path'),{SYSTEM_DATA_FILES}=require('./lib/process-boot'),{fontMounts,BUNDLED_BITMAP_FONTS}=require('./lib/font-substitutions');let required=[...SYSTEM_DATA_FILES.map(x=>x.url),...BUNDLED_BITMAP_FONTS.map(x=>'fonts/'+x),'fonts/substitutions.json',...fontMounts(JSON.parse(fs.readFileSync('fonts/substitutions.json')),{subset:true}).map(x=>'fonts/'+x.file),'src/api_table.json','lib/host-import-sigs.generated.json'];for(let p of required)fs.accessSync(p);console.log(JSON.stringify({execPath:process.execPath,execArgv:process.execArgv,version:process.version,limits:fs.readFileSync('/proc/self/limits','utf8'),required,environment:Object.fromEntries(Object.entries(process.env).filter(([k])=>/^(NODE|WINE)/.test(k)))}))"
p=subprocess.run(a[:3]+['-e',code],cwd=old/'runner',env=env,preexec_fn=limits,capture_output=True,text=True,timeout=20)
with (h/'diagnostic.jsonl').open('a') as f:f.write(json.dumps(dict(startup=p.stdout,stderr=p.stderr,returncode=p.returncode))+'\\n')
print(json.dumps(dict(exit=p.returncode,stdout=p.stdout,stderr=p.stderr,tableSHA256=hashlib.file_digest((old/'runner/src/api_table.json').open('rb'),'sha256').hexdigest())))
assert p.returncode==0
''');save('startup-exact-closure.json',j);print(j['stdout'],flush=True)
print('READY actual guest',flush=True)
