from supervisor import *
run([sys.executable,str(OUT/'analyze.py')],cwd=OWN,label='analyze-original-pe')
print((OUT/'analyze-original-pe.stdout').read_text()[:8192])
