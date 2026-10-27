from run import *
import re
D=H/'remote-evidence';p=R/'tools/callback-ownership-census.json';census=json.loads(p.read_text());changed=[]
for name in ['host.js','lib/renderer-input.js']:
 row=next(x for x in census['entries'] if x['file']==name and x['name']=='host-file');actual=hashlib.sha256((R/name).read_bytes()).hexdigest()
 assert actual!=row['sha256'];changed.append(dict(file=name,producer=name+':host-file',expectedSHA256=row['sha256'],actualSHA256=actual))
blocks=[]
for name in ['lib/apps.js']:
 a=(ROOT/name).read_bytes();b=(R/name).read_bytes()
 for pattern in [rb'    const gta2DemoRoot =[\s\S]*?    const gta2Mss32 =[^\n]*',rb'^      gta2_demo: \{[\s\S]*?^      \},']:
  aa=re.search(pattern,a,re.M).group();bb=re.search(pattern,b,re.M).group();assert aa==bb
  blocks.append(dict(bytes=len(aa),sha256=hashlib.sha256(aa).hexdigest(),rootAndSelectedIdentical=True))
build=json.loads((D/'compile-receipt.json').read_text());assert build['exit']==1 and build['cleanupComplete'] and not build['stopReason']
assert (D/'compile.stderr').read_text().splitlines()==['changed producer host.js:host-file (sha256); review its lifetime','changed producer lib/renderer-input.js:host-file (sha256); review its lifetime']
close=json.loads((D/'remote-closeout.json').read_text());assert close['guestInvocations']==0 and not close['modules'] and not close['compileOwnedLive']
pins=[]
for name in ['tools/build.sh','tools/callback-ownership-census.js','tools/callback-ownership-census.json','host.js','lib/renderer-input.js']:
 pp=R/name;pins.append(dict(path=name,bytes=pp.stat().st_size,sha256=hashlib.sha256(pp.read_bytes()).hexdigest()))
q=dict(status='BLOCKED_PRODUCTION_CALLBACK_CENSUS_BEFORE_COMPILER_NO_GUEST',selectedProductionRevision='4a2bec145ef34b0d084b96b09a682a16e89703fd',registeredRoute='gta2_demo',rootAuthoritativeRouteBlocks=blocks,firstBlocker=dict(command=['/bin/bash','tools/build.sh'],gate=['node','tools/callback-ownership-census.js'],reason='Two changed whole-file host-entry producer fingerprints require lifetime review; census deliberately unchanged.',changed=changed,pins=pins),completed=['all71 original game SHA256 pins','3878-file98062584-byte remote immutable closure','exact build Node startup with no DATA/AS restriction','four full PNG envelope reservation8179810 of8388608 bytes including1MiB terminal reserve','one canonical build invocation with distinct stdout/stderr and complete cleanup'],notReached=['memory-map gate and later build gates','WATX compile/module','actual filename-bearing canonical mount parser and guest Node startup','guest execution/initial frame/menu/world','ordinary movement/driving dispatch','before/after acceptance PNGs and human review','held inputs or ordinary Quit'],guestInvocations=0,inputDispatches=0,inspectedPNGs=[],fpsClaim=False,audioClaim=False,deviceClaim=False,compile=build,remoteCloseout=close,resumeCondition='Coordinator-assigned source repair/independent review of the exact two producer changes and census, then a separately admitted runtime task. This worker does not perform that repair or select a new task.')
dump('task-result.json',q);print(json.dumps(dict(status=q['status'],changed=changed,guestInvocations=0,sourcePins='PASS',rootRegisteredRoute='IDENTICAL')))
