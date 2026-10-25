import datetime,json,pathlib,subprocess,urllib.request
P=pathlib.Path('/tmp/dashboard-accepted-reader-live-activation-oct25/ops')
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def sample(label):
 pid=int(subprocess.check_output(['systemctl','show','wine-ops.service','-p','MainPID','--value']))
 r={'at':now(),'pid':pid,'status':{k:int(v.split()[0])*1024 for k,v in (l.split(':',1) for l in open(f'/proc/{pid}/status') if l.startswith(('VmRSS:','VmHWM:')))},'MemAvailable':int(next(l.split()[1] for l in open('/proc/meminfo') if l.startswith('MemAvailable:')))*1024}
 (P/('rss.'+label+'.json')).write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r));return r
def api(label):
 results=[]
 for method,path in [('HEAD','/api/state'),('GET','/api/work-status')]:
  r={'at':now(),'method':method,'path':path,'bodyLimit':131072}
  try:
   with urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:8098'+path,method=method),timeout=25) as f:
    r['status']=f.status;b=f.read(131072);r['bodyBytes']=len(b);assert len(b)<131072,'bounded body limit reached'
    if method=='GET':
     d=json.loads(b);assert isinstance(d,(dict,list));r['shape']=({k:('array:'+str(len(v)) if isinstance(v,list) else type(v).__name__) for k,v in d.items()} if isinstance(d,dict) else {'type':'array','count':len(d),'itemKeys': sorted(d[0].keys()) if d and isinstance(d[0],dict) else []});assert len(d)>0
    r['ok']=f.status==200
  except Exception as e:r.update(ok=False,error=str(e))
  results.append(r)
 (P/('api.'+label+'.json')).write_text(json.dumps(results,indent=2)+'\n');print(json.dumps(results));return all(x['ok'] for x in results)
if __name__=='__main__':
 import sys
 assert api(sys.argv[1]);sample(sys.argv[1])
