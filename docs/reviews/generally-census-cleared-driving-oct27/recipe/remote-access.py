from common import *
import sys
if sys.argv[1]=='probe':
 admission('remote-probe-admission')
 x=py('remote-probe','import pathlib,os,json,resource,shutil; n=pathlib.Path("/home/user/.nvm/versions/node/v24.22.1/bin/node"); print(json.dumps(dict(nodeExists=n.is_file(),cwd=os.getcwd(),limits={str(k):resource.getrlimit(k) for k in (0,1,2,9)},diskFree=shutil.disk_usage("/tmp").free,mem=pathlib.Path("/proc/meminfo").read_text().split("MemAvailable:")[1].split()[0])))')
 save('remote-probe.json',x);print(x)
elif sys.argv[1]=='range':
 start,end=map(int,sys.argv[2:]);stage_code=(H/'stage.py').read_text()
 for i in range(start,end):
  sys.argv=['stage.py',str(i)];exec(compile(stage_code,str(H/'stage.py'),'exec'),{'__file__':str(H/'stage.py'),'__name__':'__main__'})
