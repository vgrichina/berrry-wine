"""Recover only pinned runner/recipe in RAM; persist compact exact slices, never assets."""
import pathlib, tarfile, hashlib, json, importlib.util
P=pathlib.Path(__file__).resolve().parent
A=pathlib.Path('/tmp/enigma-original-menu-render-runtime-oct30')
def sha(b): return hashlib.sha256(b).hexdigest()
with tarfile.open(A/'closed-transfer-causal-source.tar.xz') as t:
    base=t.extractfile('causal-source/runner__test__run.js').read()
assert sha(base)=='55be42cbcaedee9d7f56f578cd7d36841bba86861b38bf5d61a7a0415a880c2e'
with tarfile.open(A/'closed-original-test-staging.tar.xz') as t:
    recipe=t.extractfile('repo/test/enigma-guest-poll-causal-runtime-oct30/guest-poll-instrument.py').read()
ns={'__name__':'pinned_recipe'};exec(compile(recipe,'pinned_recipe','exec'),ns)
retained=ns['instrument'](base.decode())
assert sha(retained.encode())=='96aa1313dabaf59a55875830b35fdd32ec3410fea2e3b2458828a9f49ccbe4b2'
spec=importlib.util.spec_from_file_location('transform',P/'transform.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
transformed=m.transform(retained)
# Fail closed on a byte change, even if all insertion markers still exist.
try:m.transform(retained+' ')
except AssertionError:pass
else:raise AssertionError('identity mutant survived')
def exact(text):
    assert retained.count(text)==1, text
    return text
poll=retained[retained.index("  const guestPollTrace ="):retained.index('  // Default hwnd routing: keyboard messages')]
command=exact("  const handleControlCommand = (cmdIn) => {\n    const cmd = typeof cmdIn === 'string' ? { cmd: cmdIn } : (cmdIn || {});")
declarations=[exact(x) for x in [
    '  const instance = await WebAssembly.instantiate(wasmModule, imports);',
    '  const tickState = batchClock.state;', '  let threadManager = null;']]
run=exact('      if (!mainExecutionSuspended()) instance.exports.run(BATCH_SIZE);')
# The fixture executes original declarations, poll wrapper and transformed
# producer/consumer in their original shared lexical scope, with test-only imports.
fixture='\n'.join(declarations)+'\n'+poll+'\n'+m.INSTALL+'\n'+command+'\n'+m.COMMAND+"    throw new Error('test action');\n  };\n"+"const dispatch = () => {"+run.replace(m.RUN,m.REPLACEMENT)+"};\n"
(P/'exact-boundary.js.inc').write_text(fixture)
receipt=dict(source='425755ee5ee9be0734c7aca187521100f5487674',archivedBase=sha(base),recipeSHA=sha(recipe),retained=sha(retained.encode()),transformed=sha(transformed.encode()),fixtureSHA=sha(fixture.encode()),runSites=3,runtime=False)
(P/'identity.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps(receipt))
