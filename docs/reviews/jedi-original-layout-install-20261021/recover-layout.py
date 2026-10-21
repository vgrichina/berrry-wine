"""Recover original SFX source directories, not an installed game.
Usage: recover-layout.py PACKAGE ORIGINAL_INVENTORY DESTINATION [--check]
--check verifies an existing VFS tree without writing original files.
Requires only Python standard library; never downloads or runs an executable.
"""
import hashlib,io,json,pathlib,struct,sys,zipfile
package,inventory,dest=map(pathlib.Path,sys.argv[1:4]);check=sys.argv[4:]==['--check']
assert len(sys.argv)==4 or check
b=package.read_bytes();sha=lambda x:hashlib.sha256(x).hexdigest()
assert sha(b)=='8aae38165e08b68bb63cfd21b8c28ed1d4d8f1bb400a0162588d5b86acdc827e'
inv=json.loads(inventory.read_text());assert len(inv['files'])==39
assert inv['sourceSha256']==sha(b)
# Original decoded data segment 3, offset 0x10. Routine: segment 2:0x0e4c.
key=bytes.fromhex('b3f2ea1faa276613')
def decode(c):
 out=[]
 for i,cipher in enumerate(c):
  j=i&7;r=7-j;x=cipher^key[r]
  out.append(((x>>r)|(x<<(8-r)))&255^key[j])
 return bytes(out)
r=0xa450;assert b[r:r+8]==bytes.fromhex('9401000006000000')
prefix=decode(b[r+276:r+404]).split(b'\0')[0].decode('ascii')
offset,count,total=struct.unpack_from('<III',b,r+8)
assert count==39 and total==len(b)
assert check or not dest.exists()
rows=[];payloads=[]
for expected in inv['files']:
 n=struct.unpack_from('<I',b,offset)[0]
 full=decode(b[offset+4:offset+4+n]).decode('ascii');assert full.startswith(prefix)
 start=offset+12+n;size=struct.unpack_from('<I',b,start-4)[0]
 assert start==expected['offset']
 with zipfile.ZipFile(io.BytesIO(b[start:start+size])) as z:
  assert z.namelist()==[expected['name']]
  raw=z.read(expected['name'])
 assert len(raw)==expected['size'] and sha(raw)==expected['sha256']
 rel=full[len(prefix):];directory=rel.rsplit('\\',1)[0]+'/' if '\\' in rel else ''
 name=(directory.replace('\\','/')+expected['name']).lower()
 assert not name.startswith('/') and '..' not in name.split('/') and ':' not in name
 rows.append(dict(path=name,bytes=len(raw),sha256=sha(raw)));payloads.append((name,raw))
 offset=start+size
assert offset==len(b) and len({x['path'] for x in rows})==39
for name,raw in payloads:
 p=dest/name
 if check:assert p.read_bytes()==raw,name
 else:p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(raw)
print(json.dumps(dict(pass_=True,checkOnly=check,sourcePrefix=prefix,files=rows),indent=2))
