import sys,pathlib,runpy,json,time
O=pathlib.Path(__file__).parent
first,last=map(int,sys.argv[1:])
for i in range(first,last):
 assert time.time()<1793109180,'staging deadline reached'
 sys.argv=[str(O/'transfer.py'),str(i)];runpy.run_path(str(O/'transfer.py'),run_name='__main__')
