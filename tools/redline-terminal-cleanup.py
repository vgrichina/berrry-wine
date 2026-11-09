"""Compose the actual 1235/1295 no-input wrappers; no browser/process actions added.

python3 tools/redline-terminal-cleanup.py cleanup|retrieval WRAPPER [fixture|original]
WRAPPER is the retained terminal-cleanup.py or recover.py (including the 1295
forwarders). The original wrapper directory selects control.py. Changed source shapes
are refused before execution. Existing control.py still owns remote execution,
identity checks, inventory, transport and SHA-size verification.
"""
import gzip
import re
import sys
import zlib
from pathlib import Path


def diagnostic(path):
    """Keep raw bytes authoritative; decoding failure is only diagnostic failure."""
    try:
        data = path.read_bytes()
    except FileNotFoundError:
        return b'', dict(path=str(path), gzipCRC='INVALID', EOF=False,
                         error='absent log', exists=False)
    status = dict(path=str(path), size=len(data), gzipCRC='INVALID', EOF=False)
    try:
        if not data:
            raise EOFError('empty gzip: no member')
        decoded = gzip.decompress(data)
    except (EOFError, gzip.BadGzipFile, zlib.error) as error:
        status['error'] = str(error)
        status['preserved'] = True
        return b'', status
    status.update(gzipCRC='PASS', EOF=True)
    return decoded, status


def replace_once(source, old, new):
    if source.count(old) != 1:
        raise ValueError('unsupported Redline wrapper shape: ' + old[:80])
    return source.replace(old, new)


def wrapper_source(wrapper):
    source = wrapper.read_text()
    # Resolve only the exact retained two-line forwarding shape. Do not execute
    # the forwarder first: it would run the unpatched consumer. Keep control.py
    # bound to the selected run, not to the older source provider's directory.
    match = re.fullmatch(r"from pathlib import Path\nexec\(compile\(\(Path\(__file__\)\.resolve\(\)\.parent\.parent/'([A-Za-z0-9_-]+/(?:terminal-cleanup|recover)\.py)'\)\.read_text\(\),__file__,'exec'\)\)\n", source)
    if match:
        return (wrapper.parent.parent / match[1]).read_text()
    return source


def compose(kind, source):
    # Include the same small decoder in the remote cleanup program and the
    # local retrieval consumer. No changes to custody, /proc identity or waits.
    import inspect
    support = 'import zlib\n' + inspect.getsource(diagnostic)
    if kind == 'cleanup':
        source = replace_once(source, "for p in out.glob('*stderr*.gz'):",
                              "gzipDiagnostics=[]\n" + support +
                              "\nfor p in sorted(set(out.glob('*stderr*.gz')) | {out/'chrome-stderr.gz'}):")
        source = replace_once(source, " for v in re.findall(rb'DevTools listening on ws://127[.]0[.]0[.]1:(\\\\d+)/',gzip.decompress(p.read_bytes())):values.append(int(v))",
                              " decoded,status=diagnostic(p);gzipDiagnostics.append(status)\n"
                              " for v in re.findall(rb'DevTools listening on ws://127[.]0[.]0[.]1:(\\\\d+)/',decoded):values.append(int(v))")
        # stdout is not a source of cleanup ports, but its validity must be explicit.
        source = replace_once(source, 'ports=[]\n',
                              "for p in sorted(set(out.glob('*stdout*.gz')) | {out/'chrome-stdout.gz'}):\n _,status=diagnostic(p);gzipDiagnostics.append(status)\nports=[]\n")
        source = replace_once(source, 'noInputCaptureRetry=True,kernelComplete=True',
                              'noInputCaptureRetry=True,gzipDiagnostics=gzipDiagnostics,collectionIsNotBrowserEOF=True,kernelComplete=True')
    elif kind == 'retrieval':
        source = replace_once(source, "verified=[]\n", support + "\nverified=[]\n")
        source = replace_once(source, " if p.suffix=='.gz':\n  decoded=gzip.decompress(b)\n  if 'original' in row:assert len(decoded)==row['original']['size'] and hashlib.sha256(decoded).hexdigest()==row['original']['sha256']\n verified.append(row)",
                              " entry={**row,'shaSizeVerified':True}\n"
                              " if p.suffix=='.gz':\n"
                              "  decoded,status=diagnostic(p);entry.update(status);entry['path']=row['path']\n"
                              "  if status['EOF'] and 'original' in row:assert len(decoded)==row['original']['size'] and hashlib.sha256(decoded).hexdigest()==row['original']['sha256']\n"
                              " verified.append(entry)")
        source = replace_once(source, 'gzipCRC=sum(p[\'path\'].endswith(\'.gz\') for p in verified)',
                              "gzipCRC='PER_ARTIFACT',collectionIsNotBrowserEOF=True,fixturePASS=False,meaning='SHA-size collection only; browser EOF and fixture success are not asserted',gzipDiagnostics=[diagnostic(dest/sub/name)[1] for name in ['chrome-stderr.gz','chrome-stdout.gz']]")
    else:
        raise ValueError('expected cleanup or retrieval')
    return source


def main():
    kind, filename, *args = sys.argv[1:]
    wrapper = Path(filename).resolve()
    source = compose(kind, wrapper_source(wrapper))
    # Preserve the actual wrapper's control module resolution and CLI contract.
    sys.path.insert(0, str(wrapper.parent))
    sys.argv = [str(wrapper), *args]
    exec(compile(source, str(wrapper), 'exec'), dict(__name__='__main__', __file__=str(wrapper)))


if __name__ == '__main__':
    main()
