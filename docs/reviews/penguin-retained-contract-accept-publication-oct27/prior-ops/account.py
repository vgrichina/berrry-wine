import pathlib,json,time,shutil,re,sys
H=pathlib.Path(__file__).parent; T=H.parent
b=json.loads((H/'admission-initial.json').read_text())
def size(p):return sum(x.stat().st_size for x in p.rglob('*') if x.is_file())
peers=[dict(x,measured=size(pathlib.Path(x['path']))) for x in b['peers']]
external={p:max(0,pathlib.Path(p).stat().st_size-n) if pathlib.Path(p).exists() else 0 for p,n in b['externalBaseline'].items()}
externalGrowth=sum(external.values());own=size(T);remainingOther=sum(max(0,x['allocationMiB']*1048576-x['measured']) for x in peers)
mem=int(re.search(r'MemAvailable:\s+(\d+)',pathlib.Path('/proc/meminfo').read_text())[1])*1024
free=shutil.disk_usage('/tmp').free
# Actual bytes already consume free; future room is allocation minus those bytes.
remainingOwn=max(0,33554432-own-externalGrowth)
j=dict(at=time.time(),ownBytes=own,externalPositiveGrowth=externalGrowth,externalByPath=external,peers=peers,otherRemaining=remainingOther,ownRemaining=remainingOwn,free=free,projectedFree=free-remainingOther-remainingOwn,MemAvailable=mem,memoryRequired=1275068416,sourceGitBytes=size(T/'repo'),opsBytes=size(H),allocation=33554432,reserve=8388608)
j['pass']=j['projectedFree']>=2982150144 and mem>=j['memoryRequired'] and externalGrowth<=8388608 and own+externalGrowth+8388608<=33554432 and j['sourceGitBytes']<=8388608 and j['opsBytes']<=8388608
(H/('admission-'+sys.argv[1]+'.json')).write_text(json.dumps(j,indent=2)+'\n');print(json.dumps({k:j[k] for k in ['ownBytes','externalPositiveGrowth','projectedFree','MemAvailable','pass']}));assert j['pass'],j
