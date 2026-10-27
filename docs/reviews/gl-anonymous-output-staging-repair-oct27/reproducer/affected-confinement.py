import importlib.util,pathlib
p=pathlib.Path(__file__).resolve().parent.parent/'repo/test/test-gl-output-file-confinement.py'
s=importlib.util.spec_from_file_location('confinement',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
for name in ['omission','collector_omission','primary']:
 print('GROUP',name);getattr(m,name)()
