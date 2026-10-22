"""Ordinary guest input and read-only snapshots through existing CLI controls."""
import json,sys
from remote import E,REMOTE,run,save,retrieve
name=sys.argv[1];port=int(sys.argv[2]);command=json.loads(sys.argv[3])
assert port in [8123,8124]
assert not (E/('control-'+name+'.json')).exists()
assert command.get('action') in ['snapshot','png','quit'] or command.get('cmd','').split(':')[0] in ['click','keydown','keyup','keypress']
code='import urllib.request,json;c=%r;r=urllib.request.Request("http://127.0.0.1:%d/ctl",data=json.dumps(c).encode(),headers={"Content-Type":"application/json"});print(urllib.request.urlopen(r,timeout=15).read().decode())'%(command,port)
r=run(code);save('control-'+name+'.json',dict(port=port,command=command,receipt=r));print(r['stdout']);assert json.loads(r['stdout'])['ok']
if command.get('action')=='png':
    p=command['path'];assert p.startswith(REMOTE+'/setup-run/') and p.endswith('.png')
    print(retrieve(p[len(REMOTE)+1:]))
