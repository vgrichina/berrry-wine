from common import *
save('db-baseline.json',{str(p):alloc(p) for p in pathlib.Path('/home/user/.codex').glob('*-wal')})
save('source-manifest.json',verify());gate('initial',True)
# Local fixture has no mount options. Validate that exact empty argv using the canonical parser.
src=(ROOT/'test/run.js').read_text();parser=src[src.index('const getArg ='):src.index('// Was `--name=...`')]
code='const args=[];'+parser+';if(getArgs("vfs-mount").length||getArgs("vfs-tree").length)throw Error("unexpected mounts");console.log("PASS local fixture: no mounts")'
save('mount-configuration.json',dict(argv=[],enumeration=[],commaFilenames=[],parserSHA256=sha(parser.encode()),result=run([NODE,'--max-old-space-size=512','-e',code]).decode(),fixtureArgv=[NODE,'--max-old-space-size=512',str(S/'test/test-d3dim-palette-gpu-web.js')],trustedSSH=SSH))
assert not (S/'.git').exists()
g('init','-q',str(S));g('config','gc.auto','0');g('config','user.name','Wine Ops');g('config','user.email','wine-ops@local')
paths=[r['path'] for r in verify()['files']]
g('add','--',*paths);g('commit','-q','-m','Recovered 149-file subset of main '+REV+'; not the main tree')
commit=g('rev-parse','HEAD').decode().strip()
assert len(g('ls-files','-z').split(b'\0'))-1==149
save('snapshot-identity.json',dict(snapshotCommit=commit,originalMainRevision=REV,completeMapping='source-manifest.json',subsetNotMain=True,gitAllocated=alloc(S/'.git')))
files=[pathlib.Path(NODE).resolve(),pathlib.Path('/usr/bin/google-chrome').resolve(),pathlib.Path('/opt/google/chrome/chrome')]
mods=pathlib.Path('/tmp/wa-local-runtime-deps/node_modules')
tool=[]
for p in files:tool.append(dict(path=str(p),bytes=p.stat().st_size,sha256=sha(p.read_bytes())))
moduleRows=[]
for p in sorted(mods.rglob('*')):
 if p.is_file():moduleRows.append(dict(path=str(p.relative_to(mods)),bytes=p.stat().st_size,sha256=sha(p.read_bytes())))
save('installed-module-manifest.json',moduleRows)
save('tool-identity.json',dict(files=tool,node=run([NODE,'--version']).decode().strip(),chrome=run(['/usr/bin/google-chrome','--version']).decode().strip(),moduleManifestSHA256=sha((O/'installed-module-manifest.json').read_bytes()),standingReadonlyAllocated=dict(chrome=alloc(pathlib.Path('/opt/google/chrome')),modules=alloc(mods))))
gate('prepared',True)
