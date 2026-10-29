import sys,json,hashlib,importlib.util
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from control import B,R,run,save
SOURCE=R/'tools/recovery/tuxracer-original-win32-recovery-oct28.py'
PIN='69257615178adda7568036fc49e2f20b4ca602c6d3b734f1238caf6143021b17'
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest()==PIN
H=R/'test/tuxracer-parent-relative-independent-oct28.py'
donor=Path('/tmp/tuxracer-cwd-contained-lexical-repair-oct29/repo')
assert H.read_bytes()==(donor/'test'/H.name).read_bytes()
historical='5a47f748777d5b3a322e1c28b6acb78e13e6772f3cdb7d3b3d811c7e145b328e'
assert H.read_text().count(historical)==1
# Preserve the original file; adapt its source-pin assertion in memory only.
save('harness-adaptation',dict(originalSHA256=hashlib.sha256(H.read_bytes()).hexdigest(),historicalSourceHash=historical,newSourceHash=PIN,change='single source-hash string replacement in memory; fixtures/assertions unchanged'))
oldargv=sys.argv;sys.argv=[str(H),str(B/'earliest-fixtures')]
exec(compile(H.read_text().replace(historical,PIN),str(H),'exec'),{'__file__':str(H),'__name__':'independent_historical'})
sys.argv=oldargv
reproducer=B/'earliest-fixtures/inert-braced-data/courses/common/moon.tcl'
assert reproducer.read_bytes()==b'set description {\nsource ../common/absent.tcl\n}\n'
save('earliest-boundary',dict(outcome='PASS',reproducerSHA256=hashlib.sha256(reproducer.read_bytes()).hexdigest(),unchanged=True))
spec=importlib.util.spec_from_file_location('production',SOURCE);r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r)
results=[]
cases=[
 ('braced-nested','set d {outer {\nsource missing.tcl\n} tail}\n',[],False,[]),
 ('quoted-multiline','set d "line;\nsource missing.tcl\n"\n',[],False,[]),
 ('escaped-quote','set d "a\\\"; source missing.tcl\nend"\n',[],False,[]),
 ('escaped-brace','set d {a\\} ;\nsource missing.tcl\n}\n',[],False,[]),
 ('comment-semicolon','# inert ; source missing.tcl\nsource ok.inc\n',['ok.inc'],False,['ok.inc']),
 ('comment-after-semicolon','set x 1; # source missing.tcl\nsource ok.inc\n',['ok.inc'],False,['ok.inc']),
 ('continued-comment','# continued\\\nsource missing.tcl\nsource ok.inc\n',['ok.inc'],False,['ok.inc']),
 ('braced-follow-newline','set d {\nsource missing.tcl\n}\nsource absent.inc\n',[],True,[]),
 ('quoted-follow-semicolon','set d "\nsource missing.tcl\n";source absent.inc\n',[],True,[]),
 ('braced-follow-semicolon','set d {source missing.tcl};source ../common/ok.inc\n',['courses/common/ok.inc'],False,['../common/ok.inc']),
 ('quoted-follow-newline','set d "source missing.tcl"\nsource ok.inc\n',['ok.inc'],False,['ok.inc']),
 ('root-candidate','source ../../ok.inc\n',['ok.inc'],False,['../../ok.inc']),
 ('confined-parent','source ../common/./ok.inc\n',['courses/common/ok.inc'],False,['../common/./ok.inc']),
 ('escape-all','source ../../../outside.inc\n',[],False,[]),
 ('computed-dollar','source $name\n',[],False,[]),
 ('computed-bracket','source [file join . missing.tcl]\nsource absent.inc\n',[],False,[]),
 ('control-body','if {1} {\nsource absent.inc\n}\n',[],False,[]),
 ('ambiguous-suffix','source {ok.inc}suffix\nsource absent.inc\n',[],False,[]),
 ('unfinished-quote','set d "\nsource absent.inc\n',[],False,[]),
 ('unfinished-brace','set d {\nsource absent.inc\n',[],False,[]),
 ('escaped-command-separator','set d a\\;source absent.inc\n',[],False,[]),
 ('escaped-newline','source \\\n absent.inc\n',[],False,[]),
 ('absolute','source /absent.inc\n',[],False,[]),
 ('encoding-missing','source -encoding utf-8 absent.inc\n',[],True,[]),
 ('literal-hash-arg','source #leaf.inc\n',['#leaf.inc'],False,['#leaf.inc']),
 ('semicolon-in-literal','source {semi;colon.inc}\n',['semi;colon.inc'],False,['semi;colon.inc']),
 ('source-in-braced-comment','set d {# text\nsource absent.inc\n}\n',[],False,[]),
]
for label,text,files,rejected,literals in cases:
 root=B/'challenges'/label;script=root/'courses/common/moon.tcl';script.parent.mkdir(parents=True)
 script.write_text(text)
 inventory={'files':[{'path':'courses/common/moon.tcl'}]+[{'path':x} for x in files]}
 for name in files:
  p=root/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text('leaf\n')
 inv=root/'inventory.json';inv.write_text(json.dumps(inventory))
 try: result=r.literal_sources(root,inventory)
 except r.Rejected as e:
  assert rejected,(label,str(e));result={'rejected':str(e)}
 else:
  assert not rejected,(label,result)
  assert [x['literal'] for x in result['checked']]==literals,(label,result)
  if not literals:assert result['unknown'],(label,result)
  for x in result['checked']:
   assert all(not p.startswith('/') and '..' not in Path(p).parts for p in x['candidatesPresent'])
 cli=run('cli-'+label,['/usr/bin/python3',str(SOURCE),'literal-sources',str(root),str(inv)],cwd=R,expected=1 if rejected else 0)
 if not rejected:assert json.loads(cli)==result,(label,cli,result)
 results.append(dict(case=label,API='PASS',CLI='PASS',result=result));save('independent-results',results)
# A rejecting mutation drops a real missing command after inert data; the oracle
# must kill it, using the exact production source with only this local mutation.
needle="for words, uncertain in lexical_commands(text):"
assert SOURCE.read_text().count(needle)==1
mutated=SOURCE.read_text().replace(needle,"for words, uncertain in list(lexical_commands(text))[:1]:")
ns=dict(r.__dict__);exec(compile(mutated,str(SOURCE)+':drop-following-command','exec'),ns)
root=B/'challenges/braced-follow-newline';inv=json.loads((root/'inventory.json').read_text())
try:
 ns['literal_sources'](root,inv)
 raise AssertionError('oracle: real absent.inc was silently skipped')
except ns['Rejected']:
 raise AssertionError('mutation unexpectedly preserved rejection')
except AssertionError as e:
 save('rejecting-mutation',dict(outcome='KILLED',diagnosis=str(e),mutation='drop commands after first inert command'))
print('PASS earliest unchanged boundary; 27 independent API/CLI challenges; mutation killed')
