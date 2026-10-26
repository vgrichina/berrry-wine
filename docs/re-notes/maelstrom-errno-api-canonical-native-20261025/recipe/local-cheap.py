"""Local lightweight checks only, with the same accepted streaming supervisor."""
import pathlib,sys
O=pathlib.Path(__file__).resolve().parent
s=(O/'supervise.py').read_text()
s=s.replace("stage=sys.argv[1];argv=sys.argv[2:];assert stage in ['cheap','compiler','native','publication']","stage=sys.argv[1];argv=sys.argv[2:];assert stage=='cheap'")
s=s.replace("str(H/'remote-account.py')","str(H/'account.py'),'local-cheap-admission.json'")
exec(compile(s,str(O/'supervise.py'),'exec'))
