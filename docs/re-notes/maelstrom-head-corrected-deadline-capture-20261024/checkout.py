import pathlib,subprocess,json
H=pathlib.Path(__file__).parent.parent;R=H/'repo';D=pathlib.Path('/tmp/maelstrom-native-recovered-closeout-oct24/repo');R.mkdir()
subprocess.run(['git','init','-q',str(R)],check=True)
seen=set();paths=[]
def visit(p):
 p=p.resolve()
 if str(p) in seen:return
 seen.add(str(p));paths.append(str(p));a=p/'info/alternates'
 if a.exists():
  for n in a.read_text().splitlines():visit(pathlib.Path(n) if n.startswith('/') else p/n)
visit(D/'.git/objects');(R/'.git/objects/info/alternates').write_text('\n'.join(paths)+'\n')
for k,v in [('core.sparseCheckout','true'),('core.sparseCheckoutCone','false')]:subprocess.run(['git','-C',str(R),'config',k,v],check=True)
(R/'.git/info/sparse-checkout').write_text('/CLAUDE.md\n/AGENTS.md\n/.gitignore\n/docs/re-notes/maelstrom-head-corrected-deadline-capture-20261024*\n')
subprocess.run(['git','-C',str(R),'checkout','-q','-b','task/'+H.name,'4ba28bf1d8b0644f237e8a4f29f54241446b1bcd'],check=True)
subprocess.run(['git','-C',str(R),'remote','add','origin','git@github.com:vgrichina/wine-assembly.git'],check=True)
