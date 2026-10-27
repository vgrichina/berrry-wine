import pathlib,json,hashlib,struct
H=pathlib.Path(__file__).parent;E=H/'remote'
def load(n):return json.loads((E/n).read_text())
t=load('terminal.json');events=load('input-events.json');abi=load('abi-instantiated.json');startup=json.loads(load('node-startup.json')['stdout']);argv=load('guest-process.json')['argv']
assert t['remaining']==[]
assert abi['arenaBytes']==512*1048576 and abi['stamps']==['9a3bc9149d58209c'] and abi['missing']==[]
assert startup['pass'] and startup['node']=='/home/user/.nvm/versions/node/v24.22.1/bin/node'
assert '--no-build' in argv and '--no-close' in argv and '--max-seconds=115' in argv
assert all(e.get('ack',{}).get('ok') is True for e in events[:-1])
frames=[]
for p in sorted(E.glob('*.png')):
 b=p.read_bytes();assert b[:8]==b'\x89PNG\r\n\x1a\n';w,h=struct.unpack('>II',b[16:24]);assert (w,h)==(800,600) and len(b)<=4*1048576
 frames.append({'name':p.name,'width':w,'height':h,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
assert len(frames)<=4
r={'terminal':t,'frames':frames,'mechanicalIntegrityPass':True,'visualAcceptance':'requires separate reviewed screenshot record','lateCaptureAcknowledged':any(e['cmd'].endswith('play-85s.png') and e.get('ack',{}).get('ok') for e in events)}
(H/'validation.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r,indent=2))
