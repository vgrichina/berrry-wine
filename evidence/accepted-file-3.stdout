#!/usr/bin/env python3
"""Independent static lexical challenges. Never runs Tcl or subprocesses.

Each case materializes small owned fixtures and calls the exact published module.
A resource supervisor separately invokes its real literal-sources CLI and compares
the JSON or rejection against the API receipt. --case all is API-only convenience.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import types

PIN = '17536ba93021a4d7061b542876eaecef6f1f716fa3e420ef283b2804c50b6c04'
CASES = []
def case(name, text, checked=(), syntax=False, reject=False, targets=('child.tcl',)):
    CASES.append(dict(name=name,text=text,checked=list(checked),syntax=syntax,reject=reject,targets=list(targets)))

for name,word in [('namespace','[pkg::where]'),('arguments','[probe a_b 3.2 ../* -quiet ?]'),('tabs','[probe\targ\t]'),('adjacent','prefix[pwd]suffix'),('multiple','[pwd][pwd]'),('quoted','"prefix[pwd] suffix"')]:
    case(name,'set value '+word+'; source child.tcl\n',['child.tcl'])
for name,word in [('nested','[probe [pwd]]'),('variable','[probe $value]'),('array','[probe $a(x)]'),('quoted-inner','[probe "x"]'),('brace-inner','[probe {x}]'),('escaped-inner',r'[probe x\ y]'),('escaped-close',r'[probe x\]]'),('semicolon','[probe; pwd]'),('newline','[probe\npwd]'),('comment','[probe # comment\n]'),('incomplete','[probe'),('extra-open','[[probe]'),('empty','[]'),('continuation','[probe\\\n arg]')]:
    case(name,'set value '+word+'\nsource child.tcl\n',syntax=True)
for name,word in [('computed','[pwd]'),('computed-suffix','[pwd]/child.tcl'),('computed-quoted','"[pwd]/child.tcl"'),('computed-concat','child[pwd].tcl'),('escaped-bracket',r'\[pwd\]'),('variable-quoted','"$where/child.tcl"')]:
    case(name,'source '+word+'; source child.tcl\n',['child.tcl'])
case('quoted-body','set value "[pwd]; source missing.tcl"\nsource child.tcl\n',['child.tcl'])
case('braced-body','set value {[pwd]; source missing.tcl}\nsource child.tcl\n',['child.tcl'])
case('escaped-boundary',r'set value [pwd]\;source missing.tcl'+'\nsource child.tcl\n',['child.tcl'])
case('continued-comment','# [pwd] \\\nsource missing.tcl\nsource child.tcl\n',['child.tcl'])
case('trailing-comment','set value [pwd]; # source missing.tcl\nsource child.tcl\n',['child.tcl'])
case('quoted-malformed','set value "[pwd]\nsource missing.tcl\n',syntax=True)
case('group-following-text','set value "[pwd]"suffix\nsource child.tcl\n',syntax=True)
case('literal-controls','set x [pwd]; source {child.tcl}; source "semi;colon.tcl"\n',['child.tcl','semi;colon.tcl'],targets=('child.tcl','semi;colon.tcl'))
case('normalized-path','set x [pwd]\nsource ./sub/../child.tcl\n',['./sub/../child.tcl'])
for name,path in [('escaping','../../outside.tcl'),('absolute','/outside.tcl'),('drive','C:/outside.tcl')]:
    case(name,'set x [pwd]\nsource '+path+'\nsource child.tcl\n',['child.tcl'])
case('missing-path','set x [pwd]\nsource missing.tcl\n',reject=True)
case('data-command','set x [exec touch SENTINEL]\nsource child.tcl\n',['child.tcl'])
case('control-body','if {[pwd]} {source missing.tcl}; source child.tcl\n',['child.tcl'])

def load(source):
    assert hashlib.sha256(source.read_bytes()).hexdigest()==PIN
    spec=importlib.util.spec_from_file_location('published_production',source)
    m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
    return m

def execute(source, task, c):
    m=load(source)
    root=task/'fixtures'/c['name']; root.mkdir(parents=True,exist_ok=True)
    (root/'main.tcl').write_text(c['text'])
    for target in c['targets']: (root/target).write_text('# inert owned fixture\n')
    inventory={'files':[{'path':x} for x in ['main.tcl']+c['targets']]}
    (root/'inventory.json').write_text(json.dumps(inventory))
    sentinel=root/'SENTINEL'
    assert not sentinel.exists()
    actual=None; error=None
    try: actual=m.literal_sources(root,inventory)
    except m.Rejected as e: error=str(e)
    receipt=dict(case=c,sourceSHA256=PIN,api=actual,rejection=error,sentinelAbsent=not sentinel.exists())
    (root/'api.json').write_text(json.dumps(receipt,indent=2)+'\n')
    assert bool(error)==c['reject'],receipt
    if actual is not None:
        assert [x['literal'] for x in actual['checked']]==c['checked'],receipt
        assert any('unsupported or incomplete' in x.get('reason','') for x in actual['unknown'])==c['syntax'],receipt
        if c['name']!='continued-comment':
            assert actual['unknown'],receipt
    assert not sentinel.exists(),receipt
    if c['name']=='namespace':
        text=source.read_text(); marker='if bracket is None:'
        assert text.count(marker)==1
        mutant=types.ModuleType('rejecting_mutation')
        exec(compile(text.replace(marker,'if True:  # rejecting mutation'),str(source),'exec'),mutant.__dict__)
        assert not mutant.literal_sources(root,inventory)['checked']
        receipt['rejectingMutationKilled']=True
        (root/'api.json').write_text(json.dumps(receipt,indent=2)+'\n')
    return receipt

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source',type=Path,required=True)
    p.add_argument('--task-dir',type=Path,required=True)
    p.add_argument('--case',required=True)
    a=p.parse_args()
    selected=CASES if a.case=='all' else [c for c in CASES if c['name']==a.case]
    assert selected
    for c in selected:
        execute(a.source,a.task_dir,c)
        print(json.dumps({'case':c['name'],'API':'PASS'}))
