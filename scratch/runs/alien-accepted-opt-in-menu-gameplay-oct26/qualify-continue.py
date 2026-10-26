from work import *
transfer([('supervisor.py',O/'supervisor.py')])
for name in ['config']:
 j=remote('python3 '+shlex.quote(R+'/supervisor.py')+' '+name,timeout=30);save(name+'-api.json',j)
 j=py('import pathlib,json;h=pathlib.Path('+repr(R+'/'+name)+');print(json.dumps(dict(terminal=json.loads((h/"terminal.json").read_text()),output=(h/"output.log").read_text()[:6000])))');save(name+'-qualification.json',j);v=json.loads(j['stdout']);assert v['terminal']['returncode']==0 and not v['terminal']['remainingOwnedLive'],v
 if name=='config':assert 'CONFIG_ONLY_REACHED_NO_BUILD_MODULE_READ' in v['output']
 print(name+' PASS',flush=True)
save('checkpoint.json',dict(phase='pre-guest CLI qualification',closureVerified602=True,parserVerified=True,startupExactConfiguration=True,unchangedFullCLIStoppedAtNoBuildModuleRead=True,guestInvocations=0,reusedAcceptedIntegration='4e28cb946e67ffc8112043d27c8c23840e076007',next='fresh admission then ONE production guest'))
