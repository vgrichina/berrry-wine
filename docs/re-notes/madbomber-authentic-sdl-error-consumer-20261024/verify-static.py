"""Offline checks against retained bytes; NEVER executes the mapped snapshot."""
import pathlib,json,struct,sys
r=pathlib.Path(sys.argv[1]); b=(r/'sdl-mapped.bin').read_bytes()
d=json.loads((r/'consumer-static.json').read_text())
def check(data):
 assert data[0xcff0:0xd04b].hex()==d['bytes'], 'consumer bytes'
 assert data[0xd2c5:0xd2d3].hex()==d['callerBytes'], 'EAX/stack caller'
 assert data[0x2575c:0x25761]==b'%s: \0', 'prefix'
 assert data[0x25758:0x2575b]==b'%s\0', 'SDL_SetError format'
 p=d['winmmImportRecordRVA']; assert struct.unpack_from('<II',data,p)==(0xd2,0x22210)
 p+=8; names=[]
 while data[p]:
  assert data[p]==1; end=data.index(0,p+1);names.append(data[p+1:end].decode());p=end+1
 assert len(names)==16 and names[-1]=='waveOutGetErrorTextA'
 assert 0x1000+0x22210+4*(len(names)-1)==d['waveIATRVA']
 assert struct.unpack_from('<I',data,0xd031)[0]==d['base']+d['waveIATRVA']
check(b)
controls=[]
for name,offset in [('consumer-byte',0xcff0),('caller-ABI',0xd2c6),('import-name',0x35841)]:
 altered=bytearray(b);altered[offset]^=1
 try:check(altered)
 except (AssertionError,ValueError):controls.append({'name':name,'rejected':True})
 else:raise AssertionError('accepted corruption '+name)
print(json.dumps({'static':'PASS','negativeControls':controls,'scope':'bytes/import identity only; no native consumer output acceptance'}))
