cmd=json.loads(sys.argv[-1]);ident=str(cmd['id']);remote=str(O/'control'/ (ident+'.request.json'))
# Each ID dispatches once. Existing file is a rejection, never an input replay.
code='import pathlib,json;p=pathlib.Path('+repr(remote)+');p.parent.mkdir(parents=True,exist_ok=True);f=p.open("x");f.write('+repr(json.dumps(cmd))+');f.close();print("queued",'+repr(ident)+')';q=py(code);save('control-local/'+ident+'.request.json',dict(command=cmd,api=q,at=time.time()));print('queued',ident)
