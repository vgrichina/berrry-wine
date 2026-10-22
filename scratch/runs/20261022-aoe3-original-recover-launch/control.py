"""Observe/control the sole original route through existing ordinary input actions."""
import base64,json,pathlib,sys
from stage import E,REMOTE,run,save
name=sys.argv[1];command=json.loads(sys.argv[2]);assert command['action'] in ['snapshot','png','click','mousedown','mouseup','keydown','keyup','keypress','quit']
assert not (E/('control-'+name+'.json')).exists(), 'fresh command receipt required'
if 'args' in command:command={**command,**command.pop('args')};command.pop('args',None)
if command['action'] in ['click','mousedown','mouseup']:
 command={'cmd':'%s:%d:%d'%(command['action'],command['x'],command['y'])}
elif command['action'] in ['keydown','keyup','keypress']:
 command={'cmd':'%s:%d'%(command['action'],command['key'])}
code='import urllib.request,json; c=%r;req=urllib.request.Request("http://127.0.0.1:8123/ctl",data=json.dumps(c).encode(),headers={"Content-Type":"application/json"});print(urllib.request.urlopen(req,timeout=15).read().decode())'%command
r=run(code);save('control-'+name+'.json',dict(command=command,receipt=r));print(r['stdout']);assert json.loads(r['stdout'])['ok']
if command.get('action')=='png':
 p=command['path'];assert p.startswith(REMOTE+'/game-run/') and p.endswith('.png')
 r=run('import base64,pathlib; b=pathlib.Path(%r).read_bytes();assert len(b)<4000000;print(base64.b64encode(b).decode())'%p)
 dest=E/'raw/game-run'/pathlib.Path(p).name;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(base64.b64decode(r['stdout']))
 print(dest)
