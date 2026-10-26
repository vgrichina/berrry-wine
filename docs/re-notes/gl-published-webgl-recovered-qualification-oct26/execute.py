from work import *
# argv includes the exact accepted supervisor path; ensureSupervised verifies this
# and the real parent PID. Invoke its unchanged supervise function with task limits.
assert str(R/'test/helpers/palette-browser-supervisor.py') in sys.argv
clients=[]
for p in P('/proc').iterdir():
 if not p.name.isdigit():continue
 try:
  exe=os.readlink(p/'exe').removesuffix(' (deleted)')
  if exe.endswith('/codex'):
   rss=int((p/'statm').read_text().split()[1])*os.sysconf('SC_PAGE_SIZE');clients.append(dict(pid=int(p.name),rss=rss,own=int(p.name)==3190679))
 except (OSError,ValueError):pass
growth=sum(max(0,320*M-r['rss']) for r in clients)
required=max(3489660928,(768+1024+512+128)*M+growth)
mem=int(P('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
gate=dict(memAvailable=mem,required=required,clients=clients,remainingGrowth=growth,prospectiveOwnClient=0,completedCivGuest=0,completedCivPublication=0,ledger=ledger(),passAdmission=mem>=required and check() is None)
save('immediate-runtime-admission.json',gate)
assert gate['passAdmission'],gate
startup='const fs=require("fs"),v8=require("v8");console.log(JSON.stringify({execPath:process.execPath,version:process.version,execArgv:process.execArgv,limits:fs.readFileSync("/proc/self/limits","utf8"),heapLimit:v8.getHeapStatistics().heap_size_limit,puppeteer:require.resolve("puppeteer"),launchConfiguration:require("./test/helpers/palette-browser-launch").launchConfiguration(),env:{NODE_PATH:process.env.NODE_PATH,CHROME:process.env.CHROME,TMPDIR:process.env.TMPDIR,PALETTE_GPU_SOURCE_ROOT:process.env.PALETTE_GPU_SOURCE_ROOT}}))'
out=run([NODE,'--max-old-space-size=512','-e',startup],'node-startup',1024*M,R)
save('node-startup.json',json.loads(out))
save('runtime-configuration.json',dict(environmentSHA256=hashlib.sha256(json.dumps(dict(os.environ),sort_keys=True).encode()).hexdigest(),nodeExecutableSHA256=sha(P(NODE).resolve()),nodeFlags=['--max-old-space-size=512'],supervisorSHA256=sha(R/'test/helpers/palette-browser-supervisor.py'),physicalRSS=1024*M,CPU=90,wall=120,file=24*M,output=2*M,GitDATA='512MiB only Git child',NodeDATA='unchanged inherited unlimited',moduleRequirement=A['moduleExpectedSHA256'],loopbackOnly='unchanged oracle server127.0.0.1 and Puppeteer background-network disabling; explicit actual Chrome ELF, no external wrapper',acceptedAccountingCallback='task192MiB explicit roots/future/WALonce+8MiBreserve',peakCaveat='max(sampled simultaneous aggregate,waited process/descendant high-water); lower bound, independent peaks never summed'))
# This is the sole browser qualification invocation, including its necessary compile.
out=run([NODE,'--max-old-space-size=512',str(R/'test/test-d3dim-palette-gpu-web.js')],'test',1024*M,R)
j=json.loads((O/'test-result.json').read_text())
assert j['wasmSha256']==A['moduleExpectedSHA256'],j.get('wasmSha256')
assert j['stage']=='passed' and len(j['results'])==2
for v,r in zip([1,2],j['results']):assert r['version']==v and len(r['observations'])==42 and r['stats']['fallbacks']==0,r
save('checkpoint.json',dict(candidate=A['candidate'],tree='ef4fa7219aadb4241e9eb20c0d969bbb1cf139ce',runtime='passed',oracleSHA256=A['acceptedProductionPins']['test/test-d3dim-palette-gpu-web.js'],moduleSHA256=j['wasmSha256'],WebGL=[dict(version=r['version'],actualVersion=r['actualVersion'],renderer=r['renderer'],observations=len(r['observations']),fallbacks=r['stats']['fallbacks']) for r in j['results']],remaining=['task evidence publication'],appGameplayInference=False))
print(out[:8192].decode())
print(json.dumps(json.loads((O/'test-receipt.json').read_text())))
