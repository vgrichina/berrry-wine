# Penguin Command original Windows recovery — 2026-10-23

Disposition: **BLOCKED_GUARD_REJECTION; closure incomplete; no runtime attempt.**
Single-task worker session `01a169f6-9ffc-7571-90c9-3c5b302c3a79`.
Base and initial strict-SSH actual remote main:
`868e0440bdad4de2a364423da513aeb0b9e00e69`.
Private branch: `task/penguin-command-original-closure-oct23`.

## Actual acquisition and provenance

The [official author page](https://www.linux-games.com/penguin-command/)
returned HTTP 200. Its retained HTML identifies version 1.6.11 for Windows,
links `http://prdownloads.sourceforge.net/penguin-command/penguin-command-win32-1.6.11.zip`,
and describes the game as GPL licensed. The authorized HTTPS version of that
download URL redirected through downloads.sourceforge.net to master.dl.sourceforge.net
and returned HTTP 200. No alternate game or mirror search was used.

The original ZIP bytes are retained, **ignored by Git**, at:

`/home/user/wine-assembly-penguin-command-original-oct23/docs/re-notes/penguin-command-original-20261023/archive.zip`

Size: **1,410,755 bytes**. SHA-256:

`4399b52a1f8fec2501737a53ab42def6d5faebde37c0de5efc1295ab495caf34`

This equals the coordinator-supplied release SHA-256. The release-page digest
was not independently read from SourceForge metadata. License provenance is the
author's GPL statement; the archive's license version/text has not been inspected.
The ZIP is the sole materialized release copy. There is no extraction.

## Concrete stop and sequencing error

The attempted metadata fetch of the supplied SourceForge `/download` page
followed redirects to the actual ZIP. Its 524,288-byte bound rejected the
response: **curl exit 63, Maximum file size exceeded**. No release HTML was
retained. This was an operation guard rejection, not an acquisition-access denial
or a host capacity failure.

The batch mistakenly proceeded to its separately bounded archive request after
that rejection. That request succeeded under its 8,388,608-byte ceiling. This
sequencing violated the requested immediate-stop rule. On observing the batch
result, the worker stopped acquisition/inspection/extraction. Only preservation
hashing, evidence documentation and publication followed. No unchanged retry,
limit increase or substitute readiness task was performed.

The recoverable input is now present and matches the supplied identity. The
coordinator owns any explicit continuation decision: a continued same-game
task should reuse these original bytes, avoid treating `/download` as HTML,
and stop its command sequence immediately on any guard rejection. No capacity
increase is established as necessary by this result.

## Allocation and evidence limits

The first checkpoint preceded task artifact creation and download. Projection:
**54,998,542 / 67,108,864 bytes**, including private Git/index/checkout (4 MiB),
archive allowance (8 MiB), extraction allowance (16 MiB), evidence/temp (2 MiB),
current external launcher plus Codex session logs (472,590 bytes), their future
growth (12 MiB), publication objects/temp (2 MiB), and **8 MiB reserve inside cap**.
Host free then was 4,385,386,496 bytes; after full projection 4,330,387,954 bytes,
above the required 2,982,150,144-byte floor. Final measurement is adjacent.

Installed tools were executed in place, with identities and standing footprint
recorded separately. The private Git object database uses the root's standing
objects as a read-only alternate; no source tree or donor object copy was made.
Root dirty files, index and refs were preserved. No Node, compiler, WebAssembly,
guest, worker, or box operation ran. Python command wall limits were 60 seconds;
curl used 10-second connect and 15-second wall limits. No task file exceeds
24 MiB; captured command output stayed below 512 KiB (conservative bound 256 KiB).

## Explicitly outstanding acceptance

Archive member sizes/CRC, individual-file hashes, PE machine/entrypoint/imports
and ordinals, bundled DLL identities, recursive emulator dependency comparison,
required asset paths, config/write needs, controls and gameplay/score route are
**unverified**. No minimal VFS or launch/capture recipe is asserted: the contents
have not been inspected. No app registration or gameplay claim was made.

The next executable static acceptance command, only under a coordinator-authorized
continuation with fresh resource admission, is:

```sh
timeout 60s python3 - <<'PY'
from pathlib import Path, PurePosixPath
import hashlib, json, zipfile
p = Path('/home/user/wine-assembly-penguin-command-original-oct23/docs/re-notes/penguin-command-original-20261023/archive.zip')
assert p.stat().st_size == 1410755
assert hashlib.sha256(p.read_bytes()).hexdigest() == '4399b52a1f8fec2501737a53ab42def6d5faebde37c0de5efc1295ab495caf34'
with zipfile.ZipFile(p) as z:
    members = z.infolist()
    assert len(members) <= 4096
    assert sum(i.file_size for i in members) <= 16777216
    for i in members:
        n = PurePosixPath(i.filename.replace('\\', '/'))
        assert not n.is_absolute() and '..' not in n.parts and ':' not in str(n)
        assert i.file_size <= 25165824 and not (i.flag_bits & 1)
    print(json.dumps([{'path': i.filename, 'bytes': i.file_size, 'compressed': i.compress_size, 'crc32': f'{i.CRC:08x}'} for i in members]))
PY
```

This command is supplied for handoff and **was not executed**. It does not extract
or run the game. A concrete gameplay acceptance command cannot responsibly be
specified until the closure and actual existing launch interface are inspected;
future execution also needs a coordinator-assigned runtime and capture allocation.
Box ID/state/expiry: **N/A, none assigned or accessed**. Coordinator owns lifecycle.

## Evidence and recovery

Adjacent `acquisition-preservation.json` binds retained location, byte count and
hash. `author.html`, `author.headers`, `author.transfer.json`, `release.headers`,
`release.transfer.json`, `archive.headers`, and `archive.transfer.json` retain
actual URLs/redirects/status/command bounds and results. Header snapshots normalize
line endings and omit transient server-set bot/mirror cookies; author HTML has
trailing line whitespace normalized. Archive bytes remain untouched.
`allocation-initial.json`
records first admission; `allocation-final.json` records closeout projection.
`evidence-manifest.json` hashes the retained evidence files, excluding itself and
the final allocation receipt to avoid circular seals. Publication proof is kept
outside this commit in the existing launcher output directory and messageboard.

If the ignored ZIP is lost, recover only from the authorized HTTPS
`prdownloads.sourceforge.net/penguin-command/penguin-command-win32-1.6.11.zip`
URL using curl with `--fail --location --connect-timeout 10 --max-time 45
--max-filesize 8388608`; stop on failure and require the exact size/hash above
before using bytes. Do not re-download the release `/download` endpoint as
metadata. Binary retention is local, separate from the pushed Git evidence;
the pushed branch alone does not back up the ZIP.
