#!/usr/bin/env python3
"""One exact primary source retrieval; no redirects, bounded streaming writes."""
import hashlib, io, json, pathlib, urllib.request
H = pathlib.Path(__file__).resolve().parent
def copy_bounded(src, dst, limit):
    total = 0
    while True:
        chunk = src.read(min(8192, limit - total + 1))
        if not chunk:
            return total
        if total + len(chunk) > limit:
            raise ValueError('stream byte limit')
        dst.write(chunk)
        total += len(chunk)
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        raise ValueError('redirect refused')
if __name__ == '__main__':
    sentinel = False
    try:
        copy_bounded(io.BytesIO(b'12345'), io.BytesIO(), 4)
        sentinel = True
    except ValueError:
        pass
    assert not sentinel
    (H/'stream-guard-test.json').write_text(json.dumps({'overflow_rejected':True,'downstream_sentinel':sentinel})+'\n')
    url = 'https://zlib.net/fossils/zlib-1.1.3.tar.gz'
    out = H/'zlib-1.1.3.tar.gz'
    assert not out.exists()
    with urllib.request.build_opener(NoRedirect).open(url, timeout=20) as r:
        assert r.status == 200
        assert int(r.headers['Content-Length']) <= 262144
        headers = dict(r.headers)
        with out.open('xb') as f:
            n = copy_bounded(r, f, 262144)
    (H/'zlib-source-receipt.json').write_text(json.dumps({'url':url,'bytes':n,'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'headers':headers},indent=2)+'\n')
