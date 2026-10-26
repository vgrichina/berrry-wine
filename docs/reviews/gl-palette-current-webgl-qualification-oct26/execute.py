from common import *
def processes(group):
 rows=[]
 for p in pathlib.Path('/proc').iterdir():
  if not p.name.isdigit():continue
  try:
   st=(p/'stat').read_text();fields=st[st.rindex(')')+2:].split()
   if int(fields[2])!=group:continue
   rows.append(dict(pid=int(p.name),rss=int(fields[21])*os.sysconf('SC_PAGE_SIZE'),cpu=(int(fields[11])+int(fields[12]))/os.sysconf('SC_CLK_TCK'),argv=(p/'cmdline').read_bytes().replace(b'\0',b' ').decode(errors='replace')))
  except (FileNotFoundError,ProcessLookupError,PermissionError):pass
 return rows
def supervised(name,argv):
 gate('before-'+name,True)
 log=O/(name+'.log');start=time.monotonic();peak=0;diskPeak=0;cpuPeak=0;browser=[];failure=None
 with log.open('wb') as f:
  p=subprocess.Popen(argv,cwd=S,env=ENV,stdout=f,stderr=subprocess.STDOUT,start_new_session=True,preexec_fn=limits)
  while True:
   rows=processes(p.pid);rss=sum(r['rss'] for r in rows);cpu=sum(r['cpu'] for r in rows);peak=max(peak,rss);cpuPeak=max(cpuPeak,cpu)
   if any('/opt/google/chrome/chrome' in r['argv'] for r in rows):browser=rows
   charges=accounting();total=sum(charges.values());diskPeak=max(diskPeak,total)
   free=shutil.disk_usage(H).free
   mem=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
   if rss>1879048192:failure='aggregate task process-group RSS exceeds 1792MiB'
   elif cpu>90:failure='aggregate process-group CPU exceeds 90sec'
   elif time.monotonic()-start>120:failure='execution wall exceeds 120sec'
   elif log.stat().st_size>2097152:failure='captured output exceeds 2MiB'
   elif total>67108864:failure='aggregate task allocation including reserves exceeds 64MiB'
   elif free<2982150144:failure='host free below 2982150144B'
   elif mem<805306368:failure='host MemAvailable below 768MiB remainder'
   if failure:
    os.killpg(p.pid,signal.SIGTERM)
    try:p.wait(timeout=2)
    except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);p.wait()
    break
   if p.poll() is not None:break
   time.sleep(.1)
  # Clean any owned descendants left after a failing fixture, without retrying.
  live=processes(p.pid)
  if live:
   try:os.killpg(p.pid,signal.SIGTERM)
   except ProcessLookupError:pass
  receipt=dict(argv=argv,env={k:ENV[k] for k in ['NODE_PATH','CHROME','TMPDIR','PALETTE_GPU_EVIDENCE','GIT_SSH_COMMAND']},exit=p.returncode,stopReason=failure,wallSeconds=time.monotonic()-start,peakProcessGroupRSS=peak,peakObservedAggregateCPUSeconds=cpuPeak,peakAccountingBytes=diskPeak,browserProcesses=browser,logBytes=log.stat().st_size,limits=dict(CPU=90,wall=120,FSIZE=25165824,output=2097152,aggregateRSS=1879048192,heapMiB=512,DATA='inherited unlimited; Git-only children 512MiB',AS='inherited unlimited'),monitorIntervalSeconds=.1)
  save(name+'-receipt.json',receipt)
  assert not failure and p.returncode==0,receipt
startup='const fs=require("fs"),v8=require("v8");console.log(JSON.stringify({execPath:process.execPath,version:process.version,execArgv:process.execArgv,limits:fs.readFileSync("/proc/self/limits","utf8"),heapLimit:v8.getHeapStatistics().heap_size_limit,puppeteer:require.resolve("puppeteer"),env:{NODE_PATH:process.env.NODE_PATH,CHROME:process.env.CHROME,TMPDIR:process.env.TMPDIR}}))'
supervised('node-startup',[NODE,'--max-old-space-size=512','-e',startup])
save('pre-execution-source-verification.json',verify())
supervised('test',[NODE,'--max-old-space-size=512',str(S/'test/test-d3dim-palette-gpu-web.js')])
save('post-execution-source-verification.json',verify());gate('after-test')
