import os,runpy,pathlib,sys
H=pathlib.Path(__file__).parent
os.environ.update(AIRSTRIKE_PRODUCTION_RUNNER=str(H/'production-runner.js'),AIRSTRIKE_PROTOCOL_EVIDENCE=str(H/'protocol'),AIRSTRIKE_BRIDGE_FIXTURES=str(H))
if os.environ.get('AIRSTRIKE_ACCEPT_GROUP'):
    os.environ['AIRSTRIKE_PROTOCOL_EVIDENCE']=str(H/os.environ['AIRSTRIKE_ACCEPT_GROUP'])
sys.argv=[str(H.parent/'repo/test/test-airstrike-frozen-dispatch.py'),'-v',*sys.argv[1:]]
runpy.run_path(sys.argv[0],run_name='__main__')
