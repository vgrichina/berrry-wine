import pathlib,os,subprocess,json,re,hashlib
R=pathlib.Path('/home/user/shadow-man-dsetup-canonical-qualification-oct22');E=R/'evidence-region-fullmodule';os.chdir(R)
env=dict(os.environ,GIT_NO_LAZY_FETCH='1')
for k in ['NODE_OPTIONS','NODE_PATH','WINE_REGION_MAP','WINE_REGION_SHAKE','WINE_WAT_NAMES','WINE_WAT_COMPILER']:env.pop(k,None)
old=(E/'cheap-gates.sh').read_text();script=old.replace("printf 'COMMAND node'; printf ' %q' \"$@\"; printf '\\n'", "{ printf 'COMMAND node'; printf ' %q' \"$@\"; printf '\\n'; } >&3").replace("printf 'COMMAND bash'; printf ' %q' \"$@\"; printf '\\n'", "{ printf 'COMMAND bash'; printf ' %q' \"$@\"; printf '\\n'; } >&3").replace("printf 'GATE_EXIT %s\\n' \"$code\"", "printf 'GATE_EXIT %s\\n' \"$code\" >&3")
# FD3 retains commands/results even for build.sh's normally redirected checks.
script=script.replace('set +e', 'set +e\nexec 3> '+str(E/'cheap-gate-exits.log'),1)
(E/'cheap-gates-complete.sh').write_text(script)
with (E/'cheap-gates-complete.log').open('wb') as f:subprocess.run(['bash',str(E/'cheap-gates-complete.sh')],stdout=f,stderr=subprocess.STDOUT,env=env,timeout=240,check=True)
text=(E/'cheap-gate-exits.log').read_text();results=[dict(command=x,exit=int(y)) for x,y in re.findall(r'COMMAND ([^\n]+)\nGATE_EXIT (\d+)',text)]
assert len(results)>45,len(results)
summary=dict(results=results,failures=[r for r in results if r['exit']],count=len(results),canonicalAttempts=0,inventoryPasses=2,receiptCorrection='Initial receipt wrapper stdout was lost for redirected commands; complete receipt uses FD3. First inventory retained; no canonical build attempted.',sourceBuildSHA256=hashlib.sha256((R/'tools/build.sh').read_bytes()).hexdigest())
(E/'cheap-gates.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps(summary,indent=2))
