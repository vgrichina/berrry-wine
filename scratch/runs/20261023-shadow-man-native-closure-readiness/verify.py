"""One bounded offline pin/graph/evidence check and omission controls."""
import hashlib,json,os,pathlib,shutil,subprocess
from analyze import analyze
E=pathlib.Path(__file__).resolve().parent;W=E.parents[2]
BASE='58e90870a40a541a4083cae5e987ca8de31889e6'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(n):return json.loads((E/n).read_text())
def git(*a):return subprocess.check_output(['git','-C',str(W),*a],env=dict(os.environ,GIT_NO_LAZY_FETCH='1')).decode()
def verify():
    g=analyze();assert g==read('native-graph.json')
    for x in read('source-pins.json'):
        b=(E/'source'/x['path']).read_bytes()
        assert len(b)==x['bytes'] and hashlib.sha256(b).hexdigest()==x['sha256']
        assert hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==x['gitBlob']==git('ls-tree',BASE,'--',x['path']).split()[2]
    assert sha(E/'accepted/installed-payload.json')=='db622e10cba19435bef1cd5a014a3a1cec38d30c648f132f6474964cae63b532'
    assert sha(E/'accepted/original-registry.json')=='d7143f29d29576cd015ec875264028fa70795d0f18de457e31927048081d9de3'
    assert sha(E/'accepted/stream-session.log')=='d7871336e1a7a05fabf43739c0700b85f9e3077fc3b6fd027c30904afb2a87af'
    log=(E/'accepted/stream-session.log').read_text()
    assert log.count('DllMain returned, EAX=0x1')==2 and '1886787 batches' in log
    assert '[ShowWindow] hwnd=0x10001 cmd=1' in log and '1886778 serviced on the main thread' in log
    events=[json.loads(l) for l in (E/'accepted/observer.jsonl').read_text().splitlines()]
    assert sum(x['kind']=='module-instance' for x in events)==1 and not any(x['kind']=='fork' for x in events)
    assert next(x for x in events if x['kind']=='entry' and x['name']=='DialogBoxParamA')['args'][1]==122
    d=next(x for x in g['files']['d3dconfigutility.exe']['dialogs'] if x['id']==122)
    assert d['title']=='ShadowMan Launcher' and d['controls'][0]['text']=='Konfiguration'
    assert d['controls'][1]['text']=='Spielen' and int(d['controls'][1]['style'],16)&0x08000000
    # Ordinal safety is specific to this import, not the warning's generic claim.
    ordinal_map=(E/'source/src/08b-dll-loader.wat').read_text()
    assert '(i32.const 877)))) ;; InitCommonControls' in ordinal_map
    api=read('source/src/api_table.json');assert api[877]['name']=='InitCommonControls'
    assert any(x['name']=='StringFromGUID2' for x in api)
    com=g['files']['comctl32.dll'];assert next(x for x in com['exports'] if x['ordinal']==17)['name']=='InitCommonControls'
    def prerequisite(importer,available):
        failures=[]
        for x in g['files'][importer]['imports']:
            if x['dll']=='comctl32.dll' and x['ordinals']==[17]:continue
            if x['dll']=='dsetup.dll' and x['ordinals']:
                if x['dll'] not in available:failures.append('dsetup.dll ordinal '+str(x['ordinals']))
                else:
                    exports={e['ordinal'] for e in g['files']['dsetup.dll']['exports']}
                    if not set(x['ordinals'])<=exports:failures.append('missing native export')
        return failures
    assert not prerequisite('d3dconfigutility.exe',{'dsetup.dll'})
    assert prerequisite('d3dconfigutility.exe',set())==['dsetup.dll ordinal [11]']
    assert next(x for x in g['files']['dsetup.dll']['imports'] if x['dll']=='ole32.dll')=={'dll':'ole32.dll','names':['StringFromGUID2'],'ordinals':[]}
    assert not (pathlib.Path('/home/user/wine-assembly/test/binaries/dlls/ole32.dll')).exists()
    # Declared seed: missing bytes must reject; receipt alone cannot supply them.
    def seed_gate(available):
        if 'mss32.dll' not in available:raise ValueError('declared DLL not found: exact original mss32.dll')
    try:seed_gate(set())
    except ValueError:pass
    else:raise AssertionError('seed omission accepted')
    tree={p:h.split()[:3:2] for l in git('ls-tree','-r',BASE).splitlines() for h,p in [l.split('\t',1)]}
    idx={p:h.split()[:2] for l in git('ls-files','--stage').splitlines() for h,p in [l.split('\t',1)]}
    assert len(tree)==8279 and all(idx[p]==h for p,h in tree.items())
    for x in read('protected-before.json'):
        p=pathlib.Path(x['path']);assert (sha(p) if p.is_file() else None)==x['sha256'],str(p)
    a=read('admission-revised.json');own=int(subprocess.check_output(['du','-s','-B1',str(W)]).split()[0]);donors={p:int(subprocess.check_output(['du','-s','-B1',p]).split()[0]) for p in a['donorsAllocated']}
    total=sum(donors.values())+own+a['rootInputsAndSelectedGitAllowance']+a['toolsAllowance']+a['reserve']
    assert own<a['ownCheckoutTempOutputGitAllowance'] and total<a['cap'] and shutil.disk_usage(W).free>a['hostFloor']
    for p in E.rglob('*'):
        assert not p.is_symlink()
    return {'passAll':True,'basePathsPreserved':8279,'pinChecks':'original receipt, accepted installed manifest, actual registry, raw trace and exact main source blobs','controls':{'omitDsetup':'REJECT native ordinal11','omitComctl':'ACCEPT mapped ordinal17; no blanket ordinal claim','omitOle32':'named system fallback; API presence is not execution proof','omitMssSeed':'REJECT declared seed'},'completeRecursiveClosure':False,'missingExactPEInputs':['mss32.dll','shadowman.exe','ole32.dll (only for optional full-native plan)'],'guestInstancesThisTask':0,'buildsThisTask':0,'protectedMetadata':'UNCHANGED','ownAllocated':own,'wholeLocalWithReserve':total,'hostFree':shutil.disk_usage(W).free}
if __name__=='__main__':
    r=verify();(E/'verification.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r))
