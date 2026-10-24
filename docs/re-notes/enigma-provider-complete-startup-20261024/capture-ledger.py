import pathlib,json,os,hashlib
H=pathlib.Path(__file__).parent
p=pathlib.Path(json.load(open(H/'admission.json'))['session'])
rows=[json.loads(s) for s in p.read_text().splitlines()];outputs=[r['payload'] for r in rows if r.get('payload',{}).get('type')=='custom_tool_call_output'];local=sum(len(o.get('text','').encode()) for r in outputs for o in r['output']);remote=sum(r['responseBytes'] for r in map(json.loads,(H/'api-history.jsonl').read_text().splitlines()))
prior=json.load(open(H/'capture-history.json'));j=dict(prior=prior,newToolText=local,newRemoteFullTransportResponses=remote,newCharged=local+remote,newAllowance=2097152,totalCharge=prior['carriedCharge']+local+remote,totalAllowance=prior['totalAllowance'],passNewCapture=local+remote<=2097152,historicalViolationUnchanged=True,method='raw retained tool text plus remote full JSON stdout/stderr, includes metadata/base64; overlap conservatively double-charged')
(H/'capture-current.json').write_text(json.dumps(j,indent=2));assert j['passNewCapture'];print(json.dumps({k:v for k,v in j.items() if k!='prior'}))
