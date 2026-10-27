from transport import *
gate('before-transfer')
save('transfer.json',send((O/'harness.tar.gz').read_bytes(),'harness.tar.gz'))
code='import pathlib,tarfile; h=pathlib.Path('+repr(REMOTE)+'); t=tarfile.open(h/"transport/harness.tar.gz"); t.extractall(h,filter="data"); print("extracted bounded harness")'
api(code,'extract')
print(api('import runpy,sys; sys.argv=["remote-run.py","startup"]; runpy.run_path('+repr(REMOTE+'/ops/remote-run.py')+',run_name="__main__")','startup',timeout=130)['stdout'])
