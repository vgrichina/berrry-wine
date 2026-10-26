#!/usr/bin/env python3
"""Full-entry assertions must reject lost routing, accounting and input guards."""
import importlib.util
import json
import pathlib
import unittest
from unittest import mock
P=pathlib.Path
spec=importlib.util.spec_from_file_location('entry',P(__file__).with_name('test-gl-runner-output-namespace.py'))
t=importlib.util.module_from_spec(spec);spec.loader.exec_module(t)
original=t.RUNNER.read_text();read=P.read_text;results=[]
for label,old,new,method in [
    ('output transient omitted',"transient_roots=[H/'tmp',E]","transient_roots=[H/'tmp']",'test_full_repaired_entry'),
    ('atomic saves misrouted','p=E/n;','p=O/n;','test_full_repaired_entry'),
    ('logs misrouted',"(E/(name+'.log'))","(O/(name+'.log'))",'test_full_repaired_entry'),
    ('result environment misrouted',"PALETTE_GPU_EVIDENCE=str(E/'test-result.json')","PALETTE_GPU_EVIDENCE=str(O/'test-result.json')",'test_full_repaired_entry'),
    ('result collection misrouted',"j=json.loads((E/'test-result.json').read_text()) if (E/'test-result.json').exists() else {}","j=json.loads((O/'test-result.json').read_text()) if (O/'test-result.json').exists() else {}",'test_full_repaired_entry'),
    ('entire ops incorrectly transient',"transient_roots=[H/'tmp',E]","transient_roots=[H/'tmp',O]",'test_required_faults_refuse_next_child')]:
    assert original.count(old)==1,(label,'inexact mutation')
    mutant=original.replace(old,new)
    def reading(p,*a,**kw):return mutant if p==t.RUNNER else read(p,*a,**kw)
    with mock.patch.object(P,'read_text',reading):
        result=unittest.TestResult();t.Entry(method).run(result)
    assert not result.wasSuccessful(),(label,'missing control escaped')
    results.append(dict(omission=label,rejected=True,failures=len(result.failures),errors=len(result.errors)))
print(json.dumps(results,indent=2))
