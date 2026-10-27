from transport import *
gate('before-'+sys.argv[1])
label=sys.argv[1]
print(api('import runpy,sys; sys.argv=["remote-run.py",'+repr(label)+']; runpy.run_path('+repr(REMOTE+'/ops/remote-run.py')+',run_name="__main__")',label,timeout=130)['stdout'])
