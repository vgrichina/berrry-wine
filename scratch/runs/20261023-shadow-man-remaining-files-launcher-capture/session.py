"""Single 90s watched launch with concurrent bounded live capture."""
import io,json,pathlib
from transport import *
assert not (E/'session-api.json').exists()
g=json.loads((E/'preguest.py-result.json').read_text());assert g['passAll'] and g['canonicalInputConsumed']
s=(E/'live_operator.py').read_bytes();save('live-operator-upload.json',upload_stream(io.BytesIO(s),len(s),ROOT+'/fixed/live_operator.py'))
code='import threading,runpy\nt=threading.Thread(target=lambda:runpy.run_path('+repr(ROOT+'/fixed/live_operator.py')+',run_name="__main__"),daemon=True)\nt.start()\nrunpy.run_path('+repr(ROOT+'/fixed/launch_once.py')+',run_name="__main__")\nt.join(timeout=1)'
run(code,'session-api.json',110)
