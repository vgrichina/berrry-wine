#!/usr/bin/env python3
"""Offline retained-evidence check and explicitly conditional frame arithmetic.
No emulator execution, x86 decoding, guest reproduction, build or network.
"""
import hashlib,json,pathlib,re,sys,copy
HERE=pathlib.Path(__file__).resolve().parent

def inspect(log,cfg,events):
    assert hashlib.sha256(cfg).hexdigest()=='0407969d4bf39f2287f8d99bd37feac1212e6492f41038a817f77f39ef79d42d'
    assert len(cfg)==50
    warnings=re.findall(r'\[sync\] ABANDONED wndproc.*',log)
    assert len(warnings)==2 and all('after 64 rounds (yield_reason=15)' in w for w in warnings)
    assert 'hwnd=0x00010001' in warnings[0] and 'hwnd=0x00010006' in warnings[1]
    frames=re.findall(r'\[API #(?:172|176|227)\] DialogBoxParamA.*?\[esp=(0x[0-9a-f]+) ret=(0x[0-9a-f]+)\]',log)
    assert frames==[('0x074fff50','0x00402fd5'),('0x074fff20','0x00401504'),('0x074fff18','0x004015d4')]
    markers=['[API #226] EndDialog(0x00010006','[API #227] DialogBoxParamA','[API #228] EndDialog(0x0001001c','[input] dlg-cmd: cmd=3 hwnd=0x1001c at batch 2578996','[eip-zero] guest called through NULL at batch 2578996','dbg_prev_eip=0x004015d4','Stack around ESP=0x074fff6c:']
    offsets=[log.index(x) for x in markers];assert offsets==sorted(offsets)
    for a,v in [('074fff68','00000000'),('074fff6c','00000000'),('074fff70','0040363e')]:assert f'[0x{a}] = 0x{v}' in log
    calls=[e for e in events if e.get('name')=='DialogBoxParamA' and e['kind']=='entry']
    assert [e['caller'] for e in calls]==[0x402fd5,0x401504,0x4015d4]
    # API-handler exit hooks are NOT modal guest-call returns.
    exits=[e for e in events if e.get('name')=='DialogBoxParamA' and e['kind']=='return']
    assert len(exits)==3 and all(e['eax']==1 for e in exits)
    return dict(warnings=warnings,dialogFrames=frames,firstObservedZeroBatch=2578996,lastDecodedBlock='0x004015d4',sampleESP='0x074fff6c',guestTransferKind='unobserved')

def frame_control(active_frame,resumed_esp):
    # From CACA0004: previous-pump slots at ESP+4..20; completion ESP +=24.
    # One ADDITIONAL hypothetical plain RET would then consume another 4.
    return dict(previousReturnSlot=resumed_esp+12,expectedPreviousReturnSlot=active_frame+12,
                frameMatches=resumed_esp==active_frame,completionESP=resumed_esp+24,
                afterHypotheticalPlainRET=resumed_esp+28)

def main():
    log=(HERE/'retained/session1-fixed-session.log').read_text();cfg=(HERE/'retained/session1-grafix.cfg').read_bytes()
    events=[json.loads(x) for x in (HERE/'retained/session1-output-parent-54631.jsonl').read_text().splitlines()]
    result=inspect(log,cfg,events);rejects=[]
    changes=[('changed-settings',log,cfg+b'X',events),('missing-warning',log.replace('[sync] ABANDONED wndproc','[removed]',1),cfg,events),('changed-last-block',log.replace('dbg_prev_eip=0x004015d4','dbg_prev_eip=0x00400000'),cfg,events),('wrong-final-stack',log.replace('Stack around ESP=0x074fff6c:','Stack around ESP=0x074fff70:'),cfg,events),('wrong-dialog-frame',log.replace('esp=0x074fff18 ret=0x004015d4','esp=0x074fff20 ret=0x004015d4'),cfg,events),('missing-handler-exit',log,cfg,[e for e in events if e.get('kind')!='return'])]
    for name,l,c,e in changes:
        try:inspect(l,c,e)
        except (AssertionError,ValueError):rejects.append(name)
        else:raise AssertionError('accepted corrupt evidence '+name)
    coherent=frame_control(0x074fff18,0x074fff18);displaced=frame_control(0x074fff18,0x074fff50)
    assert coherent['frameMatches'] and coherent['afterHypotheticalPlainRET']==0x074fff34
    assert not displaced['frameMatches'] and displaced['completionESP']==0x074fff68 and displaced['afterHypotheticalPlainRET']==0x074fff6c
    # The final sampled address fits the displaced model, not its coherent control.
    # Neither the resumed ESP nor a RET opcode is retained: this is not proof of execution.
    result.update(rejectingControls=rejects,conditionalFrameModels={'coherent':coherent,'displaced':displaced},causalProof=False)
    if len(sys.argv)>1:
        root=pathlib.Path(sys.argv[1]);m=json.loads((HERE/'admission.json').read_text());supp=json.loads((HERE/'admission-supplement.json').read_text())
        pins={e['path']:e['blob'] for e in m['source'] if e['path'].startswith(('src/','test/'))};pins[supp['path']]=supp['blob']
        for p,h in pins.items():
            b=(root/p).read_bytes();assert hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==h,p
        result['exactRuntimeSourcePinsVerified']=len(pins)
    print(json.dumps(result,indent=2))
if __name__=='__main__':main()
