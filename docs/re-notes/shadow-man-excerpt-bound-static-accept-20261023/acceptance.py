"""One bounded Python acceptance sequence; fail immediately on any failure."""
import hashlib,importlib.util,json,pathlib,sys
sys.dont_write_bytecode=True
H=pathlib.Path(__file__).resolve().parent
C=pathlib.Path('/home/user/wine-assembly-shadow-man-span-static-canonical-oct23')
COMBINED=pathlib.Path('/home/user/wine-assembly-shadow-man-complete-gate-data-readiness-oct23/build/combined.wat')
s=importlib.util.spec_from_file_location('guard',H/'guard.py');g=importlib.util.module_from_spec(s);s.loader.exec_module(g)
commands=[('verify-inputs',['verify-inputs.py']),('original16',['test-static-abi.py']),('new14',['test-declaration-laws.py']),('unchanged-rejecting-probe',['reject-invalid-stride.py']),('independent-controls',['independent-controls.py']),('module-static',['static-abi.py','--input-root',str(C),'--combined',str(COMBINED),'--output-dir',str(H)]),('verify-results',['verify-results.py'])]
for label,args in commands:
 g.bounded(label,[sys.executable,str(H/args[0]),*args[1:]],cwd=H.parents[2])
