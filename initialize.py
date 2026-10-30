import supervisor as s
import hashlib,json

dispatch=json.loads((s.ROOT/'scratch/usage-watch/toyvm-offline-nonfinite-json-repair-oct29-dispatch.json').read_text())
for path,pin in dispatch['sourcePins'].items():
    data=(s.OWN/path).read_bytes()
    assert len(data)==pin['bytes'] and hashlib.sha256(data).hexdigest()==pin['sha256']
source=pathlib=None
repro=s.OWN/'test/toyvm-offline-command-independent-accept-oct29/evidence/unchanged-reproducer.json'
assert repro.read_bytes()==s.pathlib.Path(dispatch['unchangedReproducer']).read_bytes()
s.save('input-pins.json',dict(dispatch=dispatch,reproducerSHA256=hashlib.sha256(repro.read_bytes()).hexdigest(),PASS=True))
def git(label,*args):
    rc,out,err=s.run(['git','-C',str(s.OWN),*args],cwd=s.OWN,label=label,git=True)
    assert rc==0,(label,err)
git('config-name','config','user.name','Codex')
git('config-email','config','user.email','codex@users.noreply.github.com')
git('sparse-init','sparse-checkout','init','--cone','--sparse-index')
git('sparse-paths','sparse-checkout','set','test/toyvm-bounded24-caller-wiring-oct28','test/toyvm-offline-nonfinite-json-repair-oct29','test/toyvm-offline-receipt-validation-cli-oct29','test/toyvm-offline-command-independent-accept-oct29')
git('initial-index','read-tree','354c5651f6f11bbd430424c3163d7e87e125fc9a')
git('initial-ref','update-ref','refs/heads/task/toyvm-offline-nonfinite-json-repair-oct29','354c5651f6f11bbd430424c3163d7e87e125fc9a')
git('remote-add','remote','add','origin','git@github.com:vgrichina/wine-assembly.git')
