import sys,os,pathlib,importlib.util,json,hashlib,time
O=pathlib.Path(__file__).parent
p=pathlib.Path('/tmp/gl-required-version-independent-integrate-oct26/repo/test/helpers/palette-browser-supervisor.py')
assert hashlib.sha256(p.read_bytes()).hexdigest()=='9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85'
s=importlib.util.spec_from_file_location('trusted',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
label=sys.argv[1];r=m.supervise([sys.executable,'-S',str(O/'driver.py'),*sys.argv[1:]],rss_limit=(256 if label=="git" else 128)*1048576,cpu_limit=90,wall_limit=120,output_limit=2097152)
(O/(label+'-supervision-'+str(time.time_ns())+'.json')).write_text(json.dumps(r,default=str,indent=2));print(json.dumps({k:v for k,v in r.items() if k not in ['owned','output']}))
sys.exit(1 if r['stopReason'] else r['exit'] or 0)
