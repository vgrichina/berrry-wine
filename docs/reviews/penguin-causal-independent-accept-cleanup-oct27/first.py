import pathlib,subprocess,sys,json,hashlib,time,os
H=pathlib.Path(__file__).parent; I=pathlib.Path('/tmp/penguin-streams-independent-accept-oct27/ops')
S=H.parent/'repo/tools/penguin_capture_contract.py'; P=I/'independent/fault-open/profile.json'
sha=lambda b:hashlib.sha256(b).hexdigest()
assert sha(S.read_bytes())=='9ec154496d10053252701d786f26e821fc226db3bdcb0e948f45e68ab0045cb0'
original=(I/'fault_cli.py').read_bytes()
assert sha(original)=='c11789f67ba6918ea3ea7617c85c077dcced4fa3de8fa51cb7355ba6fe4081e0'
adapted=original.decode().replace('/tmp/penguin-streams-independent-accept-oct27/repo/tools/penguin_capture_contract.py',str(S)).replace('93e192ef2512a62ca00102d6a90d9d9999dec4e2989a53e89c8458dca29711eb',sha(S.read_bytes()))
F=H/'fault_cli_rebound.py';F.write_text(adapted)
cmd=[sys.executable,'-B',str(F),'open','supervise',str(P),'--sha256',sha(P.read_bytes()),'--output',str(H/'original-reproducer')]
with (H/'original-cli.stdout').open('wb') as out,(H/'original-cli.stderr').open('wb') as err:
 r=subprocess.run(cmd,stdout=out,stderr=err,timeout=15)
q=json.loads((H/'original-reproducer/receipt.json').read_bytes());phase=q['phases'][0]
data=(H/'original-reproducer/startup.stderr').read_bytes()
assert r.returncode==2 and q['guest_starts']==0 and len(q['phases'])==1 and 'pid' not in phase
assert b'INDEPENDENT_STDOUT_OPEN_EACCES' in data
assert phase['status']=='failed' and phase['reason']=='setup'
assert phase['streams']['stdout']['status']=='unavailable' and phase['streams']['stdout']['sha256'] is None
assert q['text_bytes']==len(data) and phase['streams']['stderr']['sha256']==sha(data)
assert not (H/'original-reproducer/startup.stdout').exists()
receipt=dict(at=time.time(),candidate=json.loads((H/'pins.json').read_text())['candidate'],result='PASS',group='earliest production CLI original stdout-open failure',command=cmd,sourceSHA256=sha(S.read_bytes()),originalFixtureSHA256=sha(original),reboundFixtureSHA256=sha(F.read_bytes()),profileSHA256=sha(P.read_bytes()),binding='Only exact candidate path and hash changed; unchanged fault, runpy main, profile and CLI. Child never spawned, donor paths not written.',expected='causal stderr retained; stdout explicitly unavailable; zero child starts and no invented PID',actual=q,remaining=['independent late-descendant and resource/fault boundaries','compact evidence publication'],gates=['large PNG provider 1MiB unsupported','mount/runtime/projectile/gameplay OPEN'])
(H/'checkpoint.json').write_text(json.dumps(receipt,indent=2)+'\n')
(H/'first-result.json').write_text(json.dumps(receipt,indent=2)+'\n')
print('Original production CLI stdout-open reproducer PASS: retained causal stderr, explicit unavailable stdout, no child or invented PID')
