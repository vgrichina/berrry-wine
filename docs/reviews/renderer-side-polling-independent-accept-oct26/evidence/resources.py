import os,json,pathlib,shutil,subprocess,hashlib,datetime
base=pathlib.Path('/tmp/renderer-side-polling-independent-accept-oct26'); launch=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/renderer-side-polling-independent-accept-oct26')
def total(p):
 return sum(f.stat().st_size for f in p.rglob('*') if f.is_file() and not f.is_symlink()) if p.exists() else 0
mem=int(next(x.split()[1] for x in pathlib.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024
processes=[]
for p in pathlib.Path('/proc').glob('[0-9]*'):
 try:
  cmd=(p/'cmdline').read_bytes().replace(b'\0',b' ').decode(errors='replace')
  if ('codex' in cmd or 'start-worker.py' in cmd or 'node --max-old-space-size' in cmd) and len(cmd)<3000:
   rss=int(next(x.split()[1] for x in (p/'status').read_text().splitlines() if x.startswith('VmRSS:')))*1024
   processes.append({'pid':int(p.name),'rss':rss,'command':cmd[:240]})
 except (OSError,StopIteration,ValueError): pass
owned=total(base)+total(launch)
# current session is standing external storage; charge current file and positive future WAL only once.
sessions=[{'path':str(p),'bytes':p.stat().st_size} for p in pathlib.Path('/home/user/.codex/sessions/2026/10/26').glob('*01a176e2-3b65-7f03-bfc1-eb7764749c0c*')]
sessionbytes=sum(x['bytes'] for x in sessions)
projected=owned+sessionbytes+12*1048576+8*1048576+4*1048576
free=shutil.disk_usage(base).free
r={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'ownedBytes':owned,'allocatedBytes':sum(f.stat().st_blocks*512 for root in [base,launch] for f in root.rglob('*') if f.is_file() and not f.is_symlink()),'sessionFiles':sessions,'sessionBytes':sessionbytes,'futureSessionEventsPositiveWalOnce':12*1048576,'reserve':8*1048576,'checkoutTestsEvidencePublicationAllowance':4*1048576,'projectedPeak':projected,'limit':64*1048576,'freeDisk':free,'freeAfterGrowth':free-(projected-owned),'memAvailable':mem,'workerClientAllowance':536870912,'executionHeap':16777216,'ramFloor':805306368,'aggregateActualProcesses':processes,'aggregateRss':sum(x['rss'] for x in processes),'pass':projected<=64*1048576 and free-(projected-owned)>=2982150144 and mem-536870912-16777216>=805306368,'standingNode':{'path':shutil.which('node'),'bytes':os.stat(shutil.which('node')).st_size,'version':subprocess.check_output(['node','--version']).decode().strip()},'standingDonor':{'path':'/tmp/renderer-side-modifier-polling-repair-oct26/repo','logicalBytes':total(pathlib.Path('/tmp/renderer-side-modifier-polling-repair-oct26/repo')),'readonly':True},'manifest':[{'path':str(p),'bytes':p.stat().st_size} for root in [base,launch] for p in root.rglob('*') if p.is_file() and not p.is_symlink()]}
p=base/'ops'/('resources-'+(__import__('sys').argv[1])+'.json'); p.write_text(json.dumps(r,indent=2)+'\n'); print(json.dumps({k:v for k,v in r.items() if k not in ['aggregateActualProcesses','manifest']})); assert r['pass']
