"""Read documented chain metadata only; never fetch chunks or follow redirects.

Uses the unchanged identity already configured in the CLI status-reported path.
Signed URLs and credentials never reach disk/stdout. Stop on any access denial.
"""
import hashlib
import json
import pathlib
import urllib.error
import urllib.request

HERE = pathlib.Path(__file__).resolve().parent
CONFIG = pathlib.Path('/home/user/.config/ascii/boat/config.json')
SNAPSHOTS = {
    'canonical': 'de8639e2-cf50-4c6b-a330-6c482bc6f573',
    'installed': '3ac9827f-20cf-4e1c-98a8-40b4edcd1b2f',
}


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def sanitize(value):
    if isinstance(value, dict):
        return {k: ('[REDACTED]' if any(s in k.lower() for s in
                ('url', 'token', 'authorization', 'secret')) else sanitize(v))
                for k, v in value.items()}
    if isinstance(value, list):
        return [sanitize(v) for v in value]
    if isinstance(value, str) and ('https://' in value or 'boat_' in value):
        return '[REDACTED]'
    return value


def main():
    config = json.loads(CONFIG.read_text())
    assert config['api_url'].rstrip('/') == 'https://boat.dev'
    opener = urllib.request.build_opener(NoRedirect)
    for role, snapshot in SNAPSHOTS.items():
        path = f'/api/v1/snapshots/{snapshot}/download'
        request = urllib.request.Request('https://boat.dev' + path,
            headers={'Authorization': 'Bearer ' + config['token'],
                     'Accept': 'application/json'})
        try:
            response = opener.open(request, timeout=45)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            # Metadata only: this endpoint's documented response is JSON.
            assert 'json' in response.headers.get('Content-Type', '')
            body = response.read(1048577)
            assert len(body) <= 1048576, 'Metadata exceeds admitted 1MiB'
            payload = json.loads(body)
            result = {'method': 'GET', 'path': path, 'httpStatus': response.code,
                      'bodyBytes': len(body), 'response': sanitize(payload)}
            (HERE / 'raw' / (role + '-download-metadata.json')).write_text(
                json.dumps(result, indent=2) + '\n')
            print(json.dumps({'role': role, 'httpStatus': response.code,
                              'metadataBytes': len(body)}))
            if response.code != 200:
                return 1  # No retries, identity/endpoint workaround, or transfer.
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
