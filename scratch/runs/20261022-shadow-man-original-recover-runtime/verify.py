"""Independent offline replay of recovered receipts and manifests."""
import hashlib,json,pathlib,re,tarfile
E=pathlib.Path(__file__).resolve().parent
def load(p):return json.loads((E/p).read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
copies=load('raw/evidence-manifest.json')
for x in copies:
    p=E/'raw'/x['path'];assert p.stat().st_size==x['size'] and sha(p)==x['sha256'],x['path']
receipt=json.loads(load('collection-receipt.json')['stdout'])
assert len(copies)==receipt['files']==53
assert sum(x['size'] for x in copies)==receipt['uncompressedBytes']==1863322
assert sha(E/'evidence.tar.gz')==receipt['sha256']
with tarfile.open(E/'evidence.tar.gz') as t:
    for x in copies:assert t.extractfile(x['path']).read()==(E/'raw'/x['path']).read_bytes()
original=load('raw/receipt/closure.json');fresh=load('raw/recovery/extracted-members.json')['extractedMembers']
assert len(fresh)==len(original['members'])==23 and sum(x['bytes'] for x in fresh)==73339636
assert {x['name'] for x in fresh}=={x['name'] for x in original['members']}
for a,b in zip(original['members'],fresh):
    assert a['name']==b['name'] and a['bytes']==b['bytes']
    assert a['sha256'] is None or a['sha256']==b['sha256']
native=load('raw/native-audit/native-manifest.json');files=native['files']
listing=(E/'raw/native-audit/list.txt').read_text();rows=[]
for line in listing.splitlines():
    m=re.match(r'^\s*(\d+)\s+(Program Executable Files\\.+)$',line)
    if m:rows.append((m[2].replace('Program Executable Files','Program_Executable_Files').replace('\\','/'),int(m[1])))
assert len(files)==len(rows)==native['fileCount']==1959
assert {x['path']:x['size'] for x in files}==dict(rows)
assert sum(x['size'] for x in files)==native['totalBytes']==100354053
vfs={x['path']:x for x in load('raw/setup-run/vfs-manifest.json')}
for x in fresh:assert vfs[x['name'].lower()]['sha256']==x['sha256'] and vfs[x['name'].lower()]['size']==x['bytes']
assert load('raw/setup-run/preflight.json')['files']==load('raw/setup-run/postflight.json')['files']==250
assert load('raw/setup-run/preflight.json')['passAll'] and load('raw/setup-run/postflight.json')['passAll']
module=load('module-inventory.json')
assert module['moduleSha256']=='f644bbb26edc077239dac17b8b2cfda482aafd9eb44af4c4776d4fe153d5a1a7'
archive=pathlib.Path(module['archive']);assert sha(archive)==module['archiveSha256']=='3e308c0012e996070a01c1f77d6f399e9aaf7adb2d2620b27af018a80d29e248'
with tarfile.open(archive) as t:assert hashlib.sha256(t.extractfile('build/wine-assembly.wasm').read()).hexdigest()==module['moduleSha256']
assert len(load('runtime-pins.json'))==199 and len(load('runner-pins.json'))==28
assert len([x for x in load('runtime-pins.json') if x['path'].startswith('fonts/')])==29
log=(E/'raw/setup-run/output.log').read_text()
assert '"Setup Initialization Error"' in log and 'Error 112.' in log
assert '[capture-launch] no VFS-backed executable was launched' in log
assert 'UNIMPLEMENTED' not in log.upper()
exit=load('raw/setup-run/exit.json');assert exit['exitCode']==0 and exit['elapsedSeconds']<240 and not exit['externalTERM'] and not exit['externalKILL']
assert sha(E/'raw/setup-run/initial-error.png')==sha(E/'raw/setup-run/final.png')
assert (E/'raw/setup-run/final.png').read_bytes().startswith(b'\x89PNG\r\n\x1a\n')
assert load('control-stop-at-blocker.json')['command']=={'action':'quit'}
state=load('raw/setup-run/installed-state-audit.json');assert not state['acceptedInGuest'] and not state['installedDemo'] and not state['registryAcclaimShadowManMentions']
audit=load('raw/native-audit/import-audit.json');assert len(audit['pe'])==13 and len(audit['nonPeMZ'])==2
unknown=audit['unknown'];assert len(unknown)==20 and sum(x['name']=='<none>' for x in unknown)==8
handoff=load('raw/HANDOFF.json');assert handoff['box']=='bx_5mu9dnhg' and not handoff['guestProcesses'] and all(handoff['controlPortsClosed'].values())
box=load('box-state.json')['sandbox'];assert box['state']=='idle' and box['health']=='ok' and box['stop'] is None
if (E/'seals.json').exists():
    for x in load('seals.json'):assert sha(E/x['path'])==x['sha256'] and (E/x['path']).stat().st_size==x['size'],x['path']
print(json.dumps(dict(passAll=True,remoteFiles=len(copies),remoteBytes=receipt['uncompressedBytes'],sourceFiles=23,sourceBytes=73339636,nativeFiles=1959,nativeBytes=100354053,runtimePrePostPins=250,fontAndSupportPins=29,unknownNamed=12,unresolvedOrdinalRows=8,setupError=112,acceptedInGuest=False,installed=False,gameplay=False)))
