import json,subprocess
from pathlib import Path
R=Path('/home/user/shadow-man-dsetup-canonical-qualification-oct22')
tests=['test-file-version-info.js','test-ne-file-version.js','test-static-dx-version.js','test-directx-setup.js','test-directx-ordinals.js','test-dsetup-loading.js']
for p in sorted((R/'test').glob('*.js')):
    if any(x in p.name for x in ['dll-lifecycle','pe-import','dll-import','dll-load','pe-load']):tests.append(p.name)
for f in ['tools/build.sh','test/compile-src.js','package.json']+['test/'+s for s in tests]:
    p=R/f
    print('\nFILE '+f+'\n'+p.read_text())
print('TEST_FILES '+json.dumps(tests))
print('MODULES '+json.dumps([str(p) for p in R.rglob('*.wasm')]))
