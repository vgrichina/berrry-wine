from supervisor import *
D=json.loads(Path('/home/user/wine-assembly/scratch/usage-watch/tuxracer-accepted-syntax-current-main-integration-oct29-dispatch.json').read_text())
BR='task/'+D['task']; BASE=D['baseMain']; ACCEPT=D['acceptanceCommit']; REMOTE='git@github.com:vgrichina/wine-assembly.git'
def git(args,label,init=False):return run(['git','-C',str(OWN)]+args,cwd=OWN,label=label,git=True,init=init)
def sha(b):return hashlib.sha256(b).hexdigest()
def setup():
    controls()
    git(['init','-b',BR], 'init',True)
    git(['config','user.name','Wine Ops'],'config-name');git(['config','user.email','wine-ops@users.noreply.github.com'],'config-email')
    git(['config','core.sparseCheckout','true'],'config-sparse')
    (OWN/'.git/info/sparse-checkout').write_text('/tools/recovery/\n')
    git(['remote','add','origin',REMOTE],'remote-add')
    remote=git(['ls-remote','origin','refs/heads/main'],'initial-remote').decode().split()[0]
    assert remote==BASE,('remote moved',remote)
    git(['update-ref','refs/heads/'+BR,BASE],'base-ref')
    git(['read-tree','-mu','HEAD'],'sparse-checkout')
    original=git(['show',BASE+':tools/recovery/tuxracer-original-win32-recovery-oct28.py'],'main-scanner')
    assert len(original)==D['mainScannerPin']['bytes'] and sha(original)==D['mainScannerPin']['sha256']
    pins={}
    for i,(p,pin) in enumerate(D['files'].items()):
        b=git(['show',ACCEPT+':'+p],'accepted-file-'+str(i))
        assert len(b)==pin['bytes'] and sha(b)==pin['sha256'],p
        if i==0:
            candidate=git(['show',D['candidate']+':'+p],'candidate-scanner');assert candidate==b
        (OWN/p).parent.mkdir(parents=True,exist_ok=True);(OWN/p).write_bytes(b);pins[p]=pin
    dump(E/'source-pins.json',dict(base=BASE,candidate=D['candidate'],acceptance=ACCEPT,files=pins,mainScanner=D['mainScannerPin']))
    print('Sparse current-main tree and six accepted files materialized.')
if __name__=='__main__':setup()
