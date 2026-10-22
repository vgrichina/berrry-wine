import pathlib,json,base64,hashlib,tarfile
from remote import run,E
D='/home/user/aoe3-original-oct22/diagnostics-native-parse-cause-20261022T1125Z'
s=(E/'collect-remote.py').read_text().replace('/home/user/aoe3-original-oct22/diagnostics-targeted-localization-20261022T1058Z',D);(E/'collect-remote.py').write_text(s)
r=run(s,'collection',60);o=json.loads(r['stdout']);(E/'collection-result.json').write_text(json.dumps(o,indent=2));print('records',o['summary']['records'],'raw',o['summary']['rawBytes'],'archive',o['archive']['size'])
a=o['archive'];buf=bytearray()
for i in range(0,a['size'],200000):
 r=run('import pathlib,base64; p=pathlib.Path(%r); f=p.open("rb"); f.seek(%d);print(base64.b64encode(f.read(200000)).decode())'%(a['path'],i),'archive-read-'+str(i));buf.extend(base64.b64decode(r['stdout']))
assert len(buf)==a['size'] and hashlib.sha256(buf).hexdigest()==a['sha256'];(E/'capture.tar.gz').write_bytes(buf);(E/'raw').mkdir();
with tarfile.open(E/'capture.tar.gz') as t:
 for x in t.getmembers():assert '/' not in x.name
 t.extractall(E/'raw',filter='data')
print('collected',o['process'])
