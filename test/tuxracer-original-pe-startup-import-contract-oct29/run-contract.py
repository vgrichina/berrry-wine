from supervisor import *
print(run([sys.executable,str(OUT/'contract.py')],cwd=OWN,label='contract').decode())
