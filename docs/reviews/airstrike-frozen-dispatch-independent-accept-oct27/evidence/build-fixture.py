from run import *
p=R/'test/fixtures/airstrike-frozen-dispatch.cjs';source=p.read_text()
# Preserve production extraction and engine byte-for-byte. Mutations affect only
# transport responses, fake renderer/capture, or explicitly injected execution log.
s=source.replace("const source=fs.readFileSync", "const source=fs.readFileSync")
s=s.replace("let chain=Promise.resolve();", "let priorSnapshot=null,priorLog=null;let inputCount=0,captures=0;\nlet chain=Promise.resolve();")
s=s.replace("const cmd=JSON.parse(line);let value;", "const cmd=JSON.parse(line);let value;\n  fs.appendFileSync(process.env.INDEPENDENT_COMMANDS,JSON.stringify(cmd)+'\\n');\n  if(cmd.cmd){inputCount++;if(mode==='terminal-input'){process.exit(7);}}\n  if(cmd.action==='snapshot'&&inputCount&&mode==='terminal-snapshot'){process.exit(7);}\n  if(cmd.action==='png'){captures++;}\n")
s=s.replace("await engine.batch();", "await engine.batch();\n    if(mode==='late-step')await new Promise(r=>setTimeout(r,350));")
s=s.replace("value=await pending;", "value=await pending;\n   if(cmd.action==='step'&&mode==='wrong-step-batch')value.batch--;\n   if(cmd.action==='snapshot'&&inputCount===2&&mode==='prior-snapshot')value=priorSnapshot;\n   if(cmd.action==='snapshot'&&inputCount===1)priorSnapshot=JSON.parse(JSON.stringify(value));\n   if(mode==='focus-change'&&captures>=2&&cmd.action==='snapshot')value.focus=999;\n   if(mode==='image-change'&&captures>=2&&cmd.action==='png')fs.appendFileSync(cmd.path,'changed');\n")
s=s.replace("console.log('[ctl] '+JSON.stringify({id,ok:true,value}));", "const line='[ctl] '+JSON.stringify({id,ok:true,value});\n   console.log(mode==='duplicate-step'&&cmd.action==='step'?line+'\\n'+line:line);")
# For stale log, actually execute the source batch but withhold the current log;
# inject a previous identical action/batch line. It must not authorize completion.
s=s.replace("for(const line of logs)if(mode!=='missing-log')console.log(line);logs.length=0;", "for(const line of logs){if(mode==='prior-log'){if(priorLog===null){priorLog=line;console.log(line);}else console.log(priorLog);}else if(mode!=='missing-log')console.log(line);}logs.length=0;")
# new Function requires injection state as its own closure, not outer module state.
s=s.replace("const scheduledInput=[],logs=[],tickState={batch:12};let stopped=false,signalExitWake;", "const scheduledInput=[],logs=[],tickState={batch:12};let stopped=false,signalExitWake,priorLog=null;")
(R/'test/fixtures/airstrike-independent-accept-oct27.cjs').write_text(s)
print('independent adversarial transport fixture materialized; production extracts unchanged')
