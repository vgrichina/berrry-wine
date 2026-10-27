from common import *
import ast
admission('prebuild-admission')
for p in H.glob('*.py'):ast.parse(p.read_text(),filename=str(p))
rs=json.loads((H/'stage-manifest.json').read_text())
for x in rs:
 b=pathlib.Path(x['source']).read_bytes();assert len(b)==x['bytes'] and sha(b)==x['sha256'],x['source']
route=sha((ROOT/'lib/apps.js').read_bytes());selected=sha((R/'lib/apps.js').read_bytes())
def generally(text):
 a=text.index('      generally: {');b=text.index('      generally_track_editor:',a);block=text[a:b]
 root=text[text.index('    const generallyRoot = '):].splitlines()[0];return root+'\n'+block
assert generally((ROOT/'lib/apps.js').read_text())==generally((R/'lib/apps.js').read_text()),'GeneRally registered route changed'
q=dict(at=time.time(),files=len(rs),bytes=sum(x['bytes'] for x in rs),manifestSHA256=sha((H/'stage-manifest.json').read_bytes()),source=PIN,rootAppsSHA256=route,selectedAppsSHA256=selected,generallyRouteSHA256=sha(generally((R/'lib/apps.js').read_text()).encode()),syntaxPass=True,actualMountArgv=['--app=generally','--vfs-tree='+S+'/test/binaries/candidates/generally'],mountValidation='canonical parser on assigned Boat before build and guest; checkout preceded this checkpoint (ordering incident retained)',allPinsPass=True)
save('local-verified-closure.json',q);print(json.dumps(q))
