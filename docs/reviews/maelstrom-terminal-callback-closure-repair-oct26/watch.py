from control import *
limits();signal.alarm(60)
label=sys.argv[1]
dump(O/(label+'-owner.json'),dict(pid=os.getpid(),uid=os.getuid(),startTicks=pathlib.Path('/proc/self/stat').read_text().split()[21],argv=sys.argv))
print(run(label,['timeout','--signal=TERM','--kill-after=5','55','tail','-n','0','-f',str(ROOT/'messageboard.txt')],B,expected=124))
dump(O/(label+'-cleanup.json'),dict(reaped=True,exit=124,otherProcessesSignalled=0))
