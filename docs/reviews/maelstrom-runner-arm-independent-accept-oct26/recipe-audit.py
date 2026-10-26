from common import *
T=pathlib.Path('/tmp/maelstrom-mode-transition-observer-repair-oct26')
b=(D.parent/'ops/corrected-final-run.js').read_bytes();s=b.decode();lines=b.splitlines(keepends=True)
def ex(p,first,last):
 z=b''.join(p.read_bytes().splitlines(keepends=True)[first-1:last]);return dict(path=str(p),firstLine=first,lastLine=last,bytes=len(z),sha256=sha(z),text=z.decode())
candidateInputs=[]
for p in ['tools/maelstrom-native-errno-latch.cjs','tools/maelstrom-original-errno-adapter.cjs','tools/maelstrom-select-completion-hook.cjs','test/runner-experiments.js','test/runner-experiment-report.js','test/test-maelstrom-mode-transition.cjs']:
 raw=(T/'repo'/p).read_bytes();entry=git('ls-tree',REV,'--',p,cwd=D).decode().strip();blob=entry.split()[2] if entry else None
 actual=git('hash-object','--stdin',input=raw).decode().strip()
 if blob:assert actual==blob
 candidateInputs.append(dict(path=p,candidateBlob=blob,standingBlob=actual,sha256=sha(raw),bytes=len(raw),executedStandingPath=str(T/'repo'/p),dependencyQualification='candidate-tree byte equality' if blob else 'separate pinned mode-transition fixture branch; not materialized in candidate tree'))
prior=s[:s.index('    const dllResults = loadDlls(')]
tokens=['mne_start','msc_start','nativeAdapter','originalNativeObserve','nativeDiagnostic','mne_','msc_']
assert all(token not in prior for token in tokens)
audit=dict(candidate=REV,candidateRunnerSHA256=sha(b),candidateInputs=candidateInputs,
 runnerLoaderCallLine=5704,firstNativeDiagnosticImportLine=5736,validationLine=5758,applyMainLine=6588,soleArmLine=7502,batchLoopLine=7504,
 runSites=[i+1 for i,l in enumerate(lines) if b'instance.exports.run(BATCH_SIZE)' in l],
 noEarlierEquivalentObserver=dict(prefixBytes=len(prior.encode()),prefixSHA256=sha(prior.encode()),absentTokens=tokens,
 explanation='No mne/msc observer calls occur in the exact pre-load runner. The unchanged helper initializes native status to0 (inert); adapter.start invokes mne_start only at7502. DLL callback ownership gate in archived loader is synchronization, not the native/select observer.'),
 excerpts=[ex(D.parent/'ops/corrected-final-run.js',5736,5768),ex(T/'repo/tools/maelstrom-native-errno-latch.cjs',154,169),ex(T/'repo/tools/maelstrom-original-errno-adapter.cjs',110,122)],
 localVerdict='ACCEPT post-loader transform independently; REJECT original global before-ANY-guest contract',
 noRuntimeQualification=True)
save('source-audit.json',audit)
print('SOURCE AUDIT PASS')
