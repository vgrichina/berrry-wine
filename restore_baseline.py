"""Restore immutable initial accounting receipt after evidence consolidation."""
import pathlib,resource,tarfile
resource.setrlimit(resource.RLIMIT_DATA,(128*1024**2,resource.getrlimit(resource.RLIMIT_DATA)[1]))
own=pathlib.Path(__file__).resolve().parent
base=own/'test/toyvm-offline-nonfinite-json-repair-oct29'
with tarfile.open(base/'operation-evidence.tar.gz','r:gz') as tar:
    data=tar.extractfile('evidence/initial-baseline.json').read(1048576)
(base/'evidence/initial-baseline.json').write_bytes(data)
