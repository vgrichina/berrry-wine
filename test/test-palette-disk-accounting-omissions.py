#!/usr/bin/env python3
"""Negative controls: the actual boundary assertions must reject missing hooks."""
import importlib.util
import json
import pathlib
import unittest
from unittest import mock
P=pathlib.Path
spec=importlib.util.spec_from_file_location('controls',P(__file__).with_name('test-palette-disk-accounting.py'))
t=importlib.util.module_from_spec(spec);spec.loader.exec_module(t)
original=t.WRAPPER.read_text();read=P.read_text
cases=[
 ('accounting callback omitted','used=alloc(H);','used=0;','test_production_discovery_races'),
 ('transient root omitted',"transient_roots=[H/'tmp']",'transient_roots=[]','test_production_discovery_races'),
 ('disk cap omitted','if used+future>1024*M:', 'if False:','test_production_cap_and_headroom'),
 ('headroom omitted','if free<2982150144:', 'if False:','test_production_cap_and_headroom')]
results=[]
for label,old,new,method in cases:
 assert original.count(old)==1,(label,'mutation not exact')
 mutant=original.replace(old,new)
 def reading(p,*a,**kw):return mutant if p==t.WRAPPER else read(p,*a,**kw)
 with mock.patch.object(P,'read_text',reading):
  result=unittest.TestResult();t.Accounting(method).run(result)
 assert result.testsRun==1 and not result.wasSuccessful(),(label,'missing control escaped')
 results.append(dict(omission=label,rejected=True,failures=len(result.failures),errors=len(result.errors)))
# Pinning and the required inventory are tested at their own production boundary.
for label,patch,method in [
 ('root validation omitted',mock.patch.object(t.sup.AllocatedDisk,'_validate_roots',lambda self:None),'test_root_replacement_and_symlink_ancestors'),
 ('required inventory omitted',mock.patch.object(t.sup.AllocatedDisk,'_charge',lambda self,s,depth,p:setattr(self,'total',self.total+s.st_blocks*512)),'test_required_deletion_between_samples_is_unknown')]:
 with patch:
  result=unittest.TestResult();t.Accounting(method).run(result)
 assert not result.wasSuccessful(),(label,'missing control escaped')
 results.append(dict(omission=label,rejected=True,failures=len(result.failures),errors=len(result.errors)))
print(json.dumps(dict(negativeOmissions=results),indent=2))
