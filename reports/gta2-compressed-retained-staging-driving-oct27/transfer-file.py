remote=sys.argv[-2];label=sys.argv[-1];assert pathlib.Path(remote).is_relative_to(H);q=py('import pathlib,hashlib,json;p=pathlib.Path('+repr(remote)+');b=p.read_bytes();print(json.dumps(dict(bytes=len(b),sha256=hashlib.sha256(b).hexdigest())))');pin=json.loads(q['stdout']);save('retrieved/'+label+'.pin.json',pin);assert pin['bytes']<=4194304
buf=bytearray()
for offset in range(0,pin['bytes'],5250):
 q=py('import pathlib,base64;p=pathlib.Path('+repr(remote)+');f=p.open("rb");f.seek('+str(offset)+');print(base64.b64encode(f.read(5250)).decode())');buf.extend(base64.b64decode(q['stdout'].strip()))
assert len(buf)==pin['bytes'] and sha(buf)==pin['sha256'];p=O/'retrieved'/label;p.parent.mkdir(exist_ok=True);p.write_bytes(buf);print(label,len(buf),pin['sha256'])
