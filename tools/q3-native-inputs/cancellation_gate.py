def require_separate_waits(waits):
 for v in waits.values():assert v['actualWait'] and v.get('stdoutEOF') and v.get('stderrEOF'), 'combined EOF does not satisfy cancellation prerequisite'
