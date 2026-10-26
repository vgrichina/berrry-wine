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
 ('required file inventory omitted',mock.patch.object(t.sup.AllocatedDisk,'_charge',lambda self,s,depth,p:setattr(self,'total',self.total+s.st_blocks*512)),'test_required_file_versions_at_actual_callbacks')]:
 with patch:
  result=unittest.TestResult();t.Accounting(method).run(result)
 assert not result.wasSuccessful(),(label,'missing control escaped')
 results.append(dict(omission=label,rejected=True,failures=len(result.failures),errors=len(result.errors)))
print(json.dumps(dict(negativeOmissions=results),indent=2))
# These challenges exercise the new inventory at the actual production callback.
for label,patch,method in [
 ('file version inventory omitted',mock.patch.object(t.sup.AllocatedDisk,'_version',classmethod(lambda cls,s:cls._identity(s))),'test_required_file_versions_at_actual_callbacks'),
 ('partial retry baseline omitted',mock.patch.object(t.sup.AllocatedDisk,'_charge',lambda self,s,depth,p:(self.required_seen.clear(),charge(self,s,depth,p))[-1]),'test_partial_retry_preserves_first_observed_file_version')]:
 charge=t.sup.AllocatedDisk._charge
 with patch:
  result=unittest.TestResult();t.Accounting(method).run(result)
 assert not result.wasSuccessful(),(label,'missing control escaped')
 results.append(dict(omission=label,rejected=True,failures=len(result.failures),errors=len(result.errors)))
# Disable only the real namespace comparison; retain all other source/wiring.
helper=t.ROOT/'test/helpers/palette-browser-supervisor.py'
source=helper.read_text()
old='if self.required_names.get(p, mandatory) != mandatory:'
assert source.count(old)==1
namespace={'__name__':'namespace_mutant'}
exec(compile(source.replace(old,'if False:'),str(helper),'exec'),namespace)
with mock.patch.object(t.sup,'AllocatedDisk',namespace['AllocatedDisk']):
 result=unittest.TestResult();t.Accounting('test_mandatory_directory_namespace_and_transient_churn').run(result)
assert result.failures and not result.errors,'missing namespace check escaped or invalid mutant'
results.append(dict(omission='mandatory namespace comparison omitted',rejected=True,failures=len(result.failures),errors=len(result.errors)))
print(json.dumps(dict(allNegativeOmissions=results),indent=2))
