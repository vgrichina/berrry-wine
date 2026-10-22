from pathlib import Path
import json,subprocess,shutil
S=Path('/home/user/aoe3-canonical-c7fae5ac-staged');R=Path('/home/user/aoe3-original-oct22');P=Path('/home/user/aoe3-canonical-c7fae5ac-evidence')
print('FREE',shutil.disk_usage(S).free)
print('LAUNCH', (P/'guest/launch.json').read_text())
print('RUNNER', (P/'guest/original-run-relocated.js').read_text())
print('RUNTIME', '\n'.join(str(p) for p in (R/'runtime').rglob('*') if p.is_file()))
print('APIHEAD', (S/'api_table.json').read_text()[:1500])
print('ORDINAL_FILES',subprocess.check_output(['rg','-n','VariantInit|VariantClear|SysAllocString|ordinal.*OLEAUT|oleaut32','lib','src/09b-ordinal.wat'],cwd=S,stderr=subprocess.STDOUT).decode()[:8000])
