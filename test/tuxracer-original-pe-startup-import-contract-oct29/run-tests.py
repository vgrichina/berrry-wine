from supervisor import *
print(run([sys.executable,str(OUT/'test_contract.py'),'-v'],cwd=OWN,label='tests').decode())
print((OUT/'tests.stderr').read_text()[:5000])
