import hashlib
EXPECTED='a5713707a14d09ff8aab73d43c1985b30e0b33d7d3882855b09719e16d859643'
ORIGINAL='61125d6937d2c0836d93146da5a2acceba0f44de1ae1b6e63ecaa7f863244312'
INSTALL="""  const firstPostInput = require('./first-post-input.js').create({
    memory, isApi: name => apiByName.has(name),
    clock: () => ({batch: tickState.batch, polls: guestPollTrace.entries}),
    inputState: () => ({event: lastInputEvent && {...lastInputEvent}, ...guestPollState()}),
  });
  firstPostInput.bind(h, () => instance.exports, 'main');
  firstPostInput.bindInput(h, () => instance.exports);
"""
def transform(source, old_snippet):
 assert hashlib.sha256(source.encode()).hexdigest()==EXPECTED
 assert source.count(old_snippet)==1
 source=source.replace('\n'+old_snippet,'')
 # This reconstructs and verifies the exact original observer before patching.
 source=source.replace("\n    if (cmd.action === 'executing-path') return {...executingTrace, state: invocationState()};",'')
 source=source.replace('        executingTrace.workerEntered++;\n','').replace('\n        executingTrace.workerReturned++;','')
 assert hashlib.sha256(source.encode()).hexdigest()==ORIGINAL
 marker='  const imports = { host: h };'
 assert source.count(marker)==1
 assert source.rfind('h.check_input =',0,source.index(marker))>source.index('  // --- Override input for test injection ---')
 source=source.replace(marker,INSTALL+marker)
 marker='    const workerImports = { host: wh };'
 assert source.count(marker)==1
 source=source.replace(marker,"    firstPostInput.bind(wh, () => workerInstance && workerInstance.exports, 'worker:' + tid);\n"+marker)
 marker="    if (cmd.action === 'input-stall') return stallObserver.sample();"
 assert source.count(marker)==1
 return source.replace(marker,marker+"\n    if (cmd.action === 'executing-path') return firstPostInput.snapshot();")
