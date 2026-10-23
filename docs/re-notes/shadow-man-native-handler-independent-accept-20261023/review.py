"""Offline independent structural oracle. Never imports fixture or WASM tooling."""
import copy, hashlib, importlib.util, json, pathlib, struct, sys
H = pathlib.Path(__file__).resolve().parent
D = pathlib.Path('/home/user/wine-assembly-shadow-man-memory-recovered-handler-qualification-oct23/docs/re-notes/shadow-man-memory-recovered-handler-qualification-20261023')
def load(name): return json.loads((D/name).read_text())
def lines(name): return [json.loads(s) for s in (D/name).read_text().splitlines()]
def sha(b): return hashlib.sha256(b).hexdigest()
def seal(x): return sha(json.dumps(x, separators=(',', ':'), ensure_ascii=False).encode())
def word(r, address): return struct.unpack_from('<I', bytes.fromhex(r['stack']['bytes']), address-r['stack']['address'])[0]
contract = load('accepted-contract.json')
regions = {x['name']:x for x in contract['layout']['regions']}
assert contract['layout']['payload'] == '9a3bc9149d58209c'
assert len(regions) == 269
assert regions['DIRECT_WINDOW']['end'] == 0x08000000
assert regions['GUEST_BASE']['base'] == 0x12000
assert regions['THUNK_BASE']['base'] == 0x7112000
thunk = regions['THUNK_BASE']['base'] - regions['GUEST_BASE']['base'] + 0x400000
exports = {x['name']:x for x in contract['exports']}
for name,nargs,results in [('send_message',4,['i32']),('init_thread',8,[]),('wnd_table_set',2,[]),('set_null_diag',1,[]),('null_diag_field',1,['i32']),('null_diag_token',0,['i64']),('null_diag_root',0,['i64'])]:
    assert exports[name]['signature'] == dict(params=['i32']*nargs,results=results), name
pins = []
for p in contract['source']:
    data = pathlib.Path(p['path']).read_bytes()
    assert len(data)==p['bytes'] and sha(data)==p['sha256']
    pins.append(dict(path=p['path'],sha256=p['sha256']))
runner = pathlib.Path(contract['source'][0]['path']).read_text()
start = runner.index("      } else if (ev.action === 'dlg-cmd') {")
end = runner.index("      } else if (ev.action === 'dlg-post-cmd') {", start)
branch = runner[start:end].replace('      } else if', '      if', 1)+'\n      }'
for mode in ['normal','capture','wrong-command']:
    assert (D/(mode+'.runner-branch.txt')).read_text() == branch
observations = {mode:lines(mode+'.observations.jsonl') for mode in ['normal','capture','wrong-command']}
receipts = {mode:load(mode+'.receipt.json') for mode in observations}
for mode, obs in observations.items():
    r=receipts[mode]
    assert all(x['pid']==r['pid'] for x in obs)
    assert [x['sequence'] for x in obs] == list(range(len(obs)))
    assert r['reaped'] and r['remaining']==[] and r['reason'] is None
    assert r['streamBytes']==dict(stdout=0,stderr=0)
    assert obs[0]['module']==contract['module']
    assert obs[0]['fixtureSha256']==sha((D/'fixture.cjs').read_bytes())
    assert obs[0]['branchSha256']==sha(branch.encode())
    assert obs[1]['arenaCount']==1 and obs[1]['workers']==0
    init=next(x for x in obs if x.get('phase')=='initialized-before-action')
    assert init['thunkGuest']==thunk and init['diagCount']==0
    assert init['metadata']==[dict(marker=0xcaca0005,id=0),dict(marker=0xcaca0004,id=0),dict(marker=0x80000001,id=2875),dict(marker=0x80000002,id=131)]
    # Build the x86 independently from instruction lengths and absolute targets.
    code=b''.join(b'\x68'+struct.pack('<I',v) for v in [0,0x402000,0,0x403000,0])
    code+=b'\xe8'+struct.pack('<i',thunk+16-(0x4015d4+30))
    code+=b'\xa3'+struct.pack('<I',0x404000)+b'\xc2\x10\x00'
    dlgcode=b'\x8b\x44\x24\x04\x68\x77\x00\x00\x00\x50\xe8'+struct.pack('<i',thunk+24-(0x402000+15))+b'\xb8\x01\x00\x00\x00\xc2\x10\x00'
    assert init['code']==code.hex() and init['dlgcode']==dlgcode.hex()
capture=lines('capture.capture.jsonl')
def oracle(cap):
    pre=cap[0]['receipt']; records=[x['record'] for x in cap if 'record' in x]
    for x in cap[:-1]:
        obj=x.get('record',x.get('receipt')); assert seal(obj)==x['sha256']
    assert [r['kind'] for r in records]==['sender-pre','decoded-block','modal-frame-consume','modal-frame-complete','first-zero']
    assert [r['sequence'] for r in records]==list(range(5))
    assert cap[-1]==dict(terminal=True,reason='first-zero',exit=86)
    assert pre['prior']['boundary']['eventCount']==pre['prior']['boundary']['syncDepth']==0
    assert pre['selection']['cmdId']==3 and pre['selection']['hwnd']==0x550
    assert pre['selection']['actionSequence']==1 and pre['selection']['batch']==50
    assert pre['selection']['priorActions']==[]
    assert pre['selection']['pid']==receipts['capture']['pid']==1989364
    a,b,c,d,e=records
    assert a['registers']==pre['prior']['registers']
    for r in records:
        assert r['metadata']==pre['metadata']
        assert r['metadata']['actualModule']['moduleSha256']==contract['module']['sha256']
        assert r['metadata']['pid']==1989364
        assert r['stack']['address']==r['registers']['esp']-32
        assert bytes.fromhex(r['code']['bytes']).startswith(code)
        if 'boundary' in r:
            assert r['boundary']['token']=='3' and r['boundary']['root']=='2'
            assert r['boundary']['syncDepth']==1
    assert [r['boundary']['eventCount'] for r in [a,c,d,e]]==[1,2,3,4]
    outer=0x740f000
    assert a['boundary']['savedEip']==0x404100 and a['boundary']['savedEsp']==outer
    assert b['registers']['eip']==0x4015d4 and b['registers']['esp']==outer-20
    assert [word(b,outer-20+4*i) for i in range(5)]==[thunk,0x550,0x111,3,0]
    esp=c['registers']['esp']
    assert esp==outer-44 and c['registers']['eip']==thunk+8
    assert word(c,esp-4)==0xdcbaabcd
    assert [word(c,esp+4*i) for i in range(6)]==[0x4015f2,0,0,0,0,0]
    assert word(c,esp+24)==thunk
    assert c['boundary']['pumpHwnd']==c['boundary']['sharedPumpHwnd']==65537
    assert c['boundary']['ended']==1 and c['boundary']['sharedEnded']==0
    assert c['boundary']['returnAddress']==0x4015f2
    assert d['registers']['esp']==esp+24 and d['registers']['eip']==0x4015f2
    assert d['registers']['eax']==0x77 and d['boundary']['pumpHwnd']==d['boundary']['sharedPumpHwnd']==0
    assert d['boundary']['returnAddress']==0 and d['boundary']['savedEsp']==esp
    assert e['registers']['esp']==outer and e['registers']['eip']==0 and e['registers']['eax']==0x77
    assert e['classification']=='ordinary-or-unknown; zero-writer unproven'
    assert e['stop'] and e['continuation']=='forbidden'
    assert not any(r['kind']=='sender-before-restore' for r in records)
oracle(capture)
tampered=copy.deepcopy(capture)
tampered[4]['record']['registers']['esp']+=4
tampered[4]['sha256']=seal(tampered[4]['record'])
try: oracle(tampered)
except AssertionError: tamperRejected=True
else: raise AssertionError('resealed modal stack corruption accepted')
n=observations['normal']; assert n[-1]['phase']=='normal-complete'
assert n[-1]['registers']==next(x for x in n if x.get('phase')=='initialized-before-action')['registers']
assert n[-1]['modalResult']==0x77 and n[-1]['diagCount']==n[-1]['syncDepth']==0
w=observations['wrong-command']; assert w[-2]['phase']=='intended-negative-rejected'
assert w[-2]['diagCount']==0 and w[-2]['registersUnchanged'] and w[-2]['guestCallbackNotRun']
assert lines('wrong-command.capture.jsonl')==[dict(terminal=False,failure='missing terminal capture',exit=0)]
assert [receipts[m]['childExit'] for m in observations]==[0,86,0]
assert len([x for x in observations['capture'] if x.get('phase')=='capture-fsync-complete'])==7
failureSummary=[]
for name in ['normal-initialization-failure','normal-rect-contract-failure','normal-invalidate-contract-failure','normal-dll-probe-contract-failure']:
    fail=lines(name+'.observations.jsonl')[-1];r=load(name+'.receipt.json')
    assert 'UNIMPLEMENTED_HOST_CONTRACT' in fail['failure'] and r['exit']==1 and r['reaped']
    failureSummary.append(dict(case=name,pid=r['pid'],failure=fail['failure']))
# No native code: load only the subject's Python supervisor into an isolated probe directory.
spec=importlib.util.spec_from_file_location('subject_guard',D/'guard.py');g=importlib.util.module_from_spec(spec);spec.loader.exec_module(g)
probe=H/'boundary';probe.mkdir();g.H=probe;g.ROOT=probe;g.EXT=probe/'external';g.EXT.mkdir()
(probe/'saturated.receipt.json').write_text(json.dumps(dict(capturedBytes=524288,syntheticCounterSeed=True)))
z=g.run('zero-output',['/usr/bin/python3','-B','-c','pass'],cwd=probe,destination=probe)
one=g.run('one-byte',['/usr/bin/python3','-B','-c',"import os;os.write(1,b'x')"],cwd=probe,destination=probe,expected=(125,))
assert z['previousCaptureBytes']==z['aggregateAfter']==524288 and z['exit']==0
assert one['previousCaptureBytes']==524288 and one['aggregateAfter']==524289
assert one['exit']==125 and one['reason']=='aggregate capture overflow' and one['capturedBytes']==0
assert z['reaped'] and one['reaped'] and not z['remaining'] and not one['remaining']
result=dict(verdict='ACCEPT_SCOPED_SYNTHETIC_FULL_MODULE_HANDLER_CAPTURE',subjectCommit='2de825962dc45ac541ee9e0849bff2273eb5f4c8',module=contract['module'],pins=pins,branchSha256=sha(branch.encode()),nativePIDs={m:r['pid'] for m,r in receipts.items()},rawOracle='PASS',resealedModalEspTamperRejected=tamperRejected,normal='diag OFF, result119, restored nine registers, depth0',wrongCommand='pre-arm rejection, exit0 wrapper, missing terminal NOT successful capture',hostFailures=failureSummary,fsyncCompleted=7,boundaryProbe=dict(zeroExit=z['exit'],oneByteExit=one['exit'],counterBefore=524288,counterAfter=524289,cap=524288,reaped=True),nativeExecutedByReviewer=False)
(H/'review-results.json').write_text(json.dumps(result,indent=2)+'\n')
