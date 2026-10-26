import pathlib,os,json,shutil,resource,time,hashlib
H=pathlib.Path('/tmp/maelstrom-qualified-original-api-capture-recovered-oct26')
def a(p):
 try:s=p.lstat();return max(s.st_size,s.st_blocks*512)
 except FileNotFoundError:return 0
procs=[]
for p in pathlib.Path('/proc').iterdir():
 if not p.name.isdigit():continue
 try:
  rss=int(next((l.split()[1] for l in (p/'status').read_text().splitlines() if l.startswith('VmRSS:')),'0'))*1024
  cmd=(p/'cmdline').read_bytes().replace(b'\0',b' ').decode(errors='replace')
  if rss:procs.append(dict(pid=int(p.name),rss=rss,comm=(p/'comm').read_text().strip(),commandSHA256=hashlib.sha256(cmd.encode()).hexdigest(),runner='run.js' in cmd,arena512='--memory-mb=512' in cmd,heap512='--max-old-space-size=512' in cmd,helper=any(x in cmd for x in ['python','ascii','node'])))
 except (OSError,ProcessLookupError):pass
mem=int(next(l.split()[1] for l in open('/proc/meminfo') if l.startswith('MemAvailable')))*1024
required=2684354560+134217728+805306368
row=dict(at=time.time(),node=shutil.which('node'),uid=os.getuid(),memAvailable=mem,nativePhysicalFloor=2684354560,prospectiveHelperTransient=134217728,remainingHeadroom=805306368,required=required,liveRSSNotDoubleSubtracted=True,processes=procs,aggregateLiveArenasBytes=sum(536870912 for p in procs if p['runner'] and p['arena512']),aggregateLiveNodeHeapCeilingsBytes=sum(536870912 for p in procs if p['heap512']),helperRSS=sum(p['rss'] for p in procs if p['helper']),ownedAllocated=sum(a(p) for p in [H,*H.rglob('*')]) if H.exists() else 0,diskFree=shutil.disk_usage('/tmp').free,limits={k:resource.getrlimit(getattr(resource,k)) for k in ['RLIMIT_DATA','RLIMIT_AS','RLIMIT_CPU','RLIMIT_FSIZE']})
row['passChecks']=mem>=required and row['diskFree']-67108864>=2982150144 and row['uid']==1000 and row['aggregateLiveArenasBytes']==0
# Detailed inventory stays in owned evidence, API emits a bounded summary.
(H/'ops/remote-inventory-latest.json').write_text(json.dumps(row,indent=2))
print(json.dumps({k:v for k,v in row.items() if k!='processes'}))
assert row['passChecks'], 'remote admission rejected'
