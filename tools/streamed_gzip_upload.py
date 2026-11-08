"""Pinned gzip -> Content-Length PUT, without an uncompressed disk stage.

No retries or redirects. Any transport exception has UNKNOWN remote effects.
The caller must keep an unsuccessful destination quarantined from consumers.
"""
import hashlib
import urllib.request
import zlib

CHUNK = 65536


def validated_chunks(source, pin, compressed_pin):
    """Single gzip member, bounded output, CRC/ISIZE and both pins required."""
    raw_hash, zip_hash = hashlib.sha256(), hashlib.sha256()
    raw_size = zip_size = 0
    decoder = zlib.decompressobj(31)
    with open(source, 'rb') as stream:
        while block := stream.read(CHUNK):
            zip_size += len(block)
            if zip_size > compressed_pin['size']:
                raise ValueError('compressed oversize')
            zip_hash.update(block)
            if decoder.eof:
                raise ValueError('trailing gzip content')
            while block:
                output = decoder.decompress(block, CHUNK)
                block = decoder.unconsumed_tail
                raw_size += len(output)
                if raw_size > pin['size']:
                    raise ValueError('decompressed oversize')
                raw_hash.update(output)
                if decoder.unused_data:
                    raise ValueError('trailing gzip content')
                if output:
                    yield output
    if not decoder.eof:
        raise ValueError('truncated gzip/footer')
    if (raw_size, raw_hash.hexdigest()) != (pin['size'], pin['sha256']):
        raise ValueError('decompressed pin mismatch')
    if (zip_size, zip_hash.hexdigest()) != (compressed_pin['size'], compressed_pin['sha256']):
        raise ValueError('compressed pin mismatch')


def validate(source, pin, compressed_pin):
    for _ in validated_chunks(source, pin, compressed_pin):
        pass


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def upload_gzip(source, pin, compressed_pin, upload_url, remote_hash, *, timeout=30):
    """Return acceptance only after EOF validation, HTTP success and remote HASH.

    upload_url is a callable so malformed sources never request a signed URL.
    remote_hash must independently read the destination, returning size/sha256.
    A changed source during PUT fails closed even if the server returns 2xx.
    """
    validate(source, pin, compressed_pin)
    completed = False

    def body():
        nonlocal completed
        yield from validated_chunks(source, pin, compressed_pin)
        completed = True

    req = urllib.request.Request(upload_url(), data=body(), method='PUT', headers={
        'Content-Type': 'application/octet-stream', 'Content-Length': str(pin['size'])})
    # urllib's http client sends iterable bodies incrementally when length is set.
    # Its opener does not retry failed PUTs; redirects are explicitly refused.
    with urllib.request.build_opener(NoRedirect).open(req, timeout=timeout) as response:
        if not 200 <= response.status < 300:
            raise RuntimeError('PUT failed; UNKNOWN remote effects; no retry')
    if not completed:
        raise RuntimeError('PUT body incomplete; UNKNOWN remote effects; no retry')
    observed = remote_hash()
    if (observed.get('size'), observed.get('sha256')) != (pin['size'], pin['sha256']):
        raise ValueError('remote HASH/length mismatch; destination not accepted')
    return dict(accepted=True, size=pin['size'], sha256=pin['sha256'])
