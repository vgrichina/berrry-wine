from guard import *
configure_parent()
BOAT='/home/user/.ascii/boat'
mode=sys.argv[1]
if mode=='create':
    argv=[BOAT,'new','--ttl','1800','--json','--name','toyvm-confined-parent-exit-cleanup-oct29']
    for name in ['guard.py','remote_test.py','fixture.py','limit_contract.py','cancellation.json','source-pins.json']:
        argv+=['--file','/tmp/tvdt/'+name+'='+str(ROOT/name)]
    pins=json.load(open(ROOT/'source-pins.json'))
    for name in pins:argv+=['--file','/tmp/tvdt/repo/'+name+'='+str(REPO/name)]
    r=run(argv,cwd=ROOT);save('boat-create.json',r)
    obj=json.loads(r['stdout']);save('boat-identity.json',obj)
    print(json.dumps(obj)[:2500])
else:
    box=sys.argv[2]
    if mode=='run':
        r=run([BOAT,'exec',box,'--cwd','/tmp/tvdt','--timeout','110','--json','--','/usr/bin/python3','-B','/tmp/tvdt/remote_test.py'],cwd=ROOT,check=False)
        save('boat-runtime.json',r);print(json.dumps(dict(exit=r['exit'],stdout=r['stdout'][-1800:],stderr=r['stderr'][-700:])))
    elif mode=='get':
        code="import pathlib,json; p=pathlib.Path('/tmp/tvdt/e'); print(json.dumps({x.name:x.read_text() for x in p.glob('*') if x.is_file()}))"
        r=run([BOAT,'exec',box,'--cwd','/tmp/tvdt','--timeout','30','--json','--','/usr/bin/python3','-B','-c',code],cwd=ROOT);save('boat-evidence.json',r);print('evidence retained bytes',len(r['stdout']))
    elif mode=='stop':
        r=run([BOAT,'stop',box,'--json'],cwd=ROOT);save('boat-stop.json',r);print(r['stdout'][-1200:])
    elif mode=='info':
        r=run([BOAT,'info',box,'--json'],cwd=ROOT);save('boat-final-info.json',r);print(r['stdout'][-1600:])
