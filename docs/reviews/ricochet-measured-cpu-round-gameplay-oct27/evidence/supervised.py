import sys,pathlib,importlib.util,hashlib,json,time
O=pathlib.Path(__file__).parent
p=pathlib.Path('/tmp/gl-required-version-independent-integrate-oct26/repo/test/helpers/palette-browser-supervisor.py')
assert hashlib.sha256(p.read_bytes()).hexdigest()=='9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85'
s=importlib.util.spec_from_file_location('trusted',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
r=m.supervise([sys.executable,'-S',str(O/'task.py'),*sys.argv[1:]],rss_limit=(256 if sys.argv[1]=='git' else 128)*1048576,cpu_limit=90,wall_limit=120,output_limit=2097152)
r['output']=r['output'].decode('utf8','replace');(O/('supervision-'+str(time.time_ns())+'.json')).write_text(json.dumps(r,default=str,indent=2));print(json.dumps({k:v for k,v in r.items() if k not in ['output','owned']}));sys.exit(1 if r['stopReason'] else r['exit'] or 0)
