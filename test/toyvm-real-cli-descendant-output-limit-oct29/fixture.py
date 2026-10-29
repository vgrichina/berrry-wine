import subprocess
child = subprocess.Popen(['/usr/bin/python3','-B','-c',"import os,time; time.sleep(0.15); os.write(1,b'D'*2048); time.sleep(0.3)"])
child.wait()
