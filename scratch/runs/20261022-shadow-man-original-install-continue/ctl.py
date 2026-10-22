import sys,json,base64
from remote import *
label=sys.argv[1];commands=[json.loads(x) for x in sys.argv[2:]]
code='''import pathlib,json,urllib.request,time,base64,datetime
O=pathlib.Path('/home/user/shadow-man-install-quota-oct22/session');label=%r;commands=%r
rows=[]
def request(command):
 req=urllib.request.Request('http://127.0.0.1:49171/ctl',data=json.dumps(command).encode(),headers={'Content-Type':'application/json'})
 start=datetime.datetime.now(datetime.timezone.utc).isoformat()
 with urllib.request.urlopen(req,timeout=3) as r:reply=json.loads(r.read())
 row=dict(at=start,command=command,response=reply);rows.append(row);assert reply['ok'],row
 return reply
for c in commands:request(c)
time.sleep(.25)
request({'action':'snapshot'})
request({'cmd':'png:'+str(O/(label+'.png'))})
r=dict(label=label,rows=rows,ownedEndpoint='installer-only 127.0.0.1:49171');(O/(label+'-control.json')).write_text(json.dumps(r,indent=2));r['pngBase64']=base64.b64encode((O/(label+'.png')).read_bytes()).decode();print(json.dumps(r))
'''%(label,commands)
r=run(code,label+'-api.json',15);v=json.loads(r['stdout']);(E/(label+'.png')).write_bytes(base64.b64decode(v.pop('pngBase64')));save(label+'-control.json',v);print(json.dumps(v,indent=2))
