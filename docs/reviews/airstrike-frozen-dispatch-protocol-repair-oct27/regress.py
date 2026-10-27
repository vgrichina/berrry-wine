import os,runpy,pathlib,sys
H=pathlib.Path(__file__).parent
os.environ['AIRSTRIKE_BRIDGE_FIXTURES']=str(H)
sys.argv=[str(H.parent/'repo/test'/sys.argv[1]),'-v']
runpy.run_path(sys.argv[0],run_name='__main__')
