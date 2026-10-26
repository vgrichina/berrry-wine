from work import *
OLD='/tmp/alien-shooter-current-gameplay-api-oct26'
j=py('''import pathlib,json,subprocess,os,resource,hashlib
h=pathlib.Path('''+repr(R)+''');old=pathlib.Path('''+repr(OLD)+''');a=json.loads((h/'guest-args.json').read_text());env=dict(os.environ)
for k in ['WINE_RUN_EXTRA_ARGS','WINE_REGION_MAP','NODE_OPTIONS','NODE_PATH']:env.pop(k,None)
def limits():
 resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
code="const fs=require('fs'),path=require('path'),{SYSTEM_DATA_FILES}=require('./lib/process-boot'),{fontMounts,BUNDLED_BITMAP_FONTS}=require('./lib/font-substitutions');let required=[...SYSTEM_DATA_FILES.map(x=>x.url),...BUNDLED_BITMAP_FONTS.map(x=>'fonts/'+x),'fonts/substitutions.json',...fontMounts(JSON.parse(fs.readFileSync('fonts/substitutions.json')),{subset:true}).map(x=>'fonts/'+x.file),'src/api_table.json'];for(let p of required)fs.accessSync(p);console.log(JSON.stringify({execPath:process.execPath,execArgv:process.execArgv,version:process.version,limits:fs.readFileSync('/proc/self/limits','utf8'),required,environment:Object.fromEntries(Object.entries(process.env).filter(([k])=>/^(NODE|WINE)/.test(k)))}))"
p=subprocess.run(a[:3]+['-e',code],cwd=old/'runner',env=env,preexec_fn=limits,capture_output=True,text=True,timeout=20)
with (h/'diagnostic.jsonl').open('a') as f:f.write(json.dumps(dict(startup=p.stdout,stderr=p.stderr,returncode=p.returncode))+'\\n')
print(json.dumps(dict(exit=p.returncode,stdout=p.stdout,stderr=p.stderr,tableSHA256=hashlib.file_digest((old/'runner/src/api_table.json').open('rb'),'sha256').hexdigest())))
assert p.returncode==0
''');save('startup-exact-closure.json',j);print(j['stdout'],flush=True)
print('READY actual guest',flush=True)
