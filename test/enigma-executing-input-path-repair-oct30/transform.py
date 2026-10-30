import hashlib,pathlib
EXPECTED='61125d6937d2c0836d93146da5a2acceba0f44de1ae1b6e63ecaa7f863244312'
def transform(source, snippet):
 assert hashlib.sha256(source.encode()).hexdigest()==EXPECTED
 marker='  h.log_api_exit = messageBoundaryTrace.wrapPostHandler(h.log_api_exit);'
 assert source.count(marker)==1
 source=source.replace(marker,marker+'\n'+snippet)
 marker="    if (cmd.action === 'input-stall') return stallObserver.sample();"
 assert source.count(marker)==1
 source=source.replace(marker,marker+"\n    if (cmd.action === 'executing-path') return {...executingTrace, state: invocationState()};")
 marker='        const sliceStats = threadManager.runSlice(BATCH_SIZE);'
 assert source.count(marker)==1
 source=source.replace(marker,'        executingTrace.workerEntered++;\n'+marker+'\n        executingTrace.workerReturned++;')
 return source
