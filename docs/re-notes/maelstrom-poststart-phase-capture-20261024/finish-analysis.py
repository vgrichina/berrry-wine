import pathlib,json,re,struct,hashlib,importlib.util
H=pathlib.Path(__file__).parent;s=(H/'collected/guest/output.log').read_text();m=re.search(r'\[TRACE-AT #1\].*',s)[0]
player=bytes.fromhex(re.search(r'\*0x420c0c@0x([0-9a-f]+)=([0-9a-f]+)',m)[2]);screen=bytes.fromhex(re.search(r'\*0x41f97c@0x([0-9a-f]+)=([0-9a-f]+)',m)[2]);u=lambda b,o:struct.unpack_from('<I',b,o)[0]
r=dict(traceBatch=36163,playerAddress='0x'+re.search(r'\*0x420c0c@0x([0-9a-f]+)',m)[1],player={n:u(player,o) for n,o in dict(vtable=0,ship=0x40,dead=0xac,exploding=0x54,lives=0x5c,score=0x60,playing=0xa8).items()},screenAddress='0x'+re.search(r'\*0x41f97c@0x([0-9a-f]+)',m)[1],surfaces={n:hex(u(screen,o)) for n,o in dict(current=0,foreground=4,background=8).items()},counterSnapshots=[])
for l in s.splitlines():
 if 'hit-counts:phase:' in l:r['counterSnapshots'].append(dict(batch=int(re.search(r'batch (\d+)',l)[1]),hits={a:int(n) for a,n in re.findall(r'(0x[0-9a-f]+)=(\d+)',l)}))
assert len(r['counterSnapshots'])==4
for snap in r['counterSnapshots'][2:]:
 assert snap['hits']['0x4019a0']==1 and snap['hits']['0x4019ab']==0 and snap['hits']['0x401e58']==0
assert r['player']['playing']==1 and r['player']['lives']==2 and r['player']['dead']==0 and r['player']['exploding']==0
spec=importlib.util.spec_from_file_location('proof','/tmp/maelstrom-poststart-state-cause-oct24/repo/tools/maelstrom-poststart-proof.py');p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
pics={}
for name in ['menu','play','input']:
 b=p.pixels(H/'collected/guest'/f'{name}.png');assert isinstance(b,list) and len(b)==640*480 and all(len(v)==4 for v in b);pics[name]=dict(width=640,height=480,sha256=hashlib.sha256((H/'collected/guest'/f'{name}.png').read_bytes()).hexdigest(),nonblackTopPixels=sum(any(v[:3]) for v in b[:640*450]))
r['images']=pics;r['phase']='First RunFrame entered; input drain not returned at bound; after-wave observed';r['permanentHangOrAPIcause']='not proven';r['visibleShipHUDFireMovement']=False
(H/'phase-analysis.json').write_text(json.dumps(r,indent=2));print(json.dumps(r,indent=2))
