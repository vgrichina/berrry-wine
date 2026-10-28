import os,sys,pathlib
B=pathlib.Path(__file__).resolve().parent;name=sys.argv[1]
for fd,suffix in [(1,'stdout'),(2,'stderr')]:
 out=os.open(B/(name+'.'+suffix),os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600);os.dup2(out,fd);os.close(out)
os.chdir(B)
exe='/home/user/.nvm/versions/node/v24.22.1/bin/node'
os.execv(exe,[exe,'--max-old-space-size=320',str(B/('browser.cjs' if name=='browser' else 'startup.cjs'))])
