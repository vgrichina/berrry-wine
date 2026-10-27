
import importlib.util,json,sys
s=importlib.util.spec_from_file_location('production',sys.argv[1])
m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
first,second=json.load(open(sys.argv[2]))
assert m.supervise_new(first)==0
try:
 m.supervise_new(second)
except m.controller.Refusal as ex:
 assert str(ex)=='supervisor-process-already-used-no-replacement'
 print('PASS one original supervisor process cannot launch replacement')
else:
 raise AssertionError('second runtime accepted')
