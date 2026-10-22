"""Replay bounded recovered evidence; originals intentionally remain on Boat."""
import hashlib,json,pathlib,tarfile
E=pathlib.Path(__file__).resolve().parent
def load(p):return json.loads((E/p).read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 copies=load('remote-evidence-manifest.json')
 for x in copies:
  p=E/'raw'/x['path'];assert p.stat().st_size==x['size'] and sha(p)==x['sha256'],x['path']
 installed=load('raw/installed-audit/installed-manifest.json')
 assert len(installed['files'])==installed['fileCount']==174
 assert sum(x['size'] for x in installed['files'])==installed['totalBytes']==569072090
 manifest={x['path']:x for x in installed['files']}
 assert manifest['Age of Empires III/age3.exe']['sha256']=='5d7fb9a8ae28e3e3758cee1346b2960f20ba7b4feaa511fa7f52ceffeeeca256'
 assert manifest['Age of Empires III/data/stringtable.xml']['size']==2404654
 assert all('System:System/'+n in manifest for n in ['msxml4.dll','msxml4r.dll'])
 curl=load('raw/acquisition/curl-receipt.json');assert curl['http_code']==200 and curl['ssl_verify_result']==0 and curl['size_download']==383598224
 assert load('raw/game-run/preflight.json')['files']==load('raw/game-run/postflight.json')['files']==373
 assert load('raw/game-run/preflight.json')['passAll'] and load('raw/game-run/postflight.json')['passAll']
 assert len(load('runtime-pins.json'))==199
 assert load('raw/game-run/exit.json')['exitCode']==0
 accept=load('control-accept-click.json');assert accept['command']=={'cmd':'click:163:424'}
 assert json.loads(accept['receipt']['stdout'])['ok']
 for n in ['eula-before.png','after-accept.png','final.png']:
  p=E/'raw/game-run'/n;assert p.read_bytes().startswith(b'\x89PNG\r\n\x1a\n')
 assert sha(E/'raw/game-run/after-accept.png')==sha(E/'raw/game-run/final.png')
 assert load('raw/installed-audit/dialog-resource.json')['dialogs'][0]['resourcePath']==[5,177,1033]
 audit=load('raw/installed-audit/import-audit.json');named=sum(x['name']!='<none>' for x in audit['unknown']);assert named==53 and len(audit['unknown'])-named==45
 log=(E/'raw/game-run/output.log').read_text()
 assert '[input] click 163,424 at batch 4700011' in log
 assert 'UNIMPLEMENTED' not in log.upper()
 h=load('HANDOFF.json');assert h['box']=='bx_5mu9dnhg' and not h['guestProcesses'] and h['controlPortClosed']
 assert len(h['media'])==4
 box=load('box-state.json')['sandbox'];assert box['id']==h['box'] and box['state']=='idle' and box['health']=='ok' and box['stop'] is None
 module=load('module-inventory.json')
 assert module['moduleSha256']=='f644bbb26edc077239dac17b8b2cfda482aafd9eb44af4c4776d4fe153d5a1a7'
 p=pathlib.Path(module['archive']);assert sha(p)==module['archiveSha256']
 with tarfile.open(p) as t:b=t.extractfile('build/wine-assembly.wasm').read()
 assert len(b)==module['moduleBytes'] and hashlib.sha256(b).hexdigest()==module['moduleSha256']
 if (E/'seals.json').exists():
  for x in load('seals.json'):
   p=E/x['path'];assert p.stat().st_size==x['size'] and sha(p)==x['sha256'],x['path']
 print(json.dumps(dict(passAll=True,recoveredRemoteFiles=len(copies),recoveredBytes=sum(x['size'] for x in copies),installedFiles=174,installedBytes=569072090,runtimePins=199,prePostPins=373,namedUnmatchedInventory=named,unresolvedOrdinalInventory=45,originalDialog=177,acceptedInGuest=True,gameplay=False)))
if __name__=='__main__':main()
