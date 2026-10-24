from work import *
def toolbytes(p):
 total=0
 for line in p.read_text().splitlines():
  try:j=json.loads(line).get('payload',{})
  except ValueError:continue
  if j.get('type')=='custom_tool_call_output':
   out=j.get('output',[])
   if isinstance(out,str):total+=len(out.encode())
   else:total+=sum(len(v.get('text','').encode()) for v in out if isinstance(v,dict))
  elif j.get('type')=='function_call_output':total+=len(str(j.get('output','')).encode())
 return total
oldSession=pathlib.Path(json.load(open(P/'admission.json'))['session'])
oldRemote=sum(x['responseBytes'] for x in map(json.loads,(P/'api-history.jsonl').read_text().splitlines()))
older=json.load(open(P/'capture-history.json'))['carriedCharge']
prior=dict(olderCarried=older,previousSession=str(oldSession),previousSessionSHA256=sha(oldSession.read_bytes()),previousSessionBytes=oldSession.stat().st_size,previousToolText=toolbytes(oldSession),previousRemoteFullTransport=oldRemote)
prior['carriedCharge']=older+prior['previousToolText']+oldRemote
sp=pathlib.Path(json.load(open(H/'admission.json'))['session']);local=toolbytes(sp)
remoteBytes=sum(x['responseBytes'] for x in map(json.loads,(H/'api-history.jsonl').read_text().splitlines()))
j=dict(prior=prior,newToolText=local,newRemoteFullTransport=remoteBytes,newCharged=local+remoteBytes,newAllowance=2097152,totalCharge=prior['carriedCharge']+local+remoteBytes,historicalViolationRetained=True,passNewCapture=local+remoteBytes<=2097152,method='Full retained session tool result text plus full remote JSON response bytes including metadata/base64; conservative overlap charge, no history reset')
save('capture-current.json',j);assert j['passNewCapture'];print(json.dumps(dict(newCharged=j['newCharged'],priorCarried=prior['carriedCharge'],passCapture=True)))
measure('current')
